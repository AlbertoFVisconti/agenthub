import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildServer } from '../index.js'
import type { FastifyInstance } from 'fastify'

// Set env before importing anything that reads it
process.env.DATABASE_URL = 'postgresql://agenthub:agenthub@127.0.0.1:5432/agenthub'
process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough-32chars'
process.env.KEY_ENCRYPTION_KEY = 'a'.repeat(64)
process.env.NODE_ENV = 'test'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildServer()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('GET /health', () => {
  it('returns 200 with ok status', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.status).toBe('ok')
    expect(body.db).toBe('ok')
    expect(body.version).toBeDefined()
  })

  it('does NOT set a session cookie (skipSession)', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    const setCookie = res.headers['set-cookie']
    // Health should not create anonymous sessions
    expect(setCookie).toBeUndefined()
  })
})

describe('GET /auth/me', () => {
  it('creates an anonymous session on first visit and returns user info', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.isAnonymous).toBe(true)
    expect(body.userId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(body.email).toBeNull()
    // Cookie must be set
    const cookie = res.headers['set-cookie']
    expect(cookie).toBeDefined()
    expect(String(cookie)).toContain('device_id=')
    expect(String(cookie)).toContain('HttpOnly')
  })

  it('returns the same userId on subsequent requests with the same cookie', async () => {
    // First request — get cookie
    const first = await app.inject({ method: 'GET', url: '/auth/me' })
    const cookieHeader = first.headers['set-cookie'] as string
    const cookie = cookieHeader.split(';')[0] // "device_id=<token>"

    // Second request with cookie
    const second = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { cookie },
    })
    expect(second.statusCode).toBe(200)
    const firstBody = JSON.parse(first.body)
    const secondBody = JSON.parse(second.body)
    expect(secondBody.userId).toBe(firstBody.userId)
  })
})

describe('POST /auth/logout', () => {
  it('clears the session cookie', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/logout' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true })
    const cookie = String(res.headers['set-cookie'] ?? '')
    // Cookie should be cleared (Max-Age=0 or Expires in the past)
    expect(cookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i)
  })
})

