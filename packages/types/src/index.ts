import { z } from 'zod'

// ─────────────────────────────────────────────────────────────
// User
// ─────────────────────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  oauthProvider: z.enum(['github']).nullable(),
  oauthId: z.string().nullable(),
  isAnonymous: z.boolean(),
  lastActiveAt: z.string().datetime(),
  createdAt: z.string().datetime(),
})
export type User = z.infer<typeof UserSchema>

// ─────────────────────────────────────────────────────────────
// API Keys
// ─────────────────────────────────────────────────────────────

export const ModelProvider = z.enum(['anthropic', 'openai', 'google'])
export type ModelProvider = z.infer<typeof ModelProvider>

export const ApiKeySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  provider: ModelProvider,
  createdAt: z.string().datetime(),
})
export type ApiKey = z.infer<typeof ApiKeySchema>

// ─────────────────────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────────────────────

export const ToolStatus = z.enum(['draft', 'pending', 'published', 'rejected'])
export type ToolStatus = z.infer<typeof ToolStatus>

export const McpFunctionParameterSchema = z.object({
  type: z.string(),
  description: z.string().optional(),
  enum: z.array(z.string()).optional(),
  items: z.any().optional(),
})

export const McpFunctionSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z_][a-z0-9_]*$/),
  description: z.string().min(1).max(1024),
  parameters: z.object({
    type: z.literal('object'),
    properties: z.record(McpFunctionParameterSchema),
    required: z.array(z.string()).optional(),
  }),
})
export type McpFunction = z.infer<typeof McpFunctionSchema>

export const ToolPermissions = z.object({
  network: z.boolean().default(false),
  filesystem: z.array(z.string()).default([]),
  externalBinaries: z.array(z.string()).default([]),
})
export type ToolPermissions = z.infer<typeof ToolPermissions>

export const ToolManifestSchema = z.object({
  name: z.string().min(1).max(128),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().min(10).max(2048),
  author: z.string().min(1).max(128),
  transport: z.enum(['stdio', 'http']).default('stdio'),
  entrypoint: z.string().min(1),
  functions: z.array(McpFunctionSchema).min(1).max(32),
  permissions: ToolPermissions.default({}),
  tags: z.array(z.string()).max(10).default([]),
})
export type ToolManifest = z.infer<typeof ToolManifestSchema>

export const ToolSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  manifest: ToolManifestSchema,
  status: ToolStatus,
  installCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Tool = z.infer<typeof ToolSchema>

// ─────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────

export const SessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  modelProvider: ModelProvider,
  modelName: z.string(),
  createdAt: z.string().datetime(),
})
export type Session = z.infer<typeof SessionSchema>

// ─────────────────────────────────────────────────────────────
// Chat / Agent — normalized across all providers
// ─────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'tool'

export interface NormalizedMessage {
  role: MessageRole
  content: string
  toolCallId?: string
  toolName?: string
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface Usage {
  inputTokens: number
  outputTokens: number
}

export type StreamChunk =
  | { type: 'token';     content: string }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'done';      usage: Usage }
  | { type: 'error';     message: string }

/**
 * AgentEvent — superset of StreamChunk, emitted by the agent loop.
 * StreamChunk events (token, error) are a strict subset.
 */
export type AgentEvent =
  | { type: 'token';       content: string }
  | { type: 'tool_start';  call: ToolCall }
  | { type: 'tool_result'; callId: string; content: string; isError: boolean }
  | { type: 'turn_done';   usage: Usage; turnIndex: number }
  | { type: 'confirmation_required'; callId: string; command: string }
  | { type: 'done';        totalUsage: Usage; turns: number }
  | { type: 'error';       message: string }

// ─────────────────────────────────────────────────────────────
// Model catalogue (shared between api and web)
// ─────────────────────────────────────────────────────────────

export const MODEL_CATALOGUE = [
  { provider: 'anthropic', id: 'claude-opus-4-5',           label: 'Claude Opus 4.5',   tier: 'premium' },
  { provider: 'anthropic', id: 'claude-sonnet-4-5',         label: 'Claude Sonnet 4.5', tier: 'standard' },
  { provider: 'anthropic', id: 'claude-3-5-haiku-20241022', label: 'Claude Haiku 3.5',  tier: 'fast' },
  { provider: 'openai',    id: 'gpt-4o',                    label: 'GPT-4o',            tier: 'premium' },
  { provider: 'openai',    id: 'gpt-4o-mini',               label: 'GPT-4o mini',       tier: 'fast' },
  { provider: 'openai',    id: 'o3-mini',                   label: 'o3-mini',           tier: 'reasoning' },
  
  // --- TEMPORARY DEV ADDITIONS FOR GROQ TESTING ---
  // TODO: Remove these before switching back to a real OpenAI key in production!
  { provider: 'openai',    id: 'llama-3.3-70b-versatile',   label: 'Llama 3.3 70B (Groq)', tier: 'fast' },
  { provider: 'openai',    id: 'openai/gpt-oss-120b',       label: 'GPT-OSS 120B (Groq)',  tier: 'premium' },
  // ------------------------------------------------

  { provider: 'google',    id: 'gemini-2.0-flash',          label: 'Gemini 2.0 Flash',  tier: 'fast' },
  { provider: 'google',    id: 'gemini-2.5-pro',            label: 'Gemini 2.5 Pro',    tier: 'premium' },
] as const

export type ModelCatalogueEntry = typeof MODEL_CATALOGUE[number]

// ─────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────

export const EventType = z.enum(['install', 'uninstall', 'invoke', 'error'])
export type EventType = z.infer<typeof EventType>

// ─────────────────────────────────────────────────────────────
// API Response shapes
// ─────────────────────────────────────────────────────────────

export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
})
export type ApiError = z.infer<typeof ApiErrorSchema>

export const HealthSchema = z.object({
  status: z.enum(['ok', 'degraded', 'error']),
  version: z.string(),
  db: z.enum(['ok', 'error']),
  uptime: z.number(),
})
export type Health = z.infer<typeof HealthSchema>
