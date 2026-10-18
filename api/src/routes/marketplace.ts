import type { FastifyPluginAsync } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import AdmZip from 'adm-zip'
import { eq, and, sql } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { tools, toolVersions, installs } from '../db/schema.js'
import { McpManifestSchema, runMcpDryRun, checkDockerAvailable } from '@agenthub-tools/tool-utils'
import '@fastify/multipart'

const marketplaceRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /marketplace/publish
   * Accepts a multipart form with a `package` field containing the zipped tool.
   */
  fastify.post('/marketplace/publish', async (req, reply) => {
    const data = await (req as any).file()
    if (!data) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'No file uploaded' })
    }

    const userId = req.session?.userId
    if (!userId || req.session?.isAnonymous) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Must be logged in via GitHub to publish tools' })
    }

    const tmpId = crypto.randomUUID()
    const tmpDir = path.join(os.tmpdir(), `agenthub-mcp-${tmpId}`)
    const zipPath = path.join(tmpDir, 'package.zip')
    
    await fs.promises.mkdir(tmpDir, { recursive: true })

    try {
      // 1. Save zip to disk
      const buffer = await data.toBuffer()
      await fs.promises.writeFile(zipPath, buffer)

      // 2. Extract zip
      const zip = new AdmZip(zipPath)
      const extractDir = path.join(tmpDir, 'extracted')
      const entries = zip.getEntries()
      for (const entry of entries) {
        const targetPath = path.resolve(extractDir, entry.entryName)
        if (!targetPath.startsWith(path.resolve(extractDir) + path.sep) && targetPath !== path.resolve(extractDir)) {
          return reply.status(400).send({ error: 'MALICIOUS_PACKAGE', message: 'Package contains path traversal entries' })
        }
      }
      zip.extractAllTo(extractDir, true)

      // 3. Read & Validate manifest
      const manifestPath = path.join(extractDir, 'manifest.json')
      if (!fs.existsSync(manifestPath)) {
        return reply.status(400).send({ error: 'INVALID_PACKAGE', message: 'Missing manifest.json' })
      }
      const rawManifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'))
      const parsedManifest = McpManifestSchema.safeParse(rawManifest)
      
      if (!parsedManifest.success) {
        return reply.status(400).send({ 
          error: 'INVALID_MANIFEST', 
          message: parsedManifest.error.issues.map((i: any) => i.message).join(', ') 
        })
      }
      const manifest = parsedManifest.data

      if (manifest.permissions?.network) {
        return reply.status(400).send({
          error: 'NETWORK_NOT_SUPPORTED',
          message: 'Network-enabled tools are not supported yet â€” this beta only supports fully sandboxed, network-isolated tools.'
        })
      }

      // 4. Store package to uploads directory first (simulating S3)
      const uploadsDir = path.join(process.cwd(), 'uploads', 'tools')
      await fs.promises.mkdir(uploadsDir, { recursive: true })
      const packageFilename = `${manifest.name}-${manifest.version}-${tmpId}.zip`
      const packageUrl = `/uploads/tools/${packageFilename}` // In reality, an S3 URL
      await fs.promises.copyFile(zipPath, path.join(uploadsDir, packageFilename))

      // 5. Build/Test Pipeline
      const isCloud = process.env.DEPLOYMENT_MODE === 'cloud'
      const initialStatus = isCloud && manifest.dockerfile ? 'building' : 'published'

      if (!isCloud) {
        // Desktop mode: dry-run and build locally
        const dockerStatus = await checkDockerAvailable()
        if (!dockerStatus.available) {
          return reply.status(500).send({ 
            error: 'DOCKER_UNAVAILABLE', 
            message: 'Docker Desktop doesn\'t appear to be running. Please start Docker Desktop and try again.' 
          })
        }

        const passed = await runMcpDryRun(extractDir, manifest.entrypoint, manifest)
        if (!passed) {
          return reply.status(400).send({ 
            error: 'DRY_RUN_FAILED', 
            message: 'Tool failed to initialize and respond to MCP handshake in Docker.' 
          })
        }
      }

      // 6. DB Insertion
      let toolId: string
      let forbidden = false
      const db = getDb()

      await db.transaction(async (tx) => {
        // Check if tool exists
        const existing = await tx.select().from(tools).where(eq(tools.slug, manifest.name)).limit(1)
        
        if (existing.length > 0) {
          const tool = existing[0]
          if (tool.ownerId !== userId) {
            forbidden = true
            return
          }
          toolId = tool.id
          
          // Update tool with latest manifest
          await tx.update(tools).set({
            description: manifest.description,
            manifestJson: manifest,
            packageUrl: packageUrl,
            dockerImageRef: manifest.dockerImageRef, // this might be empty initially for cloud, updated via webhook later
            updatedAt: new Date(),
            status: initialStatus
          }).where(eq(tools.id, toolId))
        } else {
          // Create new tool
          const inserted = await tx.insert(tools).values({
            ownerId: userId,
            name: manifest.name,
            slug: manifest.name,
            description: manifest.description,
            manifestJson: manifest,
            packageUrl: packageUrl,
            dockerImageRef: manifest.dockerImageRef,
            status: initialStatus
          }).returning({ id: tools.id })
          toolId = inserted[0].id
        }

        // Insert tool version
        // Delete any existing version record to avoid unique constraint violations on re-publish
        await tx.delete(toolVersions)
          .where(and(eq(toolVersions.toolId, toolId!), eq(toolVersions.version, manifest.version)))

        await tx.insert(toolVersions).values({
          toolId,
          version: manifest.version,
          manifestJson: manifest,
          packageUrl: packageUrl,
          dockerImageRef: manifest.dockerImageRef,
        })
      })

      if (forbidden) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'You do not own this tool' })
      }

      // 7. Trigger GitHub Actions if Cloud
      if (isCloud && manifest.dockerfile) {
        if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO || !process.env.BUILD_CALLBACK_SECRET) {
          req.log.warn('Missing GitHub Actions env vars. Build will not be triggered.')
          return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Cloud build environment not configured properly.' })
        }
        
        // Allow overriding the host URL for local ngrok testing
        const hostUrl = process.env.PUBLIC_API_URL || `${req.protocol}://${req.hostname}`
        const zip_url = `${hostUrl}${packageUrl}`
        const callback_url = `${hostUrl}/marketplace/build-callback`

          const ghBranch = process.env.GITHUB_REF || 'master'
          const ghRes = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO}/actions/workflows/build-tool.yml/dispatches`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ref: ghBranch,
              inputs: {
                tool_name: manifest.name,
                tool_version: manifest.version,
                tool_id: toolId!,
                zip_url,
                callback_url,
                callback_secret: process.env.BUILD_CALLBACK_SECRET,
                entrypoint: JSON.stringify(manifest.entrypoint),
              }
            })
          })
          
          if (!ghRes.ok) {
            const errText = await ghRes.text()
            req.log.error({ response: errText }, 'GitHub Actions trigger failed')
            await db.update(tools).set({
              status: 'rejected',
              buildError: `GitHub Actions trigger failed: ${errText}`,
              updatedAt: new Date()
            }).where(eq(tools.id, toolId!))
            return reply.status(502).send({ error: 'BUILD_TRIGGER_FAILED', message: `GitHub Actions trigger failed: ${errText}` })
          }
        } catch (e: any) {
          req.log.error(e, 'Failed to trigger GitHub Actions')
          await db.update(tools).set({
            status: 'rejected',
            buildError: `Failed to trigger GitHub Actions: ${e?.message || 'Unknown error'}`,
            updatedAt: new Date()
          }).where(eq(tools.id, toolId!))
          return reply.status(502).send({ error: 'BUILD_TRIGGER_FAILED', message: `Failed to trigger GitHub Actions: ${e?.message || 'Unknown error'}` })
        }

        return reply.status(202).send({ success: true, toolId: toolId!, message: 'Tool submitted for building. You will be notified when it is ready.', status: 'building' })
      }

      return reply.send({ success: true, toolId: toolId!, message: 'Tool published successfully', status: 'published' })
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      // Cleanup temp
      await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  })

  /**
   * GET /marketplace/tools
   * List all published tools.
   */
  fastify.get('/marketplace/tools', { config: { skipSession: true } }, async (req, reply) => {
    try {


      const publishedTools = await getDb()
        .select()
        .from(tools)
        .where(eq(tools.status, 'published'))

      return reply.send({ tools: publishedTools })
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to list tools' })
    }
  })

  /**
   * GET /marketplace/installs
   * Get tools installed by the current user.
   */
  fastify.get('/marketplace/installs', async (req, reply) => {
    const userId = req.session?.userId
    if (!userId) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Must be logged in to view installs' })
    }

    try {
      const db = getDb()
      const userInstalls = await db.select({
        toolId: installs.toolId,
        packageUrl: tools.packageUrl,
        manifestJson: tools.manifestJson,
        dockerImageRef: tools.dockerImageRef
      })
      .from(installs)
      .innerJoin(tools, eq(installs.toolId, tools.id))
      .where(eq(installs.userId, userId))

      return reply.send({ installs: userInstalls })
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch installs' })
    }
  })

  /**
   * POST /marketplace/install
   * Record a tool install for the current user.
   */
  fastify.post('/marketplace/install', async (req, reply) => {
    const userId = req.session?.userId
    if (!userId) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Must be logged in (or have an anonymous session) to install tools' })
    }

    const { toolId } = req.body as { toolId?: string }
    if (!toolId) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'toolId is required' })
    }

    try {
      const db = getDb()
      const existing = await db.select().from(tools).where(eq(tools.id, toolId)).limit(1)
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Tool not found' })
      }
      const tool = existing[0]

      if (tool.status !== 'published') {
        return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Tool is not available for installation' })
      }



      // Record the install (ignoring conflict if already installed)
      await db.transaction(async (tx) => {
        const inserted = await tx.insert(installs).values({ toolId, userId }).onConflictDoNothing().returning({ id: installs.id })
        if (inserted.length > 0) {
          await tx.update(tools).set({ installCount: sql`${tools.installCount} + 1` }).where(eq(tools.id, toolId))
        }
      })

      return reply.send({ success: true })
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to install tool' })
    }
  })

  /**
   * DELETE /marketplace/install/:toolId
   * Uninstall a tool for the current user.
   */
  fastify.delete('/marketplace/install/:toolId', async (req, reply) => {
    const userId = req.session?.userId
    if (!userId) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Must be logged in to uninstall tools' })
    }

    const { toolId } = req.params as { toolId: string }
    if (!toolId) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'toolId is required' })
    }

    try {
      const db = getDb()
      const result = await db.delete(installs)
        .where(and(eq(installs.toolId, toolId), eq(installs.userId, userId)))
        .returning()

      if (result.length === 0) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Install not found' })
      }

      // Update install count denormalized field
      await db.update(tools).set({
        installCount: sql`GREATEST(0, ${tools.installCount} - 1)`
      }).where(eq(tools.id, toolId))

      return reply.send({ success: true })
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to uninstall tool' })
    }
  })

  /**
   * GET /uploads/tools/:filename
   * Serves published tool zips.
   */
  fastify.get('/uploads/tools/:filename', { config: { skipSession: true } }, async (req, reply) => {
    const { filename } = req.params as { filename: string }

    // Prevent directory traversal and only serve .zip files
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || !filename.endsWith('.zip')) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Invalid file requested' })
    }

    const uploadsDir = path.join(process.cwd(), 'uploads', 'tools')
    const filePath = path.join(uploadsDir, filename)

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'File not found' })
    }

    const stream = fs.createReadStream(filePath)
    reply.header('Content-Type', 'application/zip')
    return reply.send(stream)
  })

  /**
   * DELETE /marketplace/tools/:id
   * Soft-delete a tool if the user is the owner.
   */
  fastify.delete<{ Params: { id: string } }>('/marketplace/tools/:id', async (req, reply) => {
    try {
      const toolId = req.params.id
      const userId = req.session?.userId

      if (!userId || req.session?.isAnonymous) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Must be logged in to delete tools' })
      }

      const db = getDb()
      const existing = await db.select().from(tools).where(eq(tools.id, toolId)).limit(1)

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Tool not found' })
      }

      if (existing[0].ownerId !== userId) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'You do not own this tool' })
      }

      await db.update(tools).set({
        status: 'removed',
        updatedAt: new Date()
      }).where(eq(tools.id, toolId))

      return reply.send({ success: true })
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to delete tool' })
    }
  })

  /**
   * GET /marketplace/tools/:id/files
   * List files in the tool's package.
   */
  fastify.get<{ Params: { id: string } }>('/marketplace/tools/:id/files', { config: { skipSession: true } }, async (req, reply) => {
    try {
      const db = getDb()
      const existing = await db.select().from(tools).where(eq(tools.id, req.params.id)).limit(1)
      if (existing.length === 0) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Tool not found' })
      const tool = existing[0]

      const { canViewSource } = await import('../lib/permissions.js')
      if (!canViewSource(tool, req.session)) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not allowed to view source for this tool' })
      }

      if (!tool.packageUrl) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Tool package not found' })
      const filename = tool.packageUrl.split('/').pop()
      if (!filename) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Invalid tool package URL' })
      const zipPath = path.join(process.cwd(), 'uploads', 'tools', filename)
      
      if (!fs.existsSync(zipPath)) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Zip file not found on disk' })
      }

      const zip = new AdmZip(zipPath)
      const entries = zip.getEntries()
      const files = entries.filter(e => !e.isDirectory).map(e => ({ name: e.entryName, size: e.header.size }))
      return reply.send({ files })
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to read zip file' })
    }
  })

  /**
   * GET /marketplace/tools/:id/files/*
   * Get raw content of a specific file in the tool's package.
   */
  fastify.get<{ Params: { id: string, '*': string } }>('/marketplace/tools/:id/files/*', { config: { skipSession: true } }, async (req, reply) => {
    try {
      const db = getDb()
      const existing = await db.select().from(tools).where(eq(tools.id, req.params.id)).limit(1)
      if (existing.length === 0) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Tool not found' })
      const tool = existing[0]

      const { canViewSource } = await import('../lib/permissions.js')
      if (!canViewSource(tool, req.session)) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not allowed to view source for this tool' })
      }

      if (!tool.packageUrl) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Tool package not found' })
      const filename = tool.packageUrl.split('/').pop()
      if (!filename) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Invalid tool package URL' })
      const zipPath = path.join(process.cwd(), 'uploads', 'tools', filename)
      
      if (!fs.existsSync(zipPath)) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Zip file not found on disk' })
      }

      const filepath = (req.params as any)['*']
      const zip = new AdmZip(zipPath)
      const entries = zip.getEntries()
      
      // Exact string match against zip entries prevents traversal 
      const entry = entries.find(e => !e.isDirectory && e.entryName === filepath)
      if (!entry) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'File not found in package' })
      }

      const content = zip.readAsText(entry)
      return reply.send({ content })
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to read file from zip' })
    }
  })

  /**
   * POST /marketplace/build-callback
   * Webhook from GitHub Actions to report build result
   */
  fastify.post('/marketplace/build-callback', async (req, reply) => {
    const signature = req.headers['x-hub-signature-256'] as string
    if (!signature || !process.env.BUILD_CALLBACK_SECRET) {
      return reply.status(403).send({ error: 'MISSING_SIGNATURE' })
    }

    const payloadStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    const expected = 'sha256=' + crypto
      .createHmac('sha256', process.env.BUILD_CALLBACK_SECRET)
      .update(payloadStr)
      .digest('hex')

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return reply.status(403).send({ error: 'INVALID_SIGNATURE' })
    }

    const { tool_id, status, docker_image_ref, error } = req.body as any
    const db = getDb()

    if (status === 'success') {
      await db.update(tools)
        .set({
          status: 'published',
          dockerImageRef: docker_image_ref,
          buildError: null,
          updatedAt: new Date(),
        })
        .where(eq(tools.id, tool_id))
    } else {
      await db.update(tools)
        .set({
          status: 'rejected',
          buildError: error || 'Build failed',
          updatedAt: new Date(),
        })
        .where(eq(tools.id, tool_id))
    }

    return reply.send({ ok: true })
  })

  /**
   * GET /marketplace/tools/:id/status
   */
  fastify.get<{ Params: { id: string } }>('/marketplace/tools/:id/status', { config: { skipSession: true } }, async (req, reply) => {
    const { id } = req.params
    const db = getDb()
    const [tool] = await db.select({
      status: tools.status,
      buildError: tools.buildError,
      dockerImageRef: tools.dockerImageRef,
    }).from(tools).where(eq(tools.id, id)).limit(1)

    if (!tool) return reply.status(404).send({ error: 'NOT_FOUND' })
    return reply.send(tool)
  })
}

export default marketplaceRoutes
