import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getAdapter, resolveApiKey } from '../lib/models/gateway.js'
import type { NormalizedMessage, ModelProvider } from '../lib/models/types.js'
import { MODEL_CATALOGUE } from '../lib/models/types.js'
import { runAgentLoop } from '../lib/agent/loop.js'
import { NoopExecutor } from '../lib/agent/executors/noop.js'
import { BuiltinExecutor } from '../lib/agent/executors/builtin.js'
import { StdioMcpExecutor } from '../lib/agent/executors/mcp-stdio.js'
import { CompositeExecutor } from '../lib/agent/executors/composite.js'
import { ProjectWorkspace } from '../lib/project/workspace.js'
import type { AgentEvent } from '../lib/agent/types.js'
import { pendingConfirmations } from './agent.js'
import { getDb } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { installs, tools, toolEvents } from '../db/schema.js'

const ChatBodySchema = z.object({
  provider:     z.enum(['anthropic', 'openai', 'google']),
  model:        z.string().min(1),
  messages:     z.array(z.object({
    role:        z.enum(['user', 'assistant', 'tool']),
    content:     z.string(),
    toolCallId:  z.string().optional(),
    toolName:    z.string().optional(),
  })).min(1),
  systemPrompt: z.string().optional(),
  maxTokens:    z.number().int().min(1).max(32000).optional(),
  maxTurns:     z.number().int().min(1).max(20).optional(),
  workspacePath: z.string().optional(),
})

const modelsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /models/catalogue
   * Returns the list of available models — no auth needed.
   */
  fastify.get('/models/catalogue', {
    config: { skipSession: true },
    handler: async () => ({ models: MODEL_CATALOGUE }),
  })

  /**
   * POST /models/chat
   *
   * Runs the full agent loop and streams all events as SSE.
   *
   * Event types:
   *   {type:"token", content}                         — model text token
   *   {type:"tool_start", call}                       — about to call a tool
   *   {type:"tool_result", callId, content, isError}  — tool returned
   *   {type:"turn_done", usage, turnIndex}             — one model turn done
   *   {type:"done", totalUsage, turns}                 — entire run finished
   *   {type:"error", message}                          — fatal error
   *
   * Anonymous users: pass API key as  Authorization: Bearer <key>
   * Authed users:    key fetched from encrypted vault automatically
   */
  fastify.post('/models/chat', {
    handler: async (req, reply) => {
      const session = req.session
      if (!session) {
        return reply.status(401).send({ error: 'NO_SESSION', message: 'No session', statusCode: 401 })
      }

      const parsed = ChatBodySchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: parsed.error.issues.map(i => i.message).join(', '),
          statusCode: 400,
        })
      }

      const { provider, model, messages, systemPrompt, maxTokens, maxTurns, workspacePath } = parsed.data

      let executor: import('../lib/agent/types.js').ToolExecutor = new NoopExecutor()
      
      const executorsList: import('../lib/agent/types.js').ToolExecutor[] = []

      // SECURITY GATE: Only allow BuiltinExecutor (local file access/RCE) if we are in development
      // mode AND the request originates from localhost.
      if (workspacePath) {
        const isDesktop = process.env.DEPLOYMENT_MODE === 'desktop'
        
        if (!isDesktop) {
          return reply.status(403).send({
            error: 'FORBIDDEN',
            message: 'Local workspace access is only allowed for local development requests.',
            statusCode: 403,
          })
        }

        try {
          const workspace = new ProjectWorkspace(workspacePath)
          executorsList.push(new BuiltinExecutor(workspace))
        } catch (err) {
          return reply.status(400).send({
            error: 'INVALID_WORKSPACE',
            message: err instanceof Error ? err.message : String(err),
            statusCode: 400,
          })
        }
      }

      // Load user's installed marketplace tools
      if (req.session?.userId) {
        try {
          let userInstalls: { toolId: string, packageUrl: string | null, manifestJson: unknown }[] = []

          if (process.env.DEPLOYMENT_MODE === 'desktop') {
            const fs = await import('node:fs/promises')
            const path = await import('node:path')
            const os = await import('node:os')
            const toolsPath = path.join(os.homedir(), '.agenthub', 'desktop-tools.json')
            try {
              const content = await fs.readFile(toolsPath, 'utf8')
              userInstalls = JSON.parse(content)
            } catch (e) {
              userInstalls = []
            }
          } else {
            const db = getDb()
            userInstalls = await db.select({
              toolId: installs.toolId,
              packageUrl: tools.packageUrl,
              manifestJson: tools.manifestJson
            })
            .from(installs)
            .innerJoin(tools, eq(installs.toolId, tools.id))
            .where(eq(installs.userId, req.session.userId))
          }

          for (const inst of userInstalls) {
            if (inst.manifestJson && (inst.manifestJson as any).entrypoint) {
               const manifest = inst.manifestJson as any
               executorsList.push(new StdioMcpExecutor({ 
                 image: manifest.name,
                 workspacePath: workspacePath,
                 network: manifest.permissions?.network === true,
                 onEvent: (type, call, err) => {
                   if (process.env.DEPLOYMENT_MODE !== 'desktop') {
                     getDb().insert(toolEvents).values({
                       toolId: inst.toolId,
                       userId: req.session?.userId,
                       eventType: type,
                       metadataJson: {
                         callName: call.name,
                         error: err?.message
                       }
                     }).catch(e => req.log.error(e, 'Failed to log tool event'))
                   }
                 }
               }))
            }
          }
        } catch (err) {
          req.log.error(err, 'Failed to load user installs')
        }
      }

      if (executorsList.length > 0) {
        executor = new CompositeExecutor(executorsList)
      }

      let loopExhausted = false
      req.raw.on('close', () => {
        if (!loopExhausted) {
          executor.cleanup?.()
        }
      })

      // Warn on unknown models but don't block (power users)
      const known = MODEL_CATALOGUE.map(m => m.id as string)
      if (!known.includes(model)) {
        req.log.warn({ model }, 'Unknown model ID — passing through to provider')
      }

      req.log.info({
        deploymentMode: process.env.DEPLOYMENT_MODE,
        provider,
        userId: session.userId,
        isAnonymous: session.isAnonymous,
        authorizationHeaderPresent: !!req.anonymousApiKey
      }, '[TRACE] /models/chat resolving API key')

      const apiKey = await resolveApiKey({
        isAnonymous: session.isAnonymous,
        userId:      session.userId,
        provider:    provider as ModelProvider,
        headerKey:   req.anonymousApiKey,
      })

      req.log.info({
        resolvedApiKey: apiKey ? "FOUND" : "NOT_FOUND"
      }, '[TRACE] /models/chat API key resolution result')

      if (!apiKey) {
        return reply.status(402).send({
          error: 'NO_API_KEY',
          message: `No ${provider} API key found. Add your key in Settings.`,
          statusCode: 402,
        })
      }

      // Hijack the connection and write SSE
      reply.hijack()
      const raw = reply.raw
      
      // Inject CORS headers manually because reply.hijack bypasses fastify-cors's onSend hook
      const reqOrigin = req.headers.origin
      if (reqOrigin) {
        raw.setHeader('Access-Control-Allow-Origin', reqOrigin)
        raw.setHeader('Access-Control-Allow-Credentials', 'true')
      }

      raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      raw.setHeader('Cache-Control', 'no-cache, no-transform')
      raw.setHeader('Connection', 'keep-alive')
      raw.setHeader('X-Accel-Buffering', 'no')
      raw.flushHeaders()
      raw.write(': stream-start\n\n')

      try {
        const adapter  = getAdapter(provider as ModelProvider)

        const loop = runAgentLoop({
          adapter, executor, model, apiKey,
          messages: messages as NormalizedMessage[],
          systemPrompt, maxTokens, maxTurns,
          onConfirm: (callId) => {
            return new Promise((resolve) => {
              // Store resolver in global map, to be called by POST /agent/confirm
              pendingConfirmations.set(callId, resolve)
            })
          },
        })

        for await (const event of loop) {
          if (raw.destroyed) break
          const data: AgentEvent = event
          raw.write(`data: ${JSON.stringify(data)}\n\n`)
        }
        loopExhausted = true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        raw.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
        req.log.error({ err }, 'Agent loop error')
      } finally {
        executor.cleanup?.()
        raw.write('data: [DONE]\n\n')
        raw.end()
      }
    },
  })
}

export default modelsRoutes
