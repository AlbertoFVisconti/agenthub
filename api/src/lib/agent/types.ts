import type { ToolCall, Usage } from '../models/types.js'

// ─────────────────────────────────────────────────────────────
// Events the agent loop emits — superset of StreamChunk
// ─────────────────────────────────────────────────────────────

export type AgentEvent =
  /** A text token from the current model turn */
  | { type: 'token';       content: string }
  /** The agent is about to call a tool */
  | { type: 'tool_start';  call: ToolCall }
  /** A tool returned (or errored) */
  | { type: 'tool_result'; callId: string; content: string; isError: boolean }
  /** One model→tool round completed; the loop may continue */
  | { type: 'turn_done';   usage: Usage; turnIndex: number }
  /** A tool requires user approval before executing */
  | { type: 'confirmation_required'; callId: string; command: string }
  /** The entire agent run finished cleanly */
  | { type: 'done';        totalUsage: Usage; turns: number }
  /** Fatal error — loop stops */
  | { type: 'error';       message: string }

// ─────────────────────────────────────────────────────────────
// ToolExecutor — the seam between the loop and where tools run
// Implement this once for server-side Docker, once for local
// subprocess (Tauri Phase 10), etc. The loop is identical.
// ─────────────────────────────────────────────────────────────

export interface ToolResult {
  callId: string
  content: string
  isError: boolean
}

export interface ToolExecutor {
  /** Return the ToolDefinitions to pass to the model this turn. */
  listTools(): Promise<import('../models/types.js').ToolDefinition[]>
  /** Check if a tool requires user confirmation. Returns the string to show the user if true. */
  requiresConfirmation?: (call: ToolCall) => string | undefined
  /** Execute a single tool call. Must not throw — encode errors in isError. */
  execute(call: ToolCall): Promise<ToolResult>
  /** Optional cleanup method called when the session ends or aborts */
  cleanup?: () => Promise<void>
}

// ─────────────────────────────────────────────────────────────
// Parameters for one agent run
// ─────────────────────────────────────────────────────────────

export interface AgentRunParams {
  adapter:      import('../models/types.js').ModelAdapter
  executor:     ToolExecutor
  messages:     import('../models/types.js').NormalizedMessage[]
  model:        string
  apiKey:       string
  systemPrompt?: string
  maxTokens?:   number
  /** Maximum tool-call rounds before forcibly stopping (default 10) */
  maxTurns?:    number
  /** Callback fired when a tool requires confirmation. Loop awaits the returned boolean. */
  onConfirm?:   (callId: string) => Promise<boolean>
}
