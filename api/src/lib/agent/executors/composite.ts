import type { ToolExecutor, ToolResult } from '../types.js'
import type { ToolDefinition, ToolCall } from '../../models/types.js'

export class CompositeExecutor implements ToolExecutor {
  private activeExecutors = new Set<ToolExecutor>()
  private maxActive: number

  constructor(private executors: ToolExecutor[], maxActive = 5) {
    this.maxActive = maxActive
  }

  async listTools(): Promise<ToolDefinition[]> {
    const allTools: ToolDefinition[] = []
    for (const ex of this.executors) {
      const tools = await ex.listTools()
      allTools.push(...tools)
    }
    return allTools
  }

  requiresConfirmation(call: ToolCall): string | undefined {
    for (const ex of this.executors) {
      if (ex.requiresConfirmation) {
        const cmd = ex.requiresConfirmation(call)
        if (cmd) return cmd
      }
    }
    return undefined
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    // To route the call, we first need to know which executor owns the tool.
    // We could pre-compute a routing map, but since tools list is small, we can query it.
    for (const ex of this.executors) {
      const tools = await ex.listTools()
      if (tools.some(t => t.name === call.name)) {
        if (!this.activeExecutors.has(ex)) {
          if (this.activeExecutors.size >= this.maxActive) {
            // Evict least recently used (first item in the Set)
            const oldest = this.activeExecutors.values().next().value
            if (oldest) {
              await oldest.cleanup?.()
              this.activeExecutors.delete(oldest)
            }
          }
          this.activeExecutors.add(ex)
        } else {
          // Move to the end of the set to mark it as most recently used
          this.activeExecutors.delete(ex)
          this.activeExecutors.add(ex)
        }
        return ex.execute(call)
      }
    }
    return { callId: call.id, content: `Tool not found: ${call.name}`, isError: true }
  }

  async cleanup(): Promise<void> {
    const promises = this.executors.map(ex => ex.cleanup?.())
    await Promise.all(promises)
  }
}
