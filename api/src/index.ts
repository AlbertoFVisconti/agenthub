import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load root .env
config({ path: path.join(__dirname, '../../.env') })
console.log('GITHUB_CLIENT_ID is set:', !!process.env.GITHUB_CLIENT_ID)

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import '@fastify/cookie'
import '@fastify/multipart'
import '@fastify/static'

import sessionPlugin from './plugins/session.js'
import healthRoute from './routes/health.js'
import authRoutes from './routes/auth.js'
import modelsRoutes from './routes/models.js'
import agentRoutes from './routes/agent.js'
import creatorRoutes from './routes/creator.js'
import { historyRoutes } from './routes/history.js'
import dockerRoutes from './routes/docker.js'
import reaperPlugin from './plugins/reaper.js'
import fastifyStatic from '@fastify/static'

const PORT = parseInt(process.env.API_PORT ?? '8081', 10)
const HOST = process.env.API_HOST ?? '0.0.0.0'

async function buildServer() {
  const fastify = Fastify({
    trustProxy: ['127.0.0.1', '::1'],
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  })

  // ── Security ────────────────────────────────────────────────
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  })

  await fastify.register(cors, {
    // In dev, Next.js dev server proxies /api/* so CORS is same-origin.
    // In production, set CORS_ORIGIN env var to the deployed frontend URL.
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  // ── Cookies ─────────────────────────────────────────────────
  await fastify.register(cookie as any, {
    secret: process.env.SESSION_SECRET ?? 'dev-secret-change-me',
  })

  // ── Multipart ───────────────────────────────────────────────
  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max upload
    },
  })

  // ── Session (anonymous user creation on first visit) ─────────
  await fastify.register(sessionPlugin)

  // ── Background Jobs ───────────────────────────────────────────
  await fastify.register(reaperPlugin)

  // ── Network Tab Debugging Hook ────────────────────────────────
  fastify.addHook('onResponse', (request, reply, done) => {
    console.log(`[NETWORK TAB] URL: ${request.url} | Status: ${reply.statusCode} | Content-Type: ${reply.getHeader('content-type') || 'none'}`)
    done()
  })

  // ── Routes ────────────────────────────────────────────────────
  await fastify.register(healthRoute)
  await fastify.register(authRoutes)
  
  if (process.env.DEPLOYMENT_MODE === 'desktop') {
    await fastify.register(modelsRoutes)
    await fastify.register(agentRoutes)
    await fastify.register(dockerRoutes)
    await fastify.register(historyRoutes, { prefix: '/history' })
  }
  
  const marketplaceRoutes = await import('./routes/marketplace.js')
  await fastify.register(marketplaceRoutes.default)
  await fastify.register(creatorRoutes)

  // ── Desktop Static Serving ──────────────────────────────────────
  // If running in Desktop mode, serve the Next.js static export
  const webOutDir = path.resolve(__dirname, '../../web/out')
  console.log(`[DEBUG] Resolving static root to: ${webOutDir}`)

  if (fs.existsSync(webOutDir)) {
    // Serve static files (wildcard: true is default and will serve / -> index.html)
    await fastify.register(fastifyStatic, {
      root: webOutDir,
      extensions: ['html'], // Automatically resolves /marketplace to /marketplace.html
    })
    
    // SPA Fallback: Map the requested path to its actual HTML file,
    // or fallback to index.html for client-side routing if not found.
    // This handler ONLY fires if no Fastify route was matched.
    fastify.setNotFoundHandler((req, reply) => {
      const urlPath = req.url.split('?')[0]

      // Exclude static assets (js, css, png, etc.) from SPA fallback
      const hasExtension = /\.[a-zA-Z0-9]+$/.test(urlPath)
      
      // Only serve HTML fallback if the client explicitly accepts HTML (i.e. browser navigations)
      // Data fetches (fetch/XHR) typically omit text/html or prioritize application/json.
      const acceptsHtml = req.headers.accept?.includes('text/html')

      if (req.method === 'GET' && !hasExtension && acceptsHtml) {
        // Next.js generates [route].html or [route]/index.html
        // Try exact html file first
        const htmlPath = path.join(webOutDir, `${urlPath}.html`)
        if (fs.existsSync(htmlPath)) {
          // Serve the specific page
          // Need to strip leading slash for sendFile relative to root
          const relativePath = `${urlPath.replace(/^\//, '')}.html`
          return (reply as any).sendFile(relativePath)
        }
        
        // Try index.html in directory
        const indexPath = path.join(webOutDir, urlPath, 'index.html')
        if (fs.existsSync(indexPath)) {
          const relativePath = path.posix.join(urlPath.replace(/^\//, ''), 'index.html')
          return (reply as any).sendFile(relativePath)
        }

        // True SPA fallback
        return (reply as any).sendFile('index.html')
      } else {
        reply.status(404).send({ error: 'NOT_FOUND', message: 'Route not found', statusCode: 404 })
      }
    })
  } else {
    // Global 404 if no static files
    fastify.setNotFoundHandler((_req, reply) => {
      reply.status(404).send({ error: 'NOT_FOUND', message: 'Route not found', statusCode: 404 })
    })
  }

  // Global error handler
  fastify.setErrorHandler((error, _req, reply) => {
    fastify.log.error(error)
    const statusCode = error.statusCode ?? 500
    reply.status(statusCode).send({
      error: error.code ?? 'INTERNAL_SERVER_ERROR',
      message: statusCode === 500 ? 'An unexpected error occurred' : error.message,
      statusCode,
    })
  })

  return fastify
}

async function start() {
  const fastify = await buildServer()

  try {
    const bindHost = process.env.DEPLOYMENT_MODE === 'cloud' ? '0.0.0.0' : '127.0.0.1'
    await fastify.listen({ port: PORT, host: bindHost })
    fastify.log.info(`🚀 AgentHub API running on http://${bindHost}:${PORT}`)
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ ERROR: Port ${PORT} is already in use on ${process.env.DEPLOYMENT_MODE === 'cloud' ? '0.0.0.0' : '127.0.0.1'}.`)
      console.error('Make sure no other instances of AgentHub or other services are running on this port.\n')
    } else {
      console.error('\n❌ ERROR: Failed to start API server:', err.message, '\n')
    }
    fastify.log.error(err)
    process.exit(1)
  }
}

if (process.env.NODE_ENV !== 'test') {
  start()
}

export { buildServer }
