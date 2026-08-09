import { spawn } from 'node:child_process'

/**
 * Runs a dry-run test of an MCP tool in a Docker container.
 * Mounts the code folder, runs the entrypoint, and sends an `initialize` JSON-RPC message.
 * Returns true if the tool responds with a valid JSON-RPC initialization response.
 */
export async function runMcpDryRun(codeDir: string, entrypoint: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    // Basic Phase 4 isolation: run in a container, mount the code directory.
    // Assuming Node.js based tools for this prototype, so we use `node:20-alpine`.
    // In a real system, the manifest might specify the runtime, or the tool is already a docker image.
    // For this marketplace, we'll use a generic node image and run the entrypoint.
    const proc = spawn('docker', [
      'run', '-i', '--rm',
      '--memory=256m',
      '--cpus=0.5',
      '--pids-limit=64',
      '--network=none',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      '--read-only',
      '--tmpfs=/tmp:rw,noexec,nosuid,size=64m',
      '--user=1000:1000',
      '-v', `${codeDir}:/app:ro`,
      '-w', '/app',
      'node:20-alpine',
      ...entrypoint
    ], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let resolved = false
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        proc.kill()
        resolve(false)
      }
    }, 10000) // 10s timeout for boot

    // MCP initialize request
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        clientInfo: { name: 'agenthub-dryrun', version: '0.0.1' },
        capabilities: {}
      }
    }

    let buffer = ''
    proc.stdout.on('data', (data) => {
      if (resolved) return
      buffer += data.toString()
      
      // Try to parse lines of JSON
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // keep the incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line)
          if (msg.id === 1 && msg.result) {
            resolved = true
            clearTimeout(timer)
            proc.kill()
            resolve(true)
            return
          }
        } catch {
          // ignore parsing errors for intermediate non-JSON output
        }
      }
    })

    proc.on('error', () => {
      if (!resolved) {
        resolved = true
        clearTimeout(timer)
        resolve(false)
      }
    })

    proc.on('close', () => {
      if (!resolved) {
        resolved = true
        clearTimeout(timer)
        resolve(false)
      }
    })

    // Send init request
    proc.stdin.write(JSON.stringify(initRequest) + '\n')
  })
}
