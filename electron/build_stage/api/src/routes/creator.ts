import type { FastifyPluginAsync } from 'fastify'
import { eq, desc, and, gte } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { tools, toolEvents } from '../db/schema.js'

const creatorRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /creator/tools
   * List tools owned by the logged-in user
   */
  fastify.get('/creator/tools', async (req, reply) => {
    const userId = req.session?.userId
    if (!userId || req.session?.isAnonymous) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Must be logged in to view dashboard' })
    }

    try {
      const userTools = await getDb()
        .select()
        .from(tools)
        .where(eq(tools.ownerId, userId))
        .orderBy(desc(tools.createdAt))

      return reply.send({ tools: userTools })
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch tools' })
    }
  })

  /**
   * GET /creator/tools/:id/metrics
   * Get install count and event metrics for a specific tool
   */
  fastify.get('/creator/tools/:id/metrics', async (req, reply) => {
    const userId = req.session?.userId
    if (!userId || req.session?.isAnonymous) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Must be logged in to view metrics' })
    }

    const { id } = req.params as { id: string }
    
    try {
      const db = getDb()
      
      // Verify ownership
      const existing = await db.select().from(tools).where(eq(tools.id, id)).limit(1)
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Tool not found' })
      }
      if (existing[0].ownerId !== userId) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'You do not own this tool' })
      }

      // Fetch events from the last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const events = await db
        .select({
          eventType: toolEvents.eventType,
          createdAt: toolEvents.createdAt
        })
        .from(toolEvents)
        .where(
          and(
            eq(toolEvents.toolId, id),
            gte(toolEvents.createdAt, thirtyDaysAgo)
          )
        )

      // Aggregate metrics
      let invocations = 0
      let errors = 0
      
      for (const ev of events) {
        if (ev.eventType === 'invoke') invocations++
        if (ev.eventType === 'error') errors++
      }

      return reply.send({ 
        installCount: existing[0].installCount,
        invocations30d: invocations,
        errors30d: errors
      })
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch metrics' })
    }
  })
}

export default creatorRoutes
