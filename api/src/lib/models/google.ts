import type {
  ModelAdapter,
  ModelAdapterParams,
  StreamChunk,
} from './types.js'

export class GoogleAdapter implements ModelAdapter {
  readonly provider = 'google'

  async *chat(params: ModelAdapterParams): AsyncGenerator<StreamChunk> {
    try {
      const contents = params.messages.map(m => {
        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content || '' }]
        }
      })

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:streamGenerateContent?alt=sse&key=${params.apiKey}`

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Google API error: ${res.status} ${res.statusText} - ${errorText}`)
      }
      
      if (!res.body) {
        throw new Error('No response body from Google API')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let inputTokens = 0
      let outputTokens = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            const dataStr = line.slice(6).trim()
            if (!dataStr) continue
            try {
              const parsed = JSON.parse(dataStr)
              
              if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                yield { type: 'token', content: parsed.candidates[0].content.parts[0].text }
              }

              if (parsed.usageMetadata) {
                inputTokens = parsed.usageMetadata.promptTokenCount || inputTokens
                outputTokens = parsed.usageMetadata.candidatesTokenCount || outputTokens
              }
            } catch (e) {
              console.error('Failed to parse Gemini SSE chunk', dataStr, e)
            }
          }
        }
      }
      
      if (buffer.trim().startsWith('data: ') && buffer.trim() !== 'data: [DONE]') {
         const dataStr = buffer.slice(6).trim()
         if (dataStr) {
           try {
             const parsed = JSON.parse(dataStr)
             if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
               yield { type: 'token', content: parsed.candidates[0].content.parts[0].text }
             }
           } catch(e) {}
         }
      }

      yield { type: 'done', usage: { inputTokens, outputTokens } }
    } catch (err: any) {
      yield { type: 'error', message: err.message || String(err) }
    }
  }
}
