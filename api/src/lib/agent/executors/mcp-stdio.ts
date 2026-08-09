import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface, type Interface } from 'node:readline'
import type { ToolExecutor, ToolResult } from '../types.js'
import type { ToolDefinition, ToolCall } from '../../models/types.js'

/**
 * MCP JSON-RPC request/response shapes (minimal subset we need)
 */
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

/**
 * StdioMcpExecutor — spawns a MCP server inside a basic Docker container
 * and communicates via stdio using the MCP JSON-RPC protocol.
 *
 * (Phase 4): Basic Docker isolation so no untrusted marketplace tool
 * runs as a bare host subprocess.
 * (Phase 7): Hardening flags (timeout, memory, no-network, user) will be added here.
 */
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
    callTimeoutMs?: number
    network?: boolean
    workspacePath?: string
    onEvent?: (type: 'invoke' | 'error', call: ToolCall, err?: Error) => void
  }) {
    this.image = opts.image
    this.callTimeoutMs = opts.callTimeoutMs ?? 60000
  }

  async listTools(): Promise<ToolDefinition[]> {
    if (this._tools) return this._tools
    const res = await this.rpc({ method: 'tools/list' })
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

      return { callId: call.id, content: content || '(empty result)', isError: false }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.opts.onEvent?.('error', call, err instanceof Error ? err : new Error(message))
      return { callId: call.id, content: `Execution error: ${message}`, isError: true }
    }
  }

  /**
   * Send a JSON-RPC request to the MCP server.
   * Lazily starts the container on the first call.
   */
  private async rpc(req: Omit<JsonRpcRequest, 'jsonrpc' | 'id'>): Promise<JsonRpcResponse> {
    await this.ensureStarted()

    return new Promise((resolve, reject) => {
      const id = this._nextId++
      const timer = setTimeout(() => {
        this._pending.delete(id)
        reject(new Error(`MCP call timed out after ${this.callTimeoutMs}ms`))
      }, this.callTimeoutMs)

      this._pending.set(id, {
        resolve: (val) => { clearTimeout(timer); resolve(val) },
        reject: (err) => { clearTimeout(timer); reject(err) }
      })

      const fullReq: JsonRpcRequest = { jsonrpc: '2.0', id, method: req.method, params: req.params }
      this._proc!.stdin!.write(JSON.stringify(fullReq) + '\n')
    })
  }

  private async ensureStarted(): Promise<void> {
    if (this._proc) return

    return new Promise((resolve, reject) => {
      // Allow tool manifest to dictate network access if configured
      // We use a custom Docker network 'agenthub-egress' that drops RFC1918 and metadata IP (169.254.169.254)
      const networkFlag = this.opts?.network ? '--network=agenthub-egress' : '--network=none'

      const dockerArgs = [
        'run', '-i', '--rm',
        '--label=agenthub-tool=true',
        '--memory=256m',
        '--cpus=0.5',
        '--pids-limit=64',
        networkFlag,
        '--cap-drop=ALL',
        '--security-opt=no-new-privileges',
        '--read-only',
        '--tmpfs=/tmp:rw,noexec,nosuid,size=64m',
        '--user=1000:1000'
      ]

      if (this.opts.workspacePath) {
        dockerArgs.push(`-v`, `${this.opts.workspacePath}:/workspace:ro`)
      }

      dockerArgs.push(this.image)

      // Hardened Docker wrapper for Phase 7
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
          const msg = JSON.parse(line)
          if (msg.id !== undefined && this._pending.has(msg.id)) {
            const { resolve } = this._pending.get(msg.id)!
            this._pending.delete(msg.id)
            resolve(msg)
          }
        } catch { /* ignore parsing errs */ }
      })

      proc.on('error', (err) => {
        this.killAllPending(err)
      })

      proc.on('close', () => {
        this.killAllPending(new Error('Container closed'))
        this._proc = null
      })

      // Send initialize
      const initId = this._nextId++
      const initReq: JsonRpcRequest = {
        jsonrpc: '2.0', id: initId,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'agenthub', version: '0.0.1' },
          capabilities: {},
        },
      }

      const timer = setTimeout(() => {
        this._pending.delete(initId)
        proc.kill()
        reject(new Error('MCP initialize timed out'))
      }, 10000)

      this._pending.set(initId, {
        resolve: () => { clearTimeout(timer); resolve() },
        reject: (err) => { clearTimeout(timer); reject(err) }
      })

      proc.stdin!.write(JSON.stringify(initReq) + '\n')
    })
  }

  private killAllPending(err: Error) {
    for (const [id, { reject }] of this._pending.entries()) {
      reject(err)
      this._pending.delete(id)
    }
  }

  async cleanup(): Promise<void> {
    if (this._proc) {
      this.killAllPending(new Error('Session closed'))
      this._proc.kill()
      this._proc = null
    }
  }
}
