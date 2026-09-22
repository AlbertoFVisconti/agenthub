import { buildServer } from './src/index.js'
import { getDb } from './src/db/index.js'
import { tools, installs } from './src/db/schema.js'
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

  console.log('--- Step 0: Create two sessions ---')
  const resOwner = await app.inject({ method: 'GET', url: '/auth/me' })
  const cookieOwner = (resOwner.headers['set-cookie'] as string).split(';')[0]
  const ownerId = JSON.parse(resOwner.body).userId
  console.log('Owner ID:', ownerId)
  
  const { signSession } = await import('./src/lib/auth.js')
  const newCookieOwner = `device_id=${await signSession({ userId: ownerId, isAnonymous: false })}`

  const resOther = await app.inject({ method: 'GET', url: '/auth/me' })
  const cookieOther = (resOther.headers['set-cookie'] as string).split(';')[0]
  const otherId = JSON.parse(resOther.body).userId
  console.log('Other ID:', otherId)

  console.log('\n--- Step 1: Publish unverified tool ---')
  const zipPath = path.join(process.cwd(), '..', '..', 'test-tool', 'python-test-1.0.0.zip')
  const zipBuffer = await fs.readFile(zipPath)
  
  const form = new FormData()
  form.append('package', zipBuffer, { filename: 'package.zip', contentType: 'application/zip' })
  
  const publishRes = await app.inject({
    method: 'POST',
    url: '/marketplace/publish',
    headers: { ...form.getHeaders(), cookie: newCookieOwner },
    payload: form.getBuffer()
  })
  
  console.log('Publish status:', publishRes.statusCode)
  const publishBody = JSON.parse(publishRes.body)
  console.log('Publish response:', publishBody)
  
  const toolId = publishBody.toolId
  
  const toolRecord = await db.select().from(tools).where(eq(tools.id, toolId))
  console.log('DB Verified status:', toolRecord[0].verified)
  
  console.log('\n--- Step 2: Attempt install from DIFFERENT account (should fail 403) ---')
  const installRes1 = await app.inject({
    method: 'POST',
    url: '/marketplace/install',
    headers: { cookie: cookieOther },
    payload: { toolId }
  })
  console.log('Install status:', installRes1.statusCode)
  console.log('Install response:', JSON.parse(installRes1.body))
  
  console.log('\n--- Step 3: Attempt view source from DIFFERENT account (should fail 403) ---')
  const filesRes1 = await app.inject({
    method: 'GET',
    url: `/marketplace/tools/${toolId}/files`,
    headers: { cookie: cookieOther }
  })
  console.log('Files status:', filesRes1.statusCode)
  console.log('Files response:', JSON.parse(filesRes1.body))

  console.log('\n--- Step 4: Attempt install & view source from OWNER (should succeed) ---')
  const installRes2 = await app.inject({
    method: 'POST',
    url: '/marketplace/install',
    headers: { cookie: newCookieOwner },
    payload: { toolId }
  })
  console.log('Owner Install status:', installRes2.statusCode)
  
  const filesRes2 = await app.inject({
    method: 'GET',
    url: `/marketplace/tools/${toolId}/files`,
    headers: { cookie: newCookieOwner }
  })
  console.log('Owner Files status:', filesRes2.statusCode)

  console.log('\n--- Step 5: Downgrade scenario ---')
  console.log('Flipping verified to TRUE for Other user to install...')
  await db.update(tools).set({ verified: true }).where(eq(tools.id, toolId))
  
  const installRes3 = await app.inject({
    method: 'POST',
    url: '/marketplace/install',
    headers: { cookie: cookieOther },
    payload: { toolId }
  })
  console.log('Other user install after verify:', installRes3.statusCode)

  console.log('Flipping verified back to FALSE...')
  await db.update(tools).set({ verified: false }).where(eq(tools.id, toolId))
  
  console.log('Checking /marketplace/installs for Other user...')
  const installsRes = await app.inject({
    method: 'GET',
    url: '/marketplace/installs',
    headers: { cookie: cookieOther }
  })
  const installsBody = JSON.parse(installsRes.body)
  console.log('Installs returned for Other user (expecting 0 for this tool):', installsBody.installs.filter((i: any) => i.toolId === toolId).length)

  await app.close()
}

run().catch(console.error)
