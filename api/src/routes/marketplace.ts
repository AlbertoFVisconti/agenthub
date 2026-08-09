import type { FastifyPluginAsync } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import AdmZip from 'adm-zip'
import { eq, and, sql } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { tools, toolVersions, installs } from '../db/schema.js'
import { McpManifestSchema } from '../lib/mcp/manifest.js'
import { runMcpDryRun } from '../lib/mcp/dry-run.js'
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
          message: parsedManifest.error.issues.map(i => i.message).join(', ') 
        })
      }
      const manifest = parsedManifest.data

      // 4. Docker Dry-Run
      const passed = await runMcpDryRun(extractDir, manifest.entrypoint)
      if (!passed) {
        return reply.status(400).send({ 
          error: 'DRY_RUN_FAILED', 
          message: 'Tool failed to initialize and respond to MCP handshake in Docker.' 
        })
      }

      // 5. Store package to uploads directory (simulating S3)
      const uploadsDir = path.join(process.cwd(), 'uploads', 'tools')
      await fs.promises.mkdir(uploadsDir, { recursive: true })
      const packageFilename = `${manifest.name}-${manifest.version}-${tmpId}.zip`
      const packageUrl = `/uploads/tools/${packageFilename}` // In reality, an S3 URL
      await fs.promises.copyFile(zipPath, path.join(uploadsDir, packageFilename))

      // 6. DB Insertion
      let toolId: string
      const db = getDb()

      // Check if tool exists
      const existing = await db.select().from(tools).where(eq(tools.slug, manifest.name)).limit(1)
      
      if (existing.length > 0) {
        const tool = existing[0]
        if (tool.ownerId !== userId) {
          return reply.status(403).send({ error: 'FORBIDDEN', message: 'You do not own this tool' })
        }
        toolId = tool.id
        
        // Update tool with latest manifest
        await db.update(tools).set({
          description: manifest.description,
          manifestJson: manifest,
          packageUrl: packageUrl,
          updatedAt: new Date(),
          status: 'published'
        }).where(eq(tools.id, toolId))
      } else {
        // Create new tool
        const inserted = await db.insert(tools).values({
          ownerId: userId,
          name: manifest.name,
          slug: manifest.name,
          description: manifest.description,
          manifestJson: manifest,
          packageUrl: packageUrl,
          status: 'published'
        }).returning({ id: tools.id })
        toolId = inserted[0].id
      }

      // Insert tool version
      await db.insert(toolVersions).values({
        toolId,
        version: manifest.version,
        manifestJson: manifest,
        packageUrl: packageUrl,
      })

      return reply.send({ success: true, toolId, message: 'Tool published successfully' })
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
  fastify.get('/marketplace/tools', async (req, reply) => {
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

      if (process.env.DEPLOYMENT_MODE === 'desktop') {
        const fs = await import('node:fs/promises')
        const path = await import('node:path')
        const os = await import('node:os')
        const toolsPath = path.join(os.homedir(), '.agenthub', 'desktop-tools.json')
        await fs.mkdir(path.dirname(toolsPath), { recursive: true })
        
        let userInstalls = []
        try {
          const content = await fs.readFile(toolsPath, 'utf8')
          userInstalls = JSON.parse(content)
        } catch (e) {
          userInstalls = []
        }
        
        if (!userInstalls.some((i: any) => i.toolId === toolId)) {
          userInstalls.push({
            toolId,
            packageUrl: tool.packageUrl,
            manifestJson: tool.manifestJson
          })
          await fs.writeFile(toolsPath, JSON.stringify(userInstalls, null, 2))
        }
        return reply.send({ success: true })
      }

      // Record the install (ignoring conflict if already installed)
      await db.insert(installs).values({
        toolId,
        userId
      }).onConflictDoNothing() // Assuming userToolIdx unique constraint exists

      // Update install count denormalized field
      await db.update(tools).set({
        installCount: sql`${tools.installCount} + 1`
      }).where(eq(tools.id, toolId))

      return reply.send({ success: true })
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to install tool' })
    }
  })
}

export default marketplaceRoutes
