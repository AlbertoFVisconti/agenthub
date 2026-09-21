import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Checks if Docker is installed and the daemon is running.
 * Returns { available: boolean, error?: string }
 */
export async function checkDockerAvailable(): Promise<{ available: boolean, error?: string }> {
  try {
    await execFileAsync('docker', ['info'])
    return { available: true }
  } catch (err: any) {
    return { 
      available: false, 
      error: err.stderr || err.message || String(err)
    }
  }
}

/**
 * Runs a dry-run test of an MCP tool in a Docker container.
 * Mounts the code folder, runs the entrypoint, and sends an `initialize` JSON-RPC message.
 * Returns true if the tool responds with a valid JSON-RPC initialization response.
 */
import * as path from 'node:path'

export async function runMcpDryRun(codeDir: string, entrypoint: string[], manifest?: any): Promise<boolean> {
  let imageToRun = 'node:20-alpine'

  if (manifest?.dockerfile) {
    const imageName = `agenthub-tool-${manifest.name}-${manifest.version || 'dev'}`.toLowerCase().replace(/[^a-z0-9-_]/g, '')
    const buildArgs = [
      'build',
      '-t', imageName,
      '-f', path.join(codeDir, manifest.dockerfile),
      codeDir
    ]

    const buildPassed = await new Promise<boolean>((resolve) => {
      const buildProc = spawn('docker', buildArgs, { stdio: 'ignore' })
      const buildTimer = setTimeout(() => {
        buildProc.kill()
        resolve(false)
      }, 10 * 60 * 1000) // 10 minutes max build time

      buildProc.on('close', (code) => {
        clearTimeout(buildTimer)
        resolve(code === 0)
      })
      buildProc.on('error', () => {
        clearTimeout(buildTimer)
        resolve(false)
      })
    })

    if (!buildPassed) return false

    try {
      const { stdout } = await execFileAsync('docker', ['image', 'inspect', imageName, '--format', '{{.Size}}'])
      const sizeBytes = parseInt(stdout.trim(), 10)
      if (sizeBytes > 3 * 1024 * 1024 * 1024) { // 3GB limit
        return false
      }
    } catch {
      return false
    }

    imageToRun = imageName
  }

  return new Promise((resolve) => {
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
      imageToRun,
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
    }, 10000)

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
      
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' 

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
        } catch {}
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

    proc.stdin.write(JSON.stringify(initRequest) + '\n')
  })
}
