import type {
  ModelAdapter,
  ModelAdapterParams,
  StreamChunk,
  ToolCall,
} from './types.js'

// Anthropic SSE event types we care about
interface AnthropicDelta {
  type: 'text_delta' | 'input_json_delta'
  text?: string
  partial_json?: string
}
interface AnthropicContentBlockStart {
  type: 'content_block_start'
  index: number
  content_block: { type: 'text' | 'tool_use'; id?: string; name?: string }
}
interface AnthropicContentBlockDelta {
  type: 'content_block_delta'
  index: number
  delta: AnthropicDelta
}
interface AnthropicMessageDelta {
  type: 'message_delta'
  delta: { stop_reason: string }
  usage: { output_tokens: number }
}
interface AnthropicMessageStart {
  type: 'message_start'
  message: { usage: { input_tokens: number } }
}
type AnthropicEvent =
  | AnthropicMessageStart
  | AnthropicContentBlockStart
  | AnthropicContentBlockDelta
  | AnthropicMessageDelta
  | { type: string }

export class AnthropicAdapter implements ModelAdapter {
  readonly provider = 'anthropic'

  async *chat(params: ModelAdapterParams): AsyncGenerator<StreamChunk> {
    const { apiKey, model, messages, tools, maxTokens = 4096, systemPrompt } = params

    // Build Anthropic messages format
    const anthropicMessages = messages
      .filter(m => m.role !== 'tool' || m.toolCallId)
      .map(m => {
        if (m.role === 'tool') {
          return {
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: m.toolCallId,
              content: m.content,
            }],
          }
        }
        return { role: m.role as 'user' | 'assistant', content: m.content }
      })

    const body: Record<string, unknown> = {
      model,
      messages: anthropicMessages,
      max_tokens: maxTokens,
      stream: true,
    }
    if (systemPrompt) body.system = systemPrompt
    if (tools?.length) {
      body.tools = tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }))
    }

    let res: Response
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    } catch (e) {
      yield { type: 'error', message: `Network error: ${(e as Error).message}` }
      return
    }

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      yield { type: 'error', message: `Anthropic API error ${res.status}: ${text}` }
      return
    }

    // Parse SSE stream
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let inputTokens = 0
    // Track partial tool calls being assembled
    const pendingToolCalls: Map<number, { id: string; name: string; jsonBuf: string }> = new Map()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop()! // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue

          let event: AnthropicEvent
          try { event = JSON.parse(data) } catch { continue }

          if (event.type === 'message_start') {
            const e = event as AnthropicMessageStart
            inputTokens = e.message.usage.input_tokens
          } else if (event.type === 'content_block_start') {
            const e = event as AnthropicContentBlockStart
            if (e.content_block.type === 'tool_use') {
              pendingToolCalls.set(e.index, {
                id: e.content_block.id!,
                name: e.content_block.name!,
                jsonBuf: '',
              })
            }
          } else if (event.type === 'content_block_delta') {
            const e = event as AnthropicContentBlockDelta
            if (e.delta.type === 'text_delta' && e.delta.text) {
              yield { type: 'token', content: e.delta.text }
            } else if (e.delta.type === 'input_json_delta' && e.delta.partial_json) {
              const tc = pendingToolCalls.get(e.index)
              if (tc) tc.jsonBuf += e.delta.partial_json
            }
          } else if (event.type === 'content_block_stop') {
            // Emit completed tool calls
            const stopEvent = event as unknown as { index: number }
            const tc = pendingToolCalls.get(stopEvent.index)
            if (tc) {
              let input: Record<string, unknown> = {}
              try { input = JSON.parse(tc.jsonBuf) } catch { /* partial */ }
              const call: ToolCall = { id: tc.id, name: tc.name, input }
              yield { type: 'tool_call', call }
              pendingToolCalls.delete(stopEvent.index)
            }
          } else if (event.type === 'message_delta') {
            const e = event as AnthropicMessageDelta
            yield { type: 'done', usage: { inputTokens, outputTokens: e.usage.output_tokens } }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
