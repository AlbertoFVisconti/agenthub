#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { McpManifestSchema, runMcpDryRun } from '@agenthub-tools/tool-utils'
import { build } from 'esbuild'

const cmd = process.argv[2]

async function bundleTool(manifest) {
  console.log('Bundling tool with esbuild...')
  const entryFile = manifest.entrypoint[manifest.entrypoint.length - 1]
  const outDir = path.join(process.cwd(), '.agenthub-build')
  await fs.mkdir(outDir, { recursive: true })
  const outFile = path.join(outDir, entryFile)

  await build({
    entryPoints: [path.join(process.cwd(), entryFile)],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
  })

  return { entryFile, outFile, outDir }
}

async function validate() {
  const manifestPath = path.join(process.cwd(), 'manifest.json')
  try {
    const raw = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    const parsed = McpManifestSchema.safeParse(raw)
    if (!parsed.success) {
      console.error('Validation failed:')
      parsed.error.issues.forEach(i => console.error(`- ${i.path.join('.')}: ${i.message}`))
      process.exit(1)
    }
    
    if (parsed.data.permissions?.network) {
      console.error('Validation failed: Network-enabled tools are not supported yet — this beta only supports fully sandboxed, network-isolated tools.')
      process.exit(1)
    }

    console.log('Manifest is valid!')
  } catch (err) {
    console.error('Failed to read or parse manifest.json:', err.message)
    process.exit(1)
  }
}

async function test() {
  const manifestPath = path.join(process.cwd(), 'manifest.json')
  let manifest
  try {
    const raw = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    manifest = McpManifestSchema.parse(raw)
  } catch (err) {
    console.error('Failed to read or validate manifest.json. Run validate first.', err.message)
    process.exit(1)
  }

  // Check docker first
  const { checkDockerAvailable } = await import('@agenthub-tools/tool-utils')
  const dockerStatus = await checkDockerAvailable()
  if (!dockerStatus.available) {
    console.error('Docker Desktop doesn\'t appear to be running. Please start Docker Desktop and try again.')
    process.exit(1)
  }

  let newEntrypoint = manifest.entrypoint;
  if (!manifest.dockerfile) {
    const { entryFile, outDir } = await bundleTool(manifest)
    // Update entrypoint to point to the bundled file for the dry-run
    newEntrypoint = [...manifest.entrypoint]
    newEntrypoint[newEntrypoint.length - 1] = `.agenthub-build/${entryFile}`
  }

  console.log('Running dry-run test with Docker...')
  const passed = await runMcpDryRun(process.cwd(), newEntrypoint, manifest)
  if (passed) {
    console.log('Dry-run test PASSED! Tool responded correctly to initialization.')
  } else {
    console.error('Dry-run test FAILED! Tool did not respond correctly to initialization.')
    process.exit(1)
  }
}

async function packageCmd() {
  const manifestPath = path.join(process.cwd(), 'manifest.json')
  let manifest
  try {
    const raw = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    manifest = McpManifestSchema.parse(raw)
  } catch (err) {
    console.error('Failed to read or validate manifest.json. Run validate first.', err.message)
    process.exit(1)
  }

  let entryFile, outFile;
  if (!manifest.dockerfile) {
    ({ entryFile, outFile } = await bundleTool(manifest));
  }

  console.log(`Packaging ${manifest.name} v${manifest.version}...`)
  
  const { default: AdmZip } = await import('adm-zip')
  const ignore = (await import('ignore')).default
  const ig = ignore()
  
  // Default excludes: we ignore node_modules now! Also ignore the source entryFile so we can replace it.
  ig.add(['.git', '.env', '.env.*', '.DS_Store', '*.zip', 'node_modules', '.agenthub-build'])

  try {
    const ignoreContent = await fs.readFile(path.join(process.cwd(), '.agenthubignore'), 'utf8')
    ig.add(ignoreContent)
  } catch (err) {
    // Ignore if not present
  }
  
  const zip = new AdmZip()
  const outName = `${manifest.name}-${manifest.version}.zip`
  const outPath = path.join(process.cwd(), outName)

  console.log('\nIncluded files:')
  
  async function walk(dir, basePath = '') {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const relPath = basePath ? `${basePath}/${entry.name}` : entry.name
      
      // Ignore filter
      if (ig.ignores(relPath)) {
        continue
      }
      
      const fullPath = path.join(dir, entry.name)
      
      if (entry.isDirectory()) {
        await walk(fullPath, relPath)
      } else {
        // Skip the original entryFile because we will add the bundled one later
        if (!manifest.dockerfile && relPath === entryFile) continue;
        
        console.log(`  ${relPath}`)
        zip.addLocalFile(fullPath, basePath)
      }
    }
  }

  await walk(process.cwd())

  // Add the bundled file AS the entryFile in the zip
  if (!manifest.dockerfile) {
    console.log(`  ${entryFile} (bundled)`)
    const zipDir = path.dirname(entryFile) === '.' ? '' : path.dirname(entryFile)
    zip.addLocalFile(outFile, zipDir, path.basename(entryFile))
  }

  zip.writeZip(outPath)
  console.log(`\nSuccessfully packaged tool into ${outName}`)
}

if (cmd === 'validate') {
  validate()
} else if (cmd === 'test') {
  test()
} else if (cmd === 'package') {
  packageCmd()
} else {
  console.error('Usage: agenthub-tool <validate|test|package>')
  process.exit(1)
}
