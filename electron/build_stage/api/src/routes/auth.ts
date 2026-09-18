import type { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { getDb, users } from '../db/index.js'
import { SESSION_COOKIE, signSession } from '../lib/auth.js'
import { v4 as uuidv4 } from 'uuid'
import '@fastify/cookie'

// Environment variables needed for OAuth are read dynamically inside routes
// to avoid ES module import hoisting before dotenv.config() runs.

const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /auth/me
   * Returns the current session's user info.
   * Always succeeds — anonymous sessions return isAnonymous: true.
   */
  fastify.get('/auth/me', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            userId:      { type: 'string' },
            isAnonymous: { type: 'boolean' },
            email:       { type: ['string', 'null'] },
            displayName: { type: ['string', 'null'] },
            avatarUrl:   { type: ['string', 'null'] },
            oauthProvider: { type: ['string', 'null'] },
          },
        },
      },
    },
    handler: async (req, reply) => {
      const session = req.session
      if (!session) {
        // Shouldn't happen since session plugin runs first, but guard anyway
        return reply.status(401).send({ error: 'NO_SESSION', message: 'No session found', statusCode: 401 })
      }



      // Fetch full user row for display fields
      const db = getDb()
      const [user] = await db
        .select({
          id:            users.id,
          isAnonymous:   users.isAnonymous,
          email:         users.email,
          displayName:   users.displayName,
          avatarUrl:     users.avatarUrl,
          oauthProvider: users.oauthProvider,
        })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1)

      if (!user) {
        // Session points to a deleted user — clear cookie and let them start fresh
        (reply as any).clearCookie(SESSION_COOKIE, { path: '/' })
        return reply.status(401).send({ error: 'USER_NOT_FOUND', message: 'Session user not found', statusCode: 401 })
      }

      return {
        userId:        user.id,
        isAnonymous:   user.isAnonymous,
        email:         user.email,
        displayName:   user.displayName,
        avatarUrl:     user.avatarUrl,
        oauthProvider: user.oauthProvider,
      }
    },
  })

  /**
   * POST /auth/logout
   * Clears the session cookie. The user row is NOT deleted
   * (anonymous rows expire via the 90-day cleanup job).
   */
  fastify.post('/auth/logout', {
    schema: {
      response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
    },
    handler: async (_req, reply) => {
      (reply as any).clearCookie(SESSION_COOKIE, { path: '/' })
      return { ok: true }
    },
  })

  /**
   * GET /auth/github
   * Redirects the user to GitHub's OAuth authorization page.
   */
  fastify.get('/auth/github', async (req, reply) => {

    
    // Extract desktop specific params if present
    const desktopCallback = req.query && (req.query as any).desktop_callback
    const desktopState = req.query && (req.query as any).state
    
    // Generate state for CSRF protection
    const state = uuidv4()
    
    // Store desktop params in cookie state if present
    const cookieState = desktopCallback ? JSON.stringify({ s: state, dc: desktopCallback, ds: desktopState }) : state;

    (reply as any).setCookie('oauth_state', cookieState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10, // 10 minutes
    })

    const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
    if (!GITHUB_CLIENT_ID) {
      fastify.log.error('GitHub OAuth is not configured. Missing GITHUB_CLIENT_ID.')
      return reply.status(500).send({ error: 'OAuth Not Configured' })
    }

    const host = req.headers['x-forwarded-host'] || req.headers.host
    const proto = req.headers['x-forwarded-proto'] || req.protocol
    const publicUrl = process.env.PUBLIC_URL || (host ? `${proto}://${host}` : 'http://127.0.0.1:8081')

    const redirectUri = `${publicUrl}/auth/github/callback`
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user user:email&state=${state}`
    return reply.redirect(githubUrl)
  })

  /**
   * GET /auth/github/callback
   * Exchanges the OAuth code for a token, fetches user info, and creates a session.
   */
  fastify.get('/auth/github/callback', async (req, reply) => {
    const { code, state } = req.query as { code?: string, state?: string }
    if (!code || !state) {
      return reply.redirect('/?error=Missing_code_or_state')
    }

    const storedStateRaw = (req as any).cookies?.oauth_state
    if (!storedStateRaw) {
      return reply.redirect('/?error=Invalid_state_CSRF_failed')
    }
    
    let expectedState = storedStateRaw
    let desktopCallback: string | null = null
    let desktopState: string | null = null
    try {
      const parsed = JSON.parse(storedStateRaw)
      if (parsed.s) expectedState = parsed.s
      if (parsed.dc) desktopCallback = parsed.dc
      if (parsed.ds) desktopState = parsed.ds
    } catch (e) {}

    if (state !== expectedState) {
      return reply.redirect('/?error=Invalid_state_CSRF_failed')
    }

    // Clear state cookie
    (reply as any).clearCookie('oauth_state', { path: '/' })

    const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
    const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      fastify.log.error('GitHub OAuth is not configured. Missing credentials.')
      return reply.status(500).send({ error: 'OAuth Not Configured' })
    }

    try {
      const publicUrl = process.env.PUBLIC_URL || 'http://127.0.0.1:8081'

      // 1. Exchange code for access token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${publicUrl}/auth/github/callback`
        })
      })
      const tokenData = await tokenRes.json() as any
      const accessToken = tokenData.access_token

      if (!accessToken) {
        throw new Error('Failed to obtain access token')
      }

      // 2. Fetch user profile
      const userRes = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      const userData = await userRes.json() as any
      
      const githubId = String(userData.id)
      const email = userData.email
      const name = userData.name || userData.login
      const avatar = userData.avatar_url

      const db = getDb()
      let userId: string = ''

      // 3. Find existing user by github id and upgrade session inside a transaction
      await db.transaction(async (tx) => {
        let existing = await tx.select().from(users).where(eq(users.oauthId, githubId)).limit(1)

        if (existing.length > 0) {
          userId = existing[0].id
          // Update profile
          await tx.update(users).set({
            email,
            displayName: name,
            avatarUrl: avatar,
            lastActiveAt: new Date()
          }).where(eq(users.id, userId))
        } else {
          // Check if current anonymous session can be upgraded
          const currentSession = req.session
          if (currentSession?.isAnonymous) {
            userId = currentSession.userId
            await tx.update(users).set({
              isAnonymous: false,
              oauthProvider: 'github',
              oauthId: githubId,
              email,
              displayName: name,
              avatarUrl: avatar,
              lastActiveAt: new Date()
            }).where(eq(users.id, userId))
          } else {
            // Create new user
            const inserted = await tx.insert(users).values({
              id: uuidv4(),
              isAnonymous: false,
              oauthProvider: 'github',
              oauthId: githubId,
              email,
              displayName: name,
              avatarUrl: avatar
            }).returning({ id: users.id })
            userId = inserted[0].id
          }
        }
      })

      // 4. Create session
      const payload = { userId, isAnonymous: false }
      const newToken = await signSession(payload);
      
      (reply as any).setCookie(SESSION_COOKIE, newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 90, // 90 days
      })

      // Redirect to dashboard or desktop callback
      if (desktopCallback) {
        const cbUrl = new URL(desktopCallback)
        cbUrl.searchParams.set('token', newToken)
        if (desktopState) cbUrl.searchParams.set('state', desktopState)
        return reply.redirect(cbUrl.toString())
      }

      return reply.redirect('/dashboard')
    } catch (err) {
      req.log.error(err)
      return reply.redirect('/?error=OAuth_failed')
    }
  })
}

export default authRoutes
