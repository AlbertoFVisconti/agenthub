import type { AgentEvent, AgentRunParams, ToolResult } from './types.js'
import type { NormalizedMessage, ToolCall, Usage } from '../models/types.js'

/**
 * The core agent loop.
 *
 * Runs the model → intercepts tool_calls → executes them via the
 * ToolExecutor → feeds results back → loops until the model stops
 * calling tools or maxTurns is reached.
 *
 * This generator is LOCATION-AGNOSTIC: it works identically whether
 * called from a Fastify handler on the server or a Tauri sidecar
 * process on the user's machine. The host provides the adapter and
 * executor; the loop itself has zero server or OS dependencies.
 *
 * Event sequence for a run with one tool call:
 *   token… → tool_start → tool_result → token… → turn_done → done
 */
export async function* runAgentLoop(params: AgentRunParams): AsyncGenerator<AgentEvent> {
  const {
    adapter, executor, model, apiKey,
    systemPrompt, maxTokens,
    maxTurns = 3,
    onConfirm,
  } = params

  // Mutable conversation history — grows as tool calls are appended
  const messages: NormalizedMessage[] = [...params.messages]

  const totalUsage: Usage = { inputTokens: 0, outputTokens: 0 }
  let turnIndex = 0

  while (turnIndex < maxTurns) {
    const isFinalTurn = turnIndex === maxTurns - 1
    const tools = isFinalTurn ? [] : await executor.listTools()
    const pendingCalls: ToolCall[] = []
    let turnText = ''

    if (isFinalTurn) {
      messages.push({
        role: 'user',
        content: 'System notice: You have reached the maximum number of tool call iterations allowed for this request. You can no longer call tools. Please provide a final text response to the user based on the information you have gathered so far.'
      })
    }

    // ── Model turn ──────────────────────────────────────────────
    for await (const chunk of adapter.chat({ apiKey, model, messages, tools, systemPrompt, maxTokens, baseUrl: params.baseUrl })) {
      switch (chunk.type) {
        case 'token':
          turnText += chunk.content
          yield { type: 'token', content: chunk.content }
          break

        case 'tool_call':
          pendingCalls.push(chunk.call)
          break

        case 'done':
          totalUsage.inputTokens  += chunk.usage.inputTokens
          totalUsage.outputTokens += chunk.usage.outputTokens
          break

        case 'error':
          yield { type: 'error', message: chunk.message }
          return
      }
    }

    // If the model produced text, append it as an assistant message
    if (turnText) {
      messages.push({ role: 'assistant', content: turnText })
    }

    // ── No tool calls → we're done ──────────────────────────────
    if (pendingCalls.length === 0) {
      yield { type: 'turn_done', usage: { ...totalUsage }, turnIndex }
      yield { type: 'done', totalUsage: { ...totalUsage }, turns: turnIndex + 1 }
      return
    }

    // ── Execute tool calls (sequential) ─────────────────────────
    yield { type: 'turn_done', usage: { ...totalUsage }, turnIndex }

    const results: ToolResult[] = []
    for (const call of pendingCalls) {
      yield { type: 'tool_start', call }

      let approved = true
      if (executor.requiresConfirmation) {
        const confirmCmd = executor.requiresConfirmation(call)
        if (confirmCmd) {
          yield { type: 'confirmation_required', callId: call.id, command: confirmCmd }
          if (onConfirm) {
            approved = await onConfirm(call.id)
          } else {
            approved = false // Reject if no handler provided
          }
        }
      }

      let result: ToolResult
      if (approved) {
        result = await executor.execute(call)
      } else {
        result = { callId: call.id, content: 'User declined to execute this tool.', isError: true }
      }

      yield { type: 'tool_result', callId: result.callId, content: result.content, isError: result.isError }
      results.push(result)
    }

    // Append tool results to conversation history so next model turn sees them
    for (const result of results) {
      const call = pendingCalls.find(c => c.id === result.callId)!
      // First add an assistant message with the tool call (required by Anthropic/OpenAI)
      messages.push({
        role: 'assistant',
        content: `[Tool call: ${call.name}(${JSON.stringify(call.input)})]`,
      })
      // Then add the tool result
      messages.push({
        role: 'tool',
        content: result.content,
        toolCallId: result.callId,
        toolName: call.name,
      })
    }

    turnIndex++
  }

  // Exceeded maxTurns
  yield {
    type: 'error',
    message: `Agent exceeded maximum of ${maxTurns} tool-call rounds. Stopping to prevent runaway loops.`,
  }
}
