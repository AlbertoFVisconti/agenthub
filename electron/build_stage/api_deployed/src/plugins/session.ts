import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/index.js'
import { users } from '../db/schema.js'
import fastifyCookie from '@fastify/cookie'
import '@fastify/cookie'
import { signSession, verifySession, SESSION_COOKIE } from '../lib/auth.js'
import type { SessionPayload } from '../lib/auth.js'

declare module 'fastify' {
  interface FastifyRequest {
    session: SessionPayload | null
    // Raw API key from Authorization: Bearer header (anonymous users only)
    anonymousApiKey: string | null
  }
  interface FastifyContextConfig {
    skipSession?: boolean
  }
}

const sessionPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('session', null)
  fastify.decorateRequest('anonymousApiKey', null)

  fastify.addHook('preValidation', async (req, reply) => {
    // If route explicitly opts out of session check, skip
    if (req.routeOptions.config.skipSession) {
      return
    }



    // Extract anonymous API key from Authorization header if present
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      req.anonymousApiKey = authHeader.slice(7).trim() || null
    }

    const token = (req as any).cookies?.[SESSION_COOKIE]
    
    // TEMPORARY LOGGING
    if (req.url === '/auth/me') {
      req.log.info({
        url: req.url,
        allCookies: Object.keys((req as any).cookies || {}),
        expectedCookieName: SESSION_COOKIE,
        tokenFound: !!token
      }, '[TRACE] Checking cookies for /auth/me')
    }

    if (token) {
      const payload = await verifySession(token)
      if (payload) {
        req.session = payload
        // Refresh cookie TTL on every request (sliding expiry)
        const newToken = await signSession(payload);
        (reply as any).setCookie(SESSION_COOKIE, newToken, cookieOptions())
        // Bump last_active_at without blocking the request
        getDb()
          .update(users)
          .set({ lastActiveAt: new Date() })
          .where(
            (await import('drizzle-orm')).eq(users.id, payload.userId),
          )
          .catch(() => {/* non-fatal */})
        return
      }
    }

    // No valid session — create an anonymous user row
    const db = getDb()
    const [newUser] = await db
      .insert(users)
      .values({ id: uuidv4(), isAnonymous: true })
      .returning({ id: users.id })

    const payload: SessionPayload = { userId: newUser.id, isAnonymous: true }
    const newToken = await signSession(payload);

    (reply as any).setCookie(SESSION_COOKIE, newToken, cookieOptions())
    req.session = payload

    req.log.info({ userId: newUser.id }, 'Created anonymous session')
  })
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 90, // 90 days
  }
}

export default fp(sessionPlugin, { name: 'session', dependencies: ['@fastify/cookie'] })
