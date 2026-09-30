import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildServer } from '../index.js'
import type { FastifyInstance } from 'fastify'
import { getDb } from '../db/index.js'
import { tools, installs } from '../db/schema.js'
import { eq } from 'drizzle-orm'

// Set env before importing anything that reads it
process.env.DATABASE_URL = 'postgresql://agenthub:agenthub@127.0.0.1:5432/agenthub'
process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough-32chars'
process.env.KEY_ENCRYPTION_KEY = 'a'.repeat(64)
process.env.NODE_ENV = 'test'

let app: FastifyInstance
let testToolId: string
let testUserId: string

beforeAll(async () => {
  app = await buildServer()
  await app.ready()

  // Ensure DB is connected and ready
  const db = getDb()

  // First, get a valid user ID by creating an anonymous session
  const meRes = await app.inject({ method: 'GET', url: '/auth/me' })
  const meBody = JSON.parse(meRes.body)
  testUserId = meBody.userId

  // Insert a dummy tool to test installations
  const insertedTool = await db.insert(tools).values({
    ownerId: testUserId,
    name: 'test-tool',
    slug: 'test-tool',
    description: 'A tool for testing',
    manifestJson: { name: 'test-tool', version: '1.0.0' },
    packageUrl: '/uploads/tools/test-tool.zip',
    status: 'published',
    installCount: 0
  }).returning({ id: tools.id })

  testToolId = insertedTool[0].id
})

afterAll(async () => {
  const db = getDb()
  if (testToolId) {
    await db.delete(installs).where(eq(installs.toolId, testToolId))
    await db.delete(tools).where(eq(tools.id, testToolId))
  }
  await app.close()
})

describe('POST /marketplace/publish', () => {
  it('returns 403 FORBIDDEN for anonymous user', async () => {
    // Get anon session
    const meRes = await app.inject({ method: 'GET', url: '/auth/me' })
    const cookie = (meRes.headers['set-cookie'] as string).split(';')[0]

    // Create a mock multipart payload (just testing the auth gate)
    const res = await app.inject({
      method: 'POST',
      url: '/marketplace/publish',
      headers: {
        cookie,
        'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW'
      },
      payload: '------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name="package"; filename="test.zip"\r\nContent-Type: application/zip\r\n\r\nPK\x03\x04\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW--\r\n'
    })
    
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body).error).toBe('FORBIDDEN')
  })

  it('returns 400 BAD_REQUEST if no file uploaded', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/marketplace/publish',
      headers: {
        'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW'
      },
      payload: '------WebKitFormBoundary7MA4YWxkTrZu0gW--\r\n'
    })
    
    // Auth middleware isn't hit if the file parsing fails early, or maybe it is.
    // Based on marketplace.ts, it checks file first.
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toBe('BAD_REQUEST')
  })
})

