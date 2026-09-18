import { buildApp } from './src/index.js'
import { getDb } from './src/db/index.js'
import { tools } from './src/db/schema.js'
import fs from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'

async function runTest() {
  const app = await buildApp()
  const db = getDb()

  const uploadsDir = path.join(process.cwd(), 'uploads', 'tools')
  await fs.promises.mkdir(uploadsDir, { recursive: true })

  const zipPath = path.join(uploadsDir, 'test-source.zip')
  const zip = new AdmZip()
  zip.addFile('manifest.json', Buffer.from(JSON.stringify({ name: 'test-source', version: '1.0.0' })))
  zip.addFile('index.js', Buffer.from('console.log("hello world")'))
  zip.writeZip(zipPath)

  const [tool] = await db.insert(tools).values({
    name: 'Test Source Tool',
    description: 'A tool for testing view source',
    slug: 'test-source-' + Date.now(),
    version: '1.0.0',
    ownerId: 1,
    status: 'published',
    packageUrl: '/uploads/tools/test-source.zip'
  }).returning()

  console.log('--- GET /marketplace/tools/:id/files ---')
  let res = await app.inject({ method: 'GET', url: `/api/marketplace/tools/${tool.id}/files` })
  console.log(res.statusCode, res.json())

  console.log('\n--- GET /marketplace/tools/:id/files/manifest.json ---')
  res = await app.inject({ method: 'GET', url: `/api/marketplace/tools/${tool.id}/files/manifest.json` })
  console.log(res.statusCode, res.json())

  console.log('\n--- Path Traversal Attempt: GET /marketplace/tools/:id/files/../../.env ---')
  res = await app.inject({ method: 'GET', url: `/api/marketplace/tools/${tool.id}/files/..%2F..%2F.env` })
  console.log(res.statusCode, res.json())

  // Clean up
  await db.update(tools).set({ status: 'removed' }).where({ id: tool.id })
  
  process.exit(0)
}

runTest().catch(console.error)
