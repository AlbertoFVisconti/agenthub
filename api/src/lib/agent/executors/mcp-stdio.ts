import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { createInterface, type Interface } from 'node:readline'
import * as path from 'node:path'
import * as os from 'node:os'
import * as fs from 'node:fs'
import type { ToolExecutor, ToolResult } from '../types.js'
import type { ToolDefinition, ToolCall } from '../../models/types.js'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: unknown
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number
  result?: {
    tools?: Array<{
      name: string
      description?: string
      inputSchema?: {
        type: 'object'
        properties?: Record<string, unknown>
        required?: string[]
      }
    }>
    content?: Array<{ type: string; text?: string }>
  }
  error?: { code: number; message: string; data?: unknown }
}

export class StdioMcpExecutor implements ToolExecutor {
  private image: string
  private callTimeoutMs: number
  private _tools: ToolDefinition[] | null = null
  private _proc: ChildProcess | null = null
  private _rl: Interface | null = null
  private _nextId = 1
  private _pending = new Map<number, { resolve: (val: JsonRpcResponse) => void, reject: (err: Error) => void }>()

  constructor(private opts: {
    image: string
    toolDir?: string
    entrypoint?: string[]
    dockerfile?: string
    callTimeoutMs?: number
    toolId?: string
    toolVersion?: string
    memoryLimit?: string
    cpuLimit?: string
    workspacePath?: string
    onEvent?: (type: 'invoke' | 'error', call: ToolCall, err?: Error) => void
  }) {
    this.image = opts.image
    this.callTimeoutMs = opts.callTimeoutMs ?? 60000
  }

  async listTools(): Promise<ToolDefinition[]> {
    if (this._tools) return this._tools
    const res = await this.rpc({ method: 'tools/list' }, 8000)
    if (res.error) throw new Error(`MCP tools/list error: ${res.error.message}`)
    this._tools = (res.result?.tools ?? []).map((t: any) => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: {
        type: 'object' as const,
        properties: (t.inputSchema?.properties ?? {}) as Record<string, unknown>,
        required: t.inputSchema?.required,
      },
    }))
    return this._tools
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    try {
      this.opts.onEvent?.('invoke', call)
      
      const res = await this.rpc({
        method: 'tools/call',
        params: { name: call.name, arguments: call.input },
      })

      if (res.error) {
        this.opts.onEvent?.('error', call, new Error(res.error.message))
        return { callId: call.id, content: `Tool error: ${res.error.message}`, isError: true }
      }

      const content = (res.result?.content ?? [])
        .map((c: any) => c.text ?? JSON.stringify(c))
        .join('\n')

      return { callId: call.id, content, isError: false }
    } catch (err: any) {
      this.opts.onEvent?.('error', call, err)
      return { callId: call.id, content: `Exception: ${err.message}`, isError: true }
    }
  }

  private async _ensureStarted(): Promise<void> {
    if (this._proc) return

    return new Promise((resolve, reject) => {
      try {
        const fallbackDir = path.join(os.tmpdir(), 'agenthub-workspace')
        fs.mkdirSync(fallbackDir, { recursive: true })
        const mountPath = this.opts.workspacePath || fallbackDir
        console.debug(`[StdioMcpExecutor] Mounting workspace path: ${mountPath} for image ${this.image}`)
        
        const mem = this.opts.memoryLimit || '256m'
        const cpu = this.opts.cpuLimit || '0.5'

        const dockerArgs = [
          'run', '-i', '--rm',
          '--label=agenthub-tool=true',
          `--memory=${mem}`,
          `--memory-swap=${mem}`,
          `--cpus=${cpu}`,
          '--pids-limit=64',
          '--network=none',
          '--cap-drop=ALL',
          '--security-opt=no-new-privileges',
          '--read-only',
          '--tmpfs=/tmp:rw,noexec,nosuid,size=64m',
          '--user=1000:1000'
        ]
        dockerArgs.push(`-v`, `${mountPath}:/workspace:ro`)

        if (this.opts.toolDir && this.opts.entrypoint) {
          let runImage = 'node:20-alpine'
          if (this.opts.dockerfile) {
            const imageName = `agenthub-tool-${this.image}-${this.opts.toolVersion || 'dev'}`.toLowerCase().replace(/[^a-z0-9-_]/g, '')
            try {
              execFileSync('docker', ['image', 'inspect', imageName], { stdio: 'ignore' })
            } catch {
              execFileSync('docker', [
                'build',
                '-t', imageName,
                '-f', path.join(this.opts.toolDir, this.opts.dockerfile),
                this.opts.toolDir
              ])
            }
            runImage = imageName
          }
          
          dockerArgs.push(`-v`, `${this.opts.toolDir}:/app:ro`)
          dockerArgs.push(`-w`, `/app`)
          dockerArgs.push(runImage)
          dockerArgs.push(...this.opts.entrypoint)
        } else {
          dockerArgs.push(this.image)
        }

        console.debug('[StdioMcpExecutor] Running container with args:', dockerArgs.join(' '))

        const proc = spawn('docker', dockerArgs, {
          env: process.env,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
        this._proc = proc

        const rl = createInterface({ input: proc.stdout! })
        this._rl = rl

        rl.on('line', (line) => {
          if (!line.trim()) return
          try {
            const msg = JSON.parse(line) as JsonRpcResponse
            const pending = this._pending.get(msg.id)
            if (pending) {
              pending.resolve(msg)
              this._pending.delete(msg.id)
            }
          } catch (err) {
            console.error('[StdioMcpExecutor] failed to parse MCP response:', line, err)
          }
        })

        proc.stderr?.on('data', (d) => {
          console.error(`[StdioMcpExecutor][${this.image}] STDERR:`, d.toString())
        })

        proc.on('error', (err) => {
          console.error(`[StdioMcpExecutor] Failed to start container ${this.image}:`, err)
          reject(err)
        })

        proc.on('spawn', () => resolve())
        proc.on('exit', () => {
          this._proc = null
          this._rl?.close()
          this._rl = null
        })
      } catch (err) {
        reject(err)
      }
    })
  }

  private async rpc(req: Omit<JsonRpcRequest, 'jsonrpc' | 'id'>, timeoutMs = this.callTimeoutMs): Promise<JsonRpcResponse> {
    await this._ensureStarted()
    const id = this._nextId++
    const fullReq: JsonRpcRequest = { jsonrpc: '2.0', id, ...req }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id)
        reject(new Error(`MCP request ${req.method} timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      this._pending.set(id, {
        resolve: (val) => { clearTimeout(timer); resolve(val) },
        reject: (err) => { clearTimeout(timer); reject(err) }
      })

      if (!this._proc || !this._proc.stdin) {
        return reject(new Error('Process not running'))
      }

      this._proc.stdin.write(JSON.stringify(fullReq) + '\n')
    })
  }

  async cleanup(): Promise<void> {
    for (const { reject } of this._pending.values()) {
      reject(new Error('Executor cleanup'))
    }
    this._pending.clear()

    if (this._proc) {
      this._proc.kill()
      this._proc = null
    }
    if (this._rl) {
      this._rl.close()
      this._rl = null
    }
  }
}
