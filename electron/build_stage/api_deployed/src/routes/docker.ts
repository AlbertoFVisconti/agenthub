import type { FastifyPluginAsync } from 'fastify'
import * as path from 'node:path'
import * as os from 'node:os'
import * as fs from 'node:fs/promises'

const dockerRoutes: FastifyPluginAsync = async (fastify) => {
  const getDir = () => path.join(os.homedir(), '.agenthub')

  fastify.get('/settings/docker', async (req, reply) => {
    let perms = {}
    let docker = {}
    try { perms = JSON.parse(await fs.readFile(path.join(getDir(), 'tool-permissions.json'), 'utf8')) } catch {}
    try { docker = JSON.parse(await fs.readFile(path.join(getDir(), 'docker-settings.json'), 'utf8')) } catch {}
    
    return reply.send({ perms, docker })
  })

  fastify.get('/settings/docker/tools', async (req, reply) => {
    const toolsDir = path.join(getDir(), 'tools')
    let installs: any[] = []
    try {
      const folders = await fs.readdir(toolsDir)
      for (const folder of folders) {
        try {
          const manifestJson = JSON.parse(await fs.readFile(path.join(toolsDir, folder, 'manifest.json'), 'utf8'))
          
          // Folder names are usually like: "e44ed7a9-a2a4-45fc-85f2-7e17d4ae7ace-1.0.0"
          // We can try to extract the toolId (the UUID part)
          const toolId = folder.replace(/-[0-9]+\.[0-9]+\.[0-9]+$/, '')
          
          installs.push({ toolId: toolId || manifestJson.name, manifestJson })
        } catch {}
      }
    } catch {}
    return reply.send({ installs })
  })

  fastify.post('/settings/docker', async (req, reply) => {
    const body = req.body as any
    const dir = getDir()
    await fs.mkdir(dir, { recursive: true })
    
    if (body.docker) {
      await fs.writeFile(path.join(dir, 'docker-settings.json'), JSON.stringify(body.docker, null, 2), 'utf8')
    }
    if (body.perms) {
      await fs.writeFile(path.join(dir, 'tool-permissions.json'), JSON.stringify(body.perms, null, 2), 'utf8')
    }
    return reply.send({ ok: true })
  })
}
export default dockerRoutes
