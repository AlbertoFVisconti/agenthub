import * as os from 'node:os'
import * as fsPromises from 'node:fs/promises'

async function getLocalSettings() {
  const dir = path.join(os.homedir(), '.agenthub')
  let perms: Record<string, string> = {}
  let docker: { memory?: string, cpu?: string } = {}
  try {
    perms = JSON.parse(await fsPromises.readFile(path.join(dir, 'tool-permissions.json'), 'utf8'))
  } catch {}
  try {
    docker = JSON.parse(await fsPromises.readFile(path.join(dir, 'docker-settings.json'), 'utf8'))
  } catch {}
  return { perms, docker }
}
