import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

export const pendingConfirmations = new Map<string, (approved: boolean) => void>()

const ConfirmBodySchema = z.object({
  callId: z.string().min(1),
  approved: z.union([z.boolean(), z.string()]),
  toolId: z.string().optional(),
  version: z.string().optional(),
})

const agentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/agent/confirm', {
    handler: async (req, reply) => {
      const parsed = ConfirmBodySchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: parsed.error.issues.map(i => i.message).join(', '),
        })
      }

      const { callId, approved, toolId, version } = parsed.data
      const resolver = pendingConfirmations.get(callId)

      if (!resolver) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `No pending confirmation found for callId: ${callId}`,
        })
      }

      let isApproved = false
      if (typeof approved === 'boolean') {
        isApproved = approved
      } else {
        isApproved = approved === 'always' || approved === 'once'
        if (approved === 'always' && toolId && version) {
          const dir = path.join(os.homedir(), '.agenthub')
          const p = path.join(dir, 'tool-permissions.json')
          let perms: Record<string, string> = {}
          try {
            await fs.mkdir(dir, { recursive: true })
            perms = JSON.parse(await fs.readFile(p, 'utf8'))
          } catch {}
          perms[`${toolId}@${version}`] = 'allowed'
          await fs.writeFile(p, JSON.stringify(perms, null, 2), 'utf8')
        }
      }

      resolver(isApproved)
      pendingConfirmations.delete(callId)

      return reply.send({ ok: true })
    },
  })
}

export default agentRoutes
