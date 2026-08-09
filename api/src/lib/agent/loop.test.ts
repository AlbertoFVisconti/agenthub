import { describe, it, expect, vi } from 'vitest'
import { runAgentLoop } from './loop.js'
import type { AgentRunParams, ToolExecutor, ToolResult } from './types.js'
import type { ModelAdapter, ModelAdapterParams, StreamChunk, ToolDefinition, ToolCall } from '../models/types.js'

// ── Helpers ────────────────────────────────────────────────────

function makeAdapter(chunks: StreamChunk[]): ModelAdapter {
  return {
    provider: 'test',
    async *chat(_params: ModelAdapterParams): AsyncGenerator<StreamChunk> {
      for (const chunk of chunks) yield chunk
    },
  }
}

function makeExecutor(tools: ToolDefinition[], resultFn: (call: ToolCall) => ToolResult): ToolExecutor {
  return {
    async listTools() { return tools },
    async execute(call) { return resultFn(call) },
  }
}

function collectEvents(params: AgentRunParams) {
  return (async () => {
    const events = []
    for await (const e of runAgentLoop(params)) events.push(e)
    return events
  })()
}

// ── Tests ──────────────────────────────────────────────────────

describe('runAgentLoop', () => {
  const baseParams = {
    model: 'test-model',
    apiKey: 'test-key',
    messages: [{ role: 'user' as const, content: 'Hello' }],
    maxTurns: 5,
  }

  it('pure chat (no tools): emits tokens then done', async () => {
    const adapter = makeAdapter([
      { type: 'token', content: 'Hello ' },
      { type: 'token', content: 'world!' },
      { type: 'done', usage: { inputTokens: 10, outputTokens: 5 } },
    ])
    const executor = makeExecutor([], () => ({ callId: '', content: '', isError: false }))

    const events = await collectEvents({ ...baseParams, adapter, executor })

    const tokens = events.filter(e => e.type === 'token')
    expect(tokens).toHaveLength(2)
    expect((tokens[0] as { content: string }).content).toBe('Hello ')

    const done = events.find(e => e.type === 'done')
    expect(done).toBeDefined()
    expect((done as { totalUsage: { outputTokens: number } }).totalUsage.outputTokens).toBe(5)
    expect((done as { turns: number }).turns).toBe(1)
  })

  it('single tool call: emits tool_start → tool_result → loops and finishes', async () => {
    const toolCall: ToolCall = { id: 'tc-1', name: 'my_tool', input: { x: 1 } }
    const toolDef: ToolDefinition = {
      name: 'my_tool', description: 'Test tool',
      inputSchema: { type: 'object', properties: { x: { type: 'number' } } },
    }

    // First adapter call: emits a tool_call then done
    // Second adapter call (after tool result fed back): emits text then done
    let callCount = 0
    const adapter: ModelAdapter = {
      provider: 'test',
      async *chat(): AsyncGenerator<StreamChunk> {
        callCount++
        if (callCount === 1) {
          yield { type: 'tool_call', call: toolCall }
          yield { type: 'done', usage: { inputTokens: 10, outputTokens: 0 } }
        } else {
          yield { type: 'token', content: 'Result processed.' }
          yield { type: 'done', usage: { inputTokens: 15, outputTokens: 5 } }
        }
      },
    }

    const executor = makeExecutor([toolDef], (call) => ({
      callId: call.id,
      content: 'Tool output: 42',
      isError: false,
    }))

    const events = await collectEvents({ ...baseParams, adapter, executor })

    const types = events.map(e => e.type)
    expect(types).toContain('tool_start')
    expect(types).toContain('tool_result')
    expect(types).toContain('turn_done')
    expect(types).toContain('token')
    expect(types).toContain('done')

    const toolResult = events.find(e => e.type === 'tool_result')
    expect((toolResult as { content: string }).content).toBe('Tool output: 42')
    expect((toolResult as { isError: boolean }).isError).toBe(false)

    const done = events.find(e => e.type === 'done')
    expect((done as { turns: number }).turns).toBe(2)
    expect((done as { totalUsage: { inputTokens: number } }).totalUsage.inputTokens).toBe(25)
  })

  it('maxTurns exceeded: emits error event', async () => {
    const toolCall: ToolCall = { id: 'tc-loop', name: 'loop_tool', input: {} }
    // Adapter always returns a tool call (infinite loop scenario)
    const adapter: ModelAdapter = {
      provider: 'test',
      async *chat(): AsyncGenerator<StreamChunk> {
        yield { type: 'tool_call', call: toolCall }
        yield { type: 'done', usage: { inputTokens: 1, outputTokens: 0 } }
      },
    }
    const executor = makeExecutor(
      [{ name: 'loop_tool', description: 'loops', inputSchema: { type: 'object', properties: {} } }],
      (call) => ({ callId: call.id, content: 'ok', isError: false }),
    )

    const events = await collectEvents({ ...baseParams, adapter, executor, maxTurns: 2 })
    const lastEvent = events[events.length - 1]
    expect(lastEvent.type).toBe('error')
    expect((lastEvent as { message: string }).message).toContain('maximum')
  })

  it('adapter error: propagates as agent error event', async () => {
    const adapter = makeAdapter([
      { type: 'error', message: 'API rate limit exceeded' },
    ])
    const executor = makeExecutor([], () => ({ callId: '', content: '', isError: false }))

    const events = await collectEvents({ ...baseParams, adapter, executor })
    expect(events.some(e => e.type === 'error')).toBe(true)
    const err = events.find(e => e.type === 'error')
    expect((err as { message: string }).message).toContain('rate limit')
  })

  it('tool execution error: marks result isError=true and continues loop', async () => {
    const toolCall: ToolCall = { id: 'tc-err', name: 'failing_tool', input: {} }
    let callCount = 0
    const adapter: ModelAdapter = {
      provider: 'test',
      async *chat(): AsyncGenerator<StreamChunk> {
        callCount++
        if (callCount === 1) {
          yield { type: 'tool_call', call: toolCall }
          yield { type: 'done', usage: { inputTokens: 5, outputTokens: 0 } }
        } else {
          yield { type: 'token', content: 'Sorry, the tool failed.' }
          yield { type: 'done', usage: { inputTokens: 10, outputTokens: 5 } }
        }
      },
    }
    const executor = makeExecutor(
      [{ name: 'failing_tool', description: 'fails', inputSchema: { type: 'object', properties: {} } }],
      (call) => ({ callId: call.id, content: 'Connection refused', isError: true }),
    )

    const events = await collectEvents({ ...baseParams, adapter, executor })
    const result = events.find(e => e.type === 'tool_result')
    expect((result as { isError: boolean }).isError).toBe(true)
    // Loop should still complete
    expect(events.some(e => e.type === 'done')).toBe(true)
  })
})
