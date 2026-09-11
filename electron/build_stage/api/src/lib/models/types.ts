// ─────────────────────────────────────────────────────────────
// Normalized types shared between all model adapters
// ─────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'tool'

export interface NormalizedMessage {
  role: MessageRole
  content: string
  /** For role=tool: the tool call ID this result belongs to */
  toolCallId?: string
  /** For role=tool: which function was called */
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

// ─────────────────────────────────────────────────────────────
// Stream chunks emitted by every adapter
// ─────────────────────────────────────────────────────────────

export type StreamChunk =
  | { type: 'token';     content: string }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'done';      usage: Usage }
  | { type: 'error';     message: string }

// ─────────────────────────────────────────────────────────────
// Adapter interface — each provider implements this
// ─────────────────────────────────────────────────────────────

export interface ModelAdapterParams {
  apiKey:    string
  model:     string
  messages:  NormalizedMessage[]
  tools?:    ToolDefinition[]
  maxTokens?: number
  systemPrompt?: string
}

export interface ModelAdapter {
  readonly provider: string
  chat(params: ModelAdapterParams): AsyncGenerator<StreamChunk>
}

// ─────────────────────────────────────────────────────────────
// Available models catalogue (used by the frontend selector)
// ─────────────────────────────────────────────────────────────

export const MODEL_CATALOGUE = [
  { provider: 'anthropic', id: 'claude-opus-4-5',           label: 'Claude Opus 4.5',       tier: 'premium' },
  { provider: 'anthropic', id: 'claude-sonnet-4-5',         label: 'Claude Sonnet 4.5',     tier: 'standard' },
  { provider: 'anthropic', id: 'claude-3-5-haiku-20241022', label: 'Claude Haiku 3.5',      tier: 'fast' },
  { provider: 'openai',    id: 'gpt-4o',                    label: 'GPT-4o',                tier: 'premium' },
  { provider: 'openai',    id: 'gpt-4o-mini',               label: 'GPT-4o mini',           tier: 'fast' },
  { provider: 'openai',    id: 'o3-mini',                   label: 'o3-mini',               tier: 'reasoning' },

  // --- TEMPORARY DEV ADDITIONS FOR GROQ TESTING ---
  // TODO: Remove these before switching back to a real OpenAI key in production!
  { provider: 'openai',    id: 'llama-3.3-70b-versatile',   label: 'Llama 3.3 70B (Groq)',  tier: 'fast' },
  { provider: 'openai',    id: 'openai/gpt-oss-120b',       label: 'GPT-OSS 120B (Groq)',   tier: 'premium' },
  // ------------------------------------------------

  { provider: 'google',    id: 'gemini-2.0-flash',          label: 'Gemini 2.0 Flash',      tier: 'fast' },
  { provider: 'google',    id: 'gemini-2.5-pro',            label: 'Gemini 2.5 Pro',        tier: 'premium' },
] as const

export type ModelProvider = 'anthropic' | 'openai' | 'google'