describe('GET /marketplace/tools', () => {
  it('returns 200 with tools array and does NOT set a session cookie', async () => {
    const res = await app.inject({ method: 'GET', url: '/marketplace/tools' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(Array.isArray(body.tools)).toBe(true)
    expect(res.headers['set-cookie']).toBeUndefined()
  })
})

describe('POST /marketplace/install', () => {
  it('creates anon session and returns 200 for no auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/marketplace/install',
      payload: { toolId: testToolId }
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 400 BAD_REQUEST for missing toolId', async () => {
    const meRes = await app.inject({ method: 'GET', url: '/auth/me' })
    const cookie = (meRes.headers['set-cookie'] as string).split(';')[0]

    const res = await app.inject({
      method: 'POST',
      url: '/marketplace/install',
      headers: { cookie },
      payload: {}
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 NOT_FOUND for non-existent toolId', async () => {
    const meRes = await app.inject({ method: 'GET', url: '/auth/me' })
    const cookie = (meRes.headers['set-cookie'] as string).split(';')[0]

    const res = await app.inject({
      method: 'POST',
      url: '/marketplace/install',
      headers: { cookie },
      payload: { toolId: '00000000-0000-0000-0000-000000000000' }
    })
    expect(res.statusCode).toBe(404)
  })

  it('BUG: installCount increments on duplicate install', async () => {
    const meRes = await app.inject({ method: 'GET', url: '/auth/me' })
    const cookie = (meRes.headers['set-cookie'] as string).split(';')[0]

    // First install
    const res1 = await app.inject({
      method: 'POST',
      url: '/marketplace/install',
      headers: { cookie },
      payload: { toolId: testToolId }
    })
    expect(res1.statusCode).toBe(200)

    // Second install (duplicate)
    const res2 = await app.inject({
      method: 'POST',
      url: '/marketplace/install',
      headers: { cookie },
      payload: { toolId: testToolId }
    })
    expect(res2.statusCode).toBe(200)

    // Check DB for installCount
    const db = getDb()
    const tool = await db.select().from(tools).where(eq(tools.id, testToolId)).limit(1)
    
    // The bug should cause installCount to be 2
    expect(tool[0].installCount).toBe(2)
  })
})

describe('DELETE /marketplace/install/:toolId', () => {
  it('creates anon session and returns 404 NOT_FOUND for no auth (new user has no install)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/marketplace/install/${testToolId}`
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 NOT_FOUND for non-existent install', async () => {
    const meRes = await app.inject({ method: 'GET', url: '/auth/me' })
    const cookie = (meRes.headers['set-cookie'] as string).split(';')[0]

    const res = await app.inject({
      method: 'DELETE',
      url: `/marketplace/install/00000000-0000-0000-0000-000000000000`,
      headers: { cookie }
    })
    expect(res.statusCode).toBe(404)
  })
  
  it('successfully uninstalls', async () => {
    const meRes = await app.inject({ method: 'GET', url: '/auth/me' })
    const cookie = (meRes.headers['set-cookie'] as string).split(';')[0]
    
    // Install first
    await app.inject({
      method: 'POST',
      url: '/marketplace/install',
      headers: { cookie },
      payload: { toolId: testToolId }
    })
    
    // Then uninstall
    const res = await app.inject({
      method: 'DELETE',
      url: `/marketplace/install/${testToolId}`,
      headers: { cookie }
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('GET /marketplace/installs', () => {
  it('creates anon session and returns 200 with empty installs array for no auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/marketplace/installs' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.installs).toEqual([])
  })

  it('returns installs array with auth', async () => {
    const meRes = await app.inject({ method: 'GET', url: '/auth/me' })
    const cookie = (meRes.headers['set-cookie'] as string).split(';')[0]

    const res = await app.inject({
      method: 'GET',
      url: '/marketplace/installs',
      headers: { cookie }
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(Array.isArray(body.installs)).toBe(true)
  })
})

describe('GET /uploads/tools/:filename', () => {
  it('returns 403 FORBIDDEN for directory traversal attempt', async () => {
    const res = await app.inject({ method: 'GET', url: '/uploads/tools/%2e%2e%2fevil.txt' })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 FORBIDDEN for non-zip extension', async () => {
    const res = await app.inject({ method: 'GET', url: '/uploads/tools/test.txt' })
    expect(res.statusCode).toBe(403)
  })

  it('returns 404 NOT_FOUND for non-existent file', async () => {
    const res = await app.inject({ method: 'GET', url: '/uploads/tools/nonexistent.zip' })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /marketplace/tools/:id', () => {
  it('returns 403 FORBIDDEN for anonymous user', async () => {
    const meRes = await app.inject({ method: 'GET', url: '/auth/me' })
    const cookie = (meRes.headers['set-cookie'] as string).split(';')[0]

    const res = await app.inject({
      method: 'DELETE',
      url: `/marketplace/tools/${testToolId}`,
      headers: { cookie }
    })
    expect(res.statusCode).toBe(403)
  })
})
