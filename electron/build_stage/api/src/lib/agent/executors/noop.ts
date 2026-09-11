import type { ToolExecutor, ToolResult } from '../types.js'
import type { ToolDefinition, ToolCall } from '../../models/types.js'

/**
 * No-op executor — provides zero tools to the model.
 * This is the executor used for pure chat (Phase 3 behavior).
 * The model will never emit tool_calls because the tools list is empty.
 */
export class NoopExecutor implements ToolExecutor {
  async listTools(): Promise<ToolDefinition[]> {
    return []
  }

  async execute(_call: ToolCall): Promise<ToolResult> {
    // Should never be called since we expose no tools
    return {
      callId: _call.id,
      content: 'Error: no tools are available in this session.',
      isError: true,
    }
  }
}
