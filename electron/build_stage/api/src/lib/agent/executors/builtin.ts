import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { applyPatch } from 'diff'
import type { ToolExecutor, ToolResult } from '../types.js'
import type { ToolDefinition, ToolCall } from '../../models/types.js'
import { ProjectWorkspace } from '../../project/workspace.js'

/**
 * BuiltinExecutor — implements the 6 core coding tools.
 * Scoped entirely to a provided ProjectWorkspace.
 */
export class BuiltinExecutor implements ToolExecutor {
  constructor(private workspace: ProjectWorkspace) {}

  async listTools(): Promise<ToolDefinition[]> {
    return [
      {
        name: 'read_file',
        description: 'Read the contents of a file in the project.',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string', description: 'Relative path to the file' } },
          required: ['path'],
        },
      },
      {
        name: 'write_file',
        description: 'Write or overwrite a file in the project with new content.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path to the file' },
            content: { type: 'string', description: 'Complete new content' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'apply_diff',
        description: 'Apply a unified diff to a file.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path to the file' },
            diff: { type: 'string', description: 'Unified diff content' },
          },
          required: ['path', 'diff'],
        },
      },
      {
        name: 'list_dir',
        description: 'List contents of a directory.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path to the directory (e.g. ".")' },
            recursive: { type: 'boolean', description: 'List recursively (default: false)' },
          },
          required: ['path'],
        },
      },
      {
        name: 'run_command',
        description: 'Run a shell command in the project root. (Requires user confirmation)',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Shell command to execute' },
          },
          required: ['command'],
        },
      },
      {
        name: 'search_codebase',
        description: 'Regex search across project files.',
        inputSchema: {
          type: 'object',
          properties: {
            regex: { type: 'string', description: 'Regular expression to search for' },
            path: { type: 'string', description: 'Relative directory to search within (e.g. ".")' },
          },
          required: ['regex', 'path'],
        },
      },
    ]
  }

  requiresConfirmation(call: ToolCall): string | undefined {
    if (call.name === 'run_command' && typeof call.input.command === 'string') {
      return call.input.command
    }
    return undefined
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    try {
      switch (call.name) {
        case 'read_file': {
          const filePath = this.workspace.resolvePath(String(call.input.path), true)
          const content = await fs.promises.readFile(filePath, 'utf8')
          return { callId: call.id, content, isError: false }
        }

        case 'write_file': {
          const filePath = this.workspace.resolvePath(String(call.input.path), false)
          const dir = path.dirname(filePath)
          if (!fs.existsSync(dir)) {
            await fs.promises.mkdir(dir, { recursive: true })
          }
          await fs.promises.writeFile(filePath, String(call.input.content), 'utf8')
          return { callId: call.id, content: `Successfully wrote ${call.input.path}`, isError: false }
        }

        case 'apply_diff': {
          const filePath = this.workspace.resolvePath(String(call.input.path), true)
          const currentContent = await fs.promises.readFile(filePath, 'utf8')
          const patched = applyPatch(currentContent, String(call.input.diff))
          if (patched === false) {
            return { callId: call.id, content: 'Failed to apply diff (conflicts or invalid patch).', isError: true }
          }
          await fs.promises.writeFile(filePath, patched, 'utf8')
          return { callId: call.id, content: `Successfully patched ${call.input.path}`, isError: false }
        }

        case 'list_dir': {
          const target = this.workspace.resolvePath(String(call.input.path), true)
          const recursive = Boolean(call.input.recursive)
          const files = await fs.promises.readdir(target, { recursive, withFileTypes: true })
          const out = files.map(f => {
             // In recursive mode, fastify/node adds `parentPath`. We can reconstruct the relative path.
             const relative = path.relative(target, path.join((f as any).parentPath || (f as any).path || target, f.name))
             return `${f.isDirectory() ? '[DIR ]' : '[FILE]'} ${relative}`
          }).join('\n')
          return { callId: call.id, content: out || '(empty directory)', isError: false }
        }

        case 'run_command': {
          const cmd = String(call.input.command)
          // Run command inside the real project root
          const { stdout, stderr, exitCode } = await this.spawnCommand(cmd, this.workspace.rootPath)
          const out = `Exit code: ${exitCode}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`
          return { callId: call.id, content: out.trim(), isError: exitCode !== 0 }
        }

        case 'search_codebase': {
          const regex = String(call.input.regex)
          const target = this.workspace.resolvePath(String(call.input.path), true)
          // We can use a simple node fallback or rely on git/ripgrep. 
          // Since we might not have ripgrep on standard systems, let's implement a naive fast search using node for Phase 4.5.
          // Or we can just spawn powershell/grep if on Windows/Linux. 
          // Let's do a naive recursive node search for maximum portability in this prototype.
          const results = await this.naiveSearch(target, new RegExp(regex, 'g'))
          return { callId: call.id, content: results || 'No matches found.', isError: false }
        }

        default:
          return { callId: call.id, content: `Unknown tool: ${call.name}`, isError: true }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { callId: call.id, content: `Execution error: ${message}`, isError: true }
    }
  }

  private spawnCommand(cmd: string, cwd: string): Promise<{stdout: string, stderr: string, exitCode: number}> {
    return new Promise((resolve) => {
      // Use powershell on windows, sh on others
      const isWin = process.platform === 'win32'
      const shell = isWin ? 'powershell.exe' : '/bin/sh'
      const args = isWin ? ['-Command', cmd] : ['-c', cmd]
      
      const proc = spawn(shell, args, { cwd })
      let stdout = ''
      let stderr = ''
      proc.stdout.on('data', d => { stdout += d })
      proc.stderr.on('data', d => { stderr += d })
      proc.on('close', code => {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? 1 })
      })
      proc.on('error', err => {
        resolve({ stdout: '', stderr: err.message, exitCode: 1 })
      })
    })
  }

  private async naiveSearch(dir: string, regex: RegExp, baseDir = dir): Promise<string> {
    let out = ''
    const entries = await fs.promises.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      // Skip node_modules and .git for sanity
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        out += await this.naiveSearch(fullPath, regex, baseDir)
      } else {
        try {
          const content = await fs.promises.readFile(fullPath, 'utf8')
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              const rel = path.relative(baseDir, fullPath)
              out += `${rel}:${i + 1}:${lines[i].trim()}\n`
              regex.lastIndex = 0 // reset global regex state
            }
          }
        } catch {
          // ignore binary files or unreadable files
        }
      }
    }
    // Cap output so we don't blow up the context window
    if (out.length > 10000) {
      out = out.slice(0, 10000) + '\n... (truncated)'
    }
    return out
  }
}
