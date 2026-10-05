#!/usr/bin/env node
// scripts/ci-dry-run.js
// Usage: node ci-dry-run.js <image-name> <entrypoint-json>
// Exits 0 if MCP handshake succeeds, 1 if it fails.

const { spawn } = require('child_process')

const image = process.argv[2]
const entrypoint = JSON.parse(process.argv[3])

const dockerArgs = [
  'run', '-i', '--rm',
  '--network=none', '--cap-drop=ALL',
  '--memory=2g', '--cpus=2', '--pids-limit=256',
  image, ...entrypoint
]

const proc = spawn('docker', dockerArgs, { stdio: ['pipe', 'pipe', 'pipe'] })

const initRequest = {
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    clientInfo: { name: 'agenthub-ci', version: '0.0.1' },
    capabilities: {}
  }
}

let buffer = ''
const timer = setTimeout(() => {
  console.error('Dry-run timed out after 15 seconds')
  proc.kill()
  process.exit(1)
}, 15000)

proc.stdout.on('data', (data) => {
  buffer += data.toString()
  for (const line of buffer.split('\n')) {
    try {
      const msg = JSON.parse(line)
      if (msg.id === 1 && msg.result) {
        console.log('MCP handshake succeeded')
        clearTimeout(timer)
        proc.kill()
        process.exit(0)
      }
    } catch {}
  }
})

proc.stderr.on('data', (data) => {
  process.stderr.write(data) // Pass through for debugging
})

proc.on('close', (code) => {
  console.error(`Container exited with code ${code} before responding to MCP initialize`)
  clearTimeout(timer)
  process.exit(1)
})

proc.stdin.write(JSON.stringify(initRequest) + '\n')
