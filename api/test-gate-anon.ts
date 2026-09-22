import { buildServer } from './src/index.js'
import { getDb } from './src/db/index.js'
import { tools, users } from './src/db/schema.js'
import { eq } from 'drizzle-orm'
import fs from 'node:fs/promises'
import path from 'node:path'
import FormData from 'form-data'

process.env.DATABASE_URL = 'postgresql://agenthub:agenthub@127.0.0.1:5432/agenthub'
process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough-32chars'
process.env.KEY_ENCRYPTION_KEY = 'a'.repeat(64)
process.env.NODE_ENV = 'test'

async function run() {
  const app = await buildServer()
  await app.ready()
  const db = getDb()

  // Pre-test: count total users
  const beforeUsers = await db.select().from(users)
  console.log(`Users before test: ${beforeUsers.length}`)

  // Fetch an existing tool instead of publishing
  const existingTools = await db.select().from(tools).limit(1)
  if (existingTools.length === 0) {
    console.log('No tools found in DB to test. Run test-gate.ts first.')
    await app.close()
    return
  }
  const toolId = existingTools[0].id
  
  // Ensure it's verified
  await db.update(tools).set({ verified: true }).where(eq(tools.id, toolId))
  console.log(`Using existing verified tool: ${toolId}`)

  console.log('\n--- Step 1: Attempt view source with ZERO cookies ---')
  const filesRes = await app.inject({
    method: 'GET',
    url: `/marketplace/tools/${toolId}/files`
    // NO headers (no cookies)
  })
  console.log('Anonymous Files status:', filesRes.statusCode)

  console.log('\n--- Step 2: Check if a new user was created ---')
  const afterUsers = await db.select().from(users)
  console.log(`Users after test: ${afterUsers.length}`)
  console.log(`New users created: ${afterUsers.length - beforeUsers.length}`)

  await app.close()
}

run().catch(console.error)
