import { createInterface } from 'node:readline'

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  handler: (args: any) => Promise<string> | string
}

export function defineTool(def: ToolDefinition) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  })

  rl.on('line', async (line) => {
    if (!line.trim()) return

    try {
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id: req.id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: { name: def.name, version: '1.0.0' },
            capabilities: { tools: {} }
          }
        }))
      } else if (req.method === 'tools/list') {
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id: req.id,
          result: {
            tools: [{
              name: def.name,
              description: def.description,
              inputSchema: def.inputSchema
            }]
          }
        }))
      } else if (req.method === 'tools/call') {
        if (req.params.name === def.name) {
          try {
            const resultText = await Promise.resolve(def.handler(req.params.arguments || {}))
            console.log(JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                content: [{ type: 'text', text: String(resultText) }]
              }
            }))
          } catch (e: any) {
            console.log(JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              error: { code: -32000, message: e.message || String(e) }
            }))
          }
        } else {
          console.log(JSON.stringify({
            jsonrpc: '2.0',
            id: req.id,
            error: { code: -32601, message: `Tool not found: ${req.params.name}` }
          }))
        }
      }
    } catch (e) {
      // Ignored to avoid crashing on malformed non-JSON lines
    }
  })
}
