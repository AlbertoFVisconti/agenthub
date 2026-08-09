import type {
  ModelAdapter,
  ModelAdapterParams,
  StreamChunk,
  ToolCall,
} from './types.js'

interface OpenAIDelta {
  role?: string
  content?: string | null
  tool_calls?: Array<{
    index: number
    id?: string
    function?: { name?: string; arguments?: string }
  }>
}

interface OpenAIChunk {
  choices: Array<{ delta: OpenAIDelta; finish_reason: string | null }>
  usage?: { prompt_tokens: number; completion_tokens: number }
}

export class OpenAIAdapter implements ModelAdapter {
  readonly provider = 'openai'

  async *chat(params: ModelAdapterParams): AsyncGenerator<StreamChunk> {
    const { apiKey, model, messages, tools, maxTokens = 4096, systemPrompt } = params

    const openaiMessages: Array<Record<string, unknown>> = []

    if (systemPrompt) {
      openaiMessages.push({ role: 'system', content: systemPrompt })
    }

    for (const m of messages) {
      if (m.role === 'tool') {
        openaiMessages.push({
          role: 'tool',
          tool_call_id: m.toolCallId,
          content: m.content,
        })
      } else {
        openaiMessages.push({ role: m.role, content: m.content })
      }
    }

    const body: Record<string, unknown> = {
      model,
      messages: openaiMessages,
      max_completion_tokens: maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    }

    if (tools?.length) {
      body.tools = tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }))
    }

    const resolvedApiKey = apiKey || process.env.OPENAI_API_KEY

    if (!resolvedApiKey) {
      yield { type: 'error', message: 'No OpenAI API key provided' }
      return
    }

    let res: Response
    try {
      const baseUrl = process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1'
      const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`
      
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resolvedApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    } catch (e) {
      yield { type: 'error', message: `Network error: ${(e as Error).message}` }
      return
    }

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      yield { type: 'error', message: `OpenAI API error ${res.status}: ${text}` }
      return
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let inputTokens = 0
    let outputTokens = 0

    // Assemble partial tool calls across chunks
    const pendingCalls: Map<number, { id: string; name: string; argsBuf: string }> = new Map()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop()!

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue

          let chunk: OpenAIChunk
          try { chunk = JSON.parse(data) } catch { continue }

          // Usage appears on the final chunk
          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens
            outputTokens = chunk.usage.completion_tokens
          }

          const choice = chunk.choices?.[0]
          if (!choice) continue

          const delta = choice.delta

          // Stream text tokens
          if (delta.content) {
            yield { type: 'token', content: delta.content }
          }

          // Accumulate tool call fragments
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!pendingCalls.has(tc.index)) {
                pendingCalls.set(tc.index, { id: tc.id ?? '', name: tc.function?.name ?? '', argsBuf: '' })
              }
              const pc = pendingCalls.get(tc.index)!
              if (tc.id) pc.id = tc.id
              if (tc.function?.name) pc.name = tc.function.name
              if (tc.function?.arguments) pc.argsBuf += tc.function.arguments
            }
          }

          // Emit tool calls when the stream is finishing
          if (choice.finish_reason === 'tool_calls') {
            for (const [, pc] of pendingCalls) {
              let input: Record<string, unknown> = {}
              try { input = JSON.parse(pc.argsBuf) } catch { /* partial */ }
              const call: ToolCall = { id: pc.id, name: pc.name, input }
              yield { type: 'tool_call', call }
            }
            pendingCalls.clear()
          }

          if (choice.finish_reason === 'stop' || choice.finish_reason === 'length') {
            yield { type: 'done', usage: { inputTokens, outputTokens } }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
