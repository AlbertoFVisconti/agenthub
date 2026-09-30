import type { FastifyPluginAsync } from 'fastify'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
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

      // 4. Docker Dry-Run
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

      // If a Dockerfile is present, we built the image during dry-run. Now we push it to GHCR.
      if (manifest.dockerfile) {
        const ghcrNamespace = process.env.GHCR_NAMESPACE
        const ghcrToken = process.env.GHCR_TOKEN
        if (ghcrNamespace && ghcrToken) {
          const dryRunImageName = `agenthub-dryrun-${manifest.name}-${manifest.version}`
          const finalImageRef = `ghcr.io/${ghcrNamespace}/${manifest.name}:${manifest.version}`
          
          try {
            const { execFileSync } = await import('node:child_process')
            // Login to GHCR (safe since token is passed via stdin)
            const dockerLogin = spawn('docker', ['login', 'ghcr.io', '-u', ghcrNamespace, '--password-stdin'])
            dockerLogin.stdin.write(ghcrToken + '\n')
            dockerLogin.stdin.end()
            await new Promise((resolve) => dockerLogin.on('close', resolve))

            execFileSync('docker', ['tag', dryRunImageName, finalImageRef])
            execFileSync('docker', ['push', finalImageRef])
            manifest.dockerImageRef = finalImageRef
          } catch (err) {
            req.log.error(err, 'Failed to push Docker image to GHCR')
            // We can optionally fail the publish here, or let it proceed with local zip extraction.
            // Let's continue since desktop can fallback to building from zip if `dockerImageRef` is missing.
          }
        }
      }

      // 5. Store package to uploads directory (simulating S3)
      const uploadsDir = path.join(process.cwd(), 'uploads', 'tools')
      await fs.promises.mkdir(uploadsDir, { recursive: true })
      const packageFilename = `${manifest.name}-${manifest.version}-${tmpId}.zip`
      const packageUrl = `/uploads/tools/${packageFilename}` // In reality, an S3 URL
      await fs.promises.copyFile(zipPath, path.join(uploadsDir, packageFilename))

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
            dockerImageRef: manifest.dockerImageRef,
            updatedAt: new Date(),
            status: 'published'
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
            status: 'published'
          }).returning({ id: tools.id })
          toolId = inserted[0].id
        }

        // Insert tool version
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

      return reply.send({ success: true, toolId: toolId!, message: 'Tool published successfully' })
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
        manifestJson: tools.manifestJson
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
}

export default marketplaceRoutes
