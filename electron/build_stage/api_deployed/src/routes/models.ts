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
  provider:     z.enum(['anthropic', 'openai', 'google', 'custom']),
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
  baseUrl:      z.string().optional(),
})

const modelsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /models/catalogue
   * Returns the list of available models â€” no auth needed.
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
   *   {type:"token", content}                         â€” model text token
   *   {type:"tool_start", call}                       â€” about to call a tool
   *   {type:"tool_result", callId, content, isError}  â€” tool returned
   *   {type:"turn_done", usage, turnIndex}             â€” one model turn done
   *   {type:"done", totalUsage, turns}                 â€” entire run finished
   *   {type:"error", message}                          â€” fatal error
   *
   * Anonymous users: pass API key as  Authorization: Bearer <key>
   * Authed users:    key fetched from encrypted vault automatically
   */
  fastify.post('/models/chat', {
    handler: async (req, reply) => {
      const isDesktop = process.env.DEPLOYMENT_MODE === 'desktop'
      const session = req.session
      
      if (!session && !isDesktop) {
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

      const { provider, model, messages, systemPrompt, maxTokens, maxTurns, workspacePath, baseUrl } = parsed.data

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

      req.log.debug({
        hasWorkspacePath: !!workspacePath,
        userId: req.session?.userId,
        deploymentMode: process.env.DEPLOYMENT_MODE,
        willLoadTools: !!(req.session?.userId || process.env.DEPLOYMENT_MODE === 'desktop')
      }, '[TRACE] Evaluating marketplace tools block')

      // Load user's installed marketplace tools
      if (req.session?.userId || process.env.DEPLOYMENT_MODE === 'desktop') {
        try {
          let userInstalls: { toolId: string, packageUrl: string | null, manifestJson: unknown }[] = []

          if (process.env.DEPLOYMENT_MODE === 'desktop') {
            const CLOUD_API_URL = process.env.API_URL || 'https://p01--agenthub--4cwccydynvym.code.run'
            try {
              const res = await fetch(`${CLOUD_API_URL}/marketplace/installs`, {
                headers: {
                  cookie: req.headers.cookie || ''
                }
              })
              if (!res.ok) {
                const text = await res.text().catch(() => '')
                req.log.error({ status: res.status, text }, 'Failed to fetch installs from Cloud API')
              } else {
                const data = await res.json() as any
                userInstalls = data.installs || []
              }
            } catch (err) {
              req.log.error({ err }, 'Network error fetching installs from Cloud API')
            }
          } else {
            if (!req.session) {
              return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Session required in cloud mode' })
            }
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

          req.log.debug({ userInstallsLength: userInstalls.length }, '[TRACE] Loaded user installs')

          const fs = await import('node:fs/promises')
          const fsSync = await import('node:fs')
          const path = await import('node:path')
          const os = await import('node:os')
          const { default: AdmZip } = await import('adm-zip')

          let dockerLimits: { memory?: string, cpu?: string } = {}
          if (process.env.DEPLOYMENT_MODE === 'desktop') {
            try {
              const baseDir = path.join(os.homedir(), '.agenthub')
              dockerLimits = JSON.parse(await fs.readFile(path.join(baseDir, 'docker-settings.json'), 'utf8'))
            } catch {}
          }

          for (const inst of userInstalls) {
            if (!inst.manifestJson || !(inst.manifestJson as any).entrypoint) continue

            const manifest = inst.manifestJson as any
            const toolVersion = manifest.version || '0.0.0'
            const toolDir = path.join(os.homedir(), '.agenthub', 'tools', `${inst.toolId}-${toolVersion}`)
            
            if (process.env.DEPLOYMENT_MODE === 'desktop') {
              try {
                if (!fsSync.existsSync(toolDir)) {
                  const CLOUD_API_URL = process.env.API_URL || 'https://p01--agenthub--4cwccydynvym.code.run'
                  const dlRes = await fetch(`${CLOUD_API_URL}${inst.packageUrl}`)
                  if (!dlRes.ok) {
                    req.log.error({ status: dlRes.status, url: inst.packageUrl }, 'Failed to download tool zip')
                    continue
                  }
                  
                  const buffer = Buffer.from(await dlRes.arrayBuffer())
                  const tmpZip = path.join(os.tmpdir(), `agenthub-tool-${inst.toolId}-${Date.now()}.zip`)
                  await fs.writeFile(tmpZip, buffer)
                  
                  const zip = new AdmZip(tmpZip)
                  zip.extractAllTo(toolDir, true)
                  await fs.rm(tmpZip, { force: true })
                  req.log.debug({ toolId: inst.toolId, version: toolVersion, dir: toolDir }, 'Extracted tool to local cache')
                }
              } catch (err) {
                req.log.error({ err, toolId: inst.toolId }, 'Failed to download or extract tool package')
                continue
              }
            }
            
            executorsList.push(new StdioMcpExecutor({ 
              image: manifest.name,
              toolDir: process.env.DEPLOYMENT_MODE === 'desktop' ? toolDir : undefined,
              entrypoint: manifest.entrypoint,
              workspacePath: workspacePath,
              toolId: inst.toolId,
              toolVersion: toolVersion,
              memoryLimit: dockerLimits.memory,
              cpuLimit: dockerLimits.cpu,
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
        } catch (err) {
          req.log.error(err, 'Failed to load user installs')
        }
      }

      if (executorsList.length > 0) {
        executor = new CompositeExecutor(executorsList)
      }

      try {
        const allToolsForLog = await executor.listTools()
        req.log.debug({ toolNames: allToolsForLog.map(t => t.name) }, 'tools sent to model')
      } catch (err) {
        req.log.error({ err }, 'Failed to list/merge tools before starting model')
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
        req.log.warn({ model }, 'Unknown model ID â€” passing through to provider')
      }

      const activeUserId = session ? session.userId : 'desktop-user'
      const activeIsAnonymous = session ? session.isAnonymous : true

      req.log.debug({
        deploymentMode: process.env.DEPLOYMENT_MODE,
        provider,
        userId: activeUserId,
        isAnonymous: activeIsAnonymous,
        authorizationHeaderPresent: !!req.anonymousApiKey
      }, '[TRACE] /models/chat resolving API key')

      const apiKey = await resolveApiKey({
        isAnonymous: activeIsAnonymous,
        userId:      activeUserId,
        provider:    provider as ModelProvider,
        headerKey:   req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : null,
      })

      req.log.debug({
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
          systemPrompt, maxTokens, maxTurns, baseUrl,
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

