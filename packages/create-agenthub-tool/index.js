#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const toolName = process.argv[2]
if (!toolName) {
  console.error('Usage: npx create-agenthub-tool <name>')
  process.exit(1)
}

const dir = path.join(process.cwd(), toolName)

const manifestJson = {
  name: toolName,
  version: "1.0.0",
  description: "A sandbox tool for AgentHub.",
  type: "sandboxed",
  entrypoint: ["node", "index.js"]
}

const packageJson = {
  name: toolName,
  version: "1.0.0",
  type: "module",
  dependencies: {
    "@agenthub/tool-sdk": "latest"
  }
}

const indexJs = `import { defineTool } from '@agenthub/tool-sdk'

defineTool({
  name: '${toolName}',
  description: 'Counts words in text',
  inputSchema: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text']
  },
  handler: async ({ text }) => {
    const count = text.trim().split(/\\s+/).filter(Boolean).length
    return \`Word count: \${count}\`
  }
})
`

const readmeMd = `# ${toolName}

An AgentHub tool.

## Testing Locally
Run \`npx @agenthub/tool-cli validate\` to validate your manifest.
Run \`npx @agenthub/tool-cli test\` to test your tool locally using Docker.

## Publishing
Run \`npx @agenthub/tool-cli package\` to bundle your tool into a zip file.
Upload the resulting \`<name>-<version>.zip\` directly through the AgentHub Marketplace Dashboard.
`

async function main() {
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifestJson, null, 2))
  await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify(packageJson, null, 2))
  await fs.writeFile(path.join(dir, 'index.js'), indexJs)
  await fs.writeFile(path.join(dir, 'README.md'), readmeMd)
  console.log(`Successfully created tool ${toolName} in ./${toolName}`)
  console.log(`Next steps:`)
  console.log(`  cd ${toolName}`)
  console.log(`  npm install`)
}

main().catch(console.error)
