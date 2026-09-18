import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { v4 as uuidv4 } from 'uuid'

const HISTORY_DIR = path.join(os.homedir(), '.agenthub', 'history')
const INDEX_FILE = path.join(HISTORY_DIR, 'index.json')
const MESSAGES_DIR = path.join(HISTORY_DIR, 'messages')

// Initialize directories
function initHistoryDir() {
  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true })
  if (!fs.existsSync(MESSAGES_DIR)) fs.mkdirSync(MESSAGES_DIR, { recursive: true })
  if (!fs.existsSync(INDEX_FILE)) {
    fs.writeFileSync(INDEX_FILE, JSON.stringify({ projects: [] }, null, 2))
  }
}

type ConversationMeta = {
  id: string
  title: string
  updatedAt: string
}

type ProjectMeta = {
  id: string
  workspacePath: string
  updatedAt: string
  conversations: ConversationMeta[]
}

function readIndex(): { projects: ProjectMeta[] } {
  try {
    const data = fs.readFileSync(INDEX_FILE, 'utf8')
    return JSON.parse(data)
  } catch (err) {
    return { projects: [] }
  }
}

function writeIndex(data: { projects: ProjectMeta[] }) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(data, null, 2))
}

const CreateConversationSchema = z.object({
  workspacePath: z.string().min(1),
})

const UpdateConversationSchema = z.object({
  messages: z.array(z.object({
    id: z.string().optional(),
    role: z.string(),
    content: z.string(),
    toolCallId: z.string().optional(),
    toolName: z.string().optional(),
    toolCalls: z.any().optional(),
    usage: z.any().optional(),
  })).min(1),
})

export const historyRoutes: FastifyPluginAsync = async (app) => {
  // Ensure we are in desktop mode (no auth needed)
  app.addHook('onRequest', async (req, reply) => {
    if (process.env.DEPLOYMENT_MODE !== 'desktop') {
      return reply.status(403).send({ error: 'FORBIDDEN' })
    }
    initHistoryDir()
  })

  // GET /history/projects
  app.get('/projects', async (req, reply) => {
    const index = readIndex()
    
    // Sort projects by updatedAt desc
    index.projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    // Sort conversations by updatedAt desc
    for (const proj of index.projects) {
      proj.conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }
    
    return reply.send({ projects: index.projects })
  })

  // POST /history/conversations
  app.post('/conversations', async (req, reply) => {
    const parsed = CreateConversationSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'INVALID_BODY' })
    }

    const { workspacePath } = parsed.data
    const index = readIndex()

    let project = index.projects.find(p => p.workspacePath === workspacePath)
    if (!project) {
      project = {
        id: uuidv4(),
        workspacePath,
        updatedAt: new Date().toISOString(),
        conversations: []
      }
      index.projects.push(project)
    }

    const conversation: ConversationMeta = {
      id: uuidv4(),
      title: 'New Conversation',
      updatedAt: new Date().toISOString()
    }

    project.conversations.push(conversation)
    project.updatedAt = new Date().toISOString()
    
    writeIndex(index)

    // Write empty messages file
    const msgFile = path.join(MESSAGES_DIR, `${conversation.id}.json`)
    fs.writeFileSync(msgFile, JSON.stringify([]))

    return reply.send({ conversation })
  })

  // GET /history/conversations/:id
  app.get('/conversations/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const index = readIndex()

    let foundConv: ConversationMeta | undefined
    for (const proj of index.projects) {
      foundConv = proj.conversations.find(c => c.id === id)
      if (foundConv) break
    }

    if (!foundConv) {
      return reply.status(404).send({ error: 'NOT_FOUND' })
    }

    const msgFile = path.join(MESSAGES_DIR, `${id}.json`)
    let messages = []
    if (fs.existsSync(msgFile)) {
      messages = JSON.parse(fs.readFileSync(msgFile, 'utf8'))
    }

    return reply.send({ 
      conversation: {
        ...foundConv,
        messages
      }
    })
  })

  // PUT /history/conversations/:id
  app.put('/conversations/:id', async (req, reply) => {
    const parsed = UpdateConversationSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'INVALID_BODY' })
    }

    const { id } = req.params as { id: string }
    const newMessages = parsed.data.messages.map(m => ({
      ...m,
      id: m.id || uuidv4()
    }))

    const index = readIndex()
    let foundProj: ProjectMeta | undefined
    let foundConv: ConversationMeta | undefined

    for (const proj of index.projects) {
      foundConv = proj.conversations.find(c => c.id === id)
      if (foundConv) {
        foundProj = proj
        break
      }
    }

    if (!foundConv || !foundProj) {
      return reply.status(404).send({ error: 'NOT_FOUND' })
    }

    // Auto-title
    const firstUserMsg = newMessages.find(m => m.role === 'user')
    if (foundConv.title === 'New Conversation' && firstUserMsg) {
      foundConv.title = firstUserMsg.content.slice(0, 40) + (firstUserMsg.content.length > 40 ? '...' : '')
    }

    foundConv.updatedAt = new Date().toISOString()
    foundProj.updatedAt = new Date().toISOString()
    
    writeIndex(index)

    const msgFile = path.join(MESSAGES_DIR, `${id}.json`)
    fs.writeFileSync(msgFile, JSON.stringify(newMessages, null, 2))

    return reply.send({ success: true })
  })

  // PATCH /history/conversations/:id
  app.patch('/conversations/:id', async (req, reply) => {
    const parsed = z.object({ title: z.string().min(1) }).safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'INVALID_BODY' })
    }

    const { id } = req.params as { id: string }
    const index = readIndex()
    let foundConv: ConversationMeta | undefined

    for (const proj of index.projects) {
      foundConv = proj.conversations.find(c => c.id === id)
      if (foundConv) {
        foundConv.title = parsed.data.title
        proj.updatedAt = new Date().toISOString()
        break
      }
    }

    if (!foundConv) {
      return reply.status(404).send({ error: 'NOT_FOUND' })
    }

    writeIndex(index)
    return reply.send({ success: true, conversation: foundConv })
  })

  // DELETE /history/conversations/:id
  app.delete('/conversations/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const index = readIndex()
    let found = false

    for (const proj of index.projects) {
      const idx = proj.conversations.findIndex(c => c.id === id)
      if (idx !== -1) {
        proj.conversations.splice(idx, 1)
        proj.updatedAt = new Date().toISOString()
        found = true
        break
      }
    }

    if (!found) {
      return reply.status(404).send({ error: 'NOT_FOUND' })
    }

    writeIndex(index)
    
    // Clean up message file
    const msgFile = path.join(MESSAGES_DIR, `${id}.json`)
    if (fs.existsSync(msgFile)) {
      fs.unlinkSync(msgFile)
    }

    return reply.send({ success: true })
  })
}
