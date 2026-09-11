import type { FastifyPluginAsync } from 'fastify'
import { checkDbHealth } from '../db/index.js'

const pkg = { version: '0.0.1' } // will read from package.json later

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', {
    // Skip session middleware for health checks
    config: { skipSession: true },
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'degraded', 'error'] },
            version: { type: 'string' },
            db: { type: 'string', enum: ['ok', 'error'] },
            uptime: { type: 'number' },
          },
        },
      },
    },
    handler: async (_req, reply) => {
      const dbOk = await checkDbHealth()
      const status = dbOk ? 'ok' : 'degraded'

      reply.status(dbOk ? 200 : 503)
      return {
        status,
        version: pkg.version,
        db: dbOk ? 'ok' : 'error',
        uptime: process.uptime(),
      }
    },
  })
}

export default healthRoute
