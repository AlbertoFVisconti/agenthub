import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

// Global map to hold pending tool confirmations across requests.
// Key: callId, Value: resolver function
// NOTE (Known Limitation): This in-memory state will be lost if the server restarts
// or if running behind a load balancer with multiple instances (Phases 8/9).
// Fine for Phase 10 (local single-process Tauri) and dev.
export const pendingConfirmations = new Map<string, (approved: boolean) => void>()

const ConfirmBodySchema = z.object({
  callId: z.string().min(1),
  approved: z.boolean(),
})

const agentRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /agent/confirm
   * Resolves a paused tool execution waiting for user confirmation.
   */
  fastify.post('/agent/confirm', {
    handler: async (req, reply) => {
      const parsed = ConfirmBodySchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: parsed.error.issues.map(i => i.message).join(', '),
        })
      }

      const { callId, approved } = parsed.data
      const resolver = pendingConfirmations.get(callId)

      if (!resolver) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `No pending confirmation found for callId: ${callId}`,
        })
      }

      // Resolve the promise in the loop
      resolver(approved)
      pendingConfirmations.delete(callId)

      return reply.send({ ok: true })
    },
  })
}

export default agentRoutes
