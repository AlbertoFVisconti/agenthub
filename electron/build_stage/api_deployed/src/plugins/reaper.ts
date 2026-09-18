import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

/**
 * Reaper Plugin
 * Periodically scans for docker containers with the label agenthub-tool=true
 * that have been running for more than 2 hours and kills them.
 * This acts as a backstop in case the Node process crashes and fails to run cleanup hooks.
 */
const reaperPlugin: FastifyPluginAsync = async (fastify) => {
  const reapInterval = setInterval(async () => {
    try {
      // Find containers labeled agenthub-tool=true
      // format '{{.ID}}||{{.CreatedAt}}'
      const { stdout } = await execAsync(
        'docker ps -q --filter "label=agenthub-tool=true" --format "{{.ID}}||{{.CreatedAt}}"'
      )
      
      const lines = stdout.split('\n').map(line => line.trim()).filter(Boolean)
      if (lines.length === 0) return

      const now = Date.now()
      const TWO_HOURS = 2 * 60 * 60 * 1000
      const toKill: string[] = []

      for (const line of lines) {
        const [id, createdAtStr] = line.split('||')
        if (!id || !createdAtStr) continue
        
        // docker CreatedAt format usually parses well with new Date() in Node
        const createdAt = new Date(createdAtStr).getTime()
        if (now - createdAt > TWO_HOURS) {
          toKill.push(id)
        }
      }

      if (toKill.length > 0) {
        fastify.log.info({ count: toKill.length }, 'Reaping orphaned tool containers exceeding 2 hour TTL')
        await execAsync(`docker rm -f ${toKill.join(' ')}`)
      }
    } catch (err) {
      fastify.log.error({ err }, 'Error running docker reaper job')
    }
  }, 1000 * 60 * 15) // Every 15 minutes

  // On startup, reap all existing tool containers (they are orphaned because the server just started)
  try {
    const { stdout } = await execAsync('docker ps -q --filter "label=agenthub-tool=true"')
    const ids = stdout.split('\n').map(id => id.trim()).filter(Boolean)
    if (ids.length > 0) {
      fastify.log.info({ count: ids.length }, 'Reaping orphaned tool containers from previous run')
      await execAsync(`docker rm -f ${ids.join(' ')}`)
    }
  } catch (err) {
    fastify.log.error({ err }, 'Error during initial docker reap')
  }

  fastify.addHook('onClose', (instance, done) => {
    clearInterval(reapInterval)
    done()
  })
}

export default fp(reaperPlugin, { name: 'reaper' })
