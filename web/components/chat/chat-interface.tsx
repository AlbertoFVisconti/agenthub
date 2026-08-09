'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MODEL_CATALOGUE } from '@agenthub/types'
import type { NormalizedMessage, AgentEvent } from '@agenthub/types'
import { useSession } from '@/lib/session-context'
import { getStoredKey } from '@/app/settings/key-settings'
import { MessageList } from './message-list'
import { ChatInput } from './chat-input'
import { ModelSelector } from './model-selector'
import { LOCAL_API_BASE } from '../../lib/config'
import { Bot, AlertTriangle, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import type { ToolCallState } from './tool-call-card'

export interface UIMessage {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  isStreaming?: boolean
  usage?: { inputTokens: number; outputTokens: number }
  toolCalls?: ToolCallState[]
}

const DEFAULT_PROVIDER = MODEL_CATALOGUE[1].provider
const DEFAULT_MODEL    = MODEL_CATALOGUE[1].id

export function ChatInterface() {
  const { user, loading: sessionLoading, error: sessionError } = useSession()
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [provider, setProvider] = useState<string>(DEFAULT_PROVIDER)
  const [model, setModel]       = useState<string>(DEFAULT_MODEL)
  const [workspacePath, setWorkspacePath] = useState<string>('')
  const [streaming, setStreaming] = useState(false)
  const [noKeyWarning, setNoKeyWarning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (content: string) => {
    if (streaming || !content.trim()) return

    const apiKey = getStoredKey(provider as 'anthropic' | 'openai' | 'google')
    if (!apiKey && user?.isAnonymous) { setNoKeyWarning(true); return }
    setNoKeyWarning(false)

    const userMsg: UIMessage = { id: crypto.randomUUID(), role: 'user', content }
    const assistantId = crypto.randomUUID()
    const assistantMsg: UIMessage = {
      id: assistantId, role: 'assistant', content: '', isStreaming: true, toolCalls: [],
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setStreaming(true)

    // Build history from existing non-error messages
    const history: NormalizedMessage[] = [
      ...messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content },
    ]

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

      console.log('[TRACE] chat-interface.tsx headers sent:', {
        hasAuth: !!headers['Authorization'],
        providerRequested: provider
      })

      const res = await fetch(`${LOCAL_API_BASE}/models/chat`, {
        method: 'POST', headers, credentials: 'include',
        body: JSON.stringify({ 
          provider, model, 
          messages: history,
          workspacePath: workspacePath.trim() || undefined
        }),
        signal: ctrl.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }))
        throw new Error(err.message ?? `HTTP ${res.status}`)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        const lines = buf.split('\n')
        buf = lines.pop()!

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue

          let event: AgentEvent
          try { event = JSON.parse(data) } catch { continue }

          if (event.type === 'token') {
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? { ...m, content: m.content + event.content } : m,
            ))
          } else if (event.type === 'tool_start') {
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? {
                ...m,
                toolCalls: [...(m.toolCalls ?? []), { call: event.call, status: 'running' }],
              } : m,
            ))
          } else if (event.type === 'tool_result') {
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? {
                ...m,
                toolCalls: (m.toolCalls ?? []).map(tc =>
                  tc.call.id === event.callId
                    ? { ...tc, status: event.isError ? 'error' : 'done', result: event.content }
                    : tc
                ),
              } : m,
            ))
          } else if (event.type === 'done') {
            setMessages(prev => prev.map(m =>
              m.id === assistantId
                ? { ...m, isStreaming: false, usage: event.totalUsage }
                : m,
            ))
          } else if (event.type === 'error') {
            throw new Error(event.message)
          }
          // turn_done: no UI update needed (purely informational for now)
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: m.content + ' _(stopped)_', isStreaming: false }
            : m,
        ))
      } else {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, role: 'error' as const, content: msg, isStreaming: false }
            : m,
        ))
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [streaming, messages, provider, model, user, workspacePath])

  const stopStreaming = useCallback(() => { abortRef.current?.abort() }, [])
  const clearMessages = useCallback(() => { if (!streaming) setMessages([]) }, [streaming])

  if (sessionLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 60px)' }}>
        <div className="skeleton" style={{ width: '200px', height: '20px', borderRadius: '10px' }} />
      </div>
    )
  }

  if (sessionError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#0a0a0a', color: '#fff' }}>
        <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Failed to load chat session</h2>
        <p style={{ color: 'hsl(220 15% 65%)' }}>{sessionError}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      {/* Toolbar */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0.75rem 1.5rem',
        display: 'flex', alignItems: 'center', gap: '1rem',
        backgroundColor: 'rgba(10,10,20,0.6)', backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot size={18} color="#818cf8" />
          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#fff' }}>Agent Chat</span>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <ModelSelector provider={provider} model={model}
            onChange={(p, m) => { setProvider(p); setModel(m) }} disabled={streaming} />
          
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0 0.5rem', flex: 1, maxWidth: '400px' }}>
            <FolderOpen size={14} color="#818cf8" style={{ marginRight: '0.4rem' }} />
            <input 
              type="text" 
              placeholder="Workspace Path (e.g. C:\Users\alber\project)"
              value={workspacePath}
              onChange={e => setWorkspacePath(e.target.value)}
              disabled={streaming}
              style={{
                background: 'transparent', border: 'none', color: '#fff', fontSize: '0.82rem',
                padding: '0.4rem 0', width: '100%', outline: 'none'
              }}
            />
            {typeof window !== 'undefined' && (window as any).electronAPI && (
              <button
                onClick={async () => {
                  const folder = await (window as any).electronAPI.pickProjectFolder()
                  if (folder) setWorkspacePath(folder)
                }}
                disabled={streaming}
                className="btn-ghost"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', marginLeft: '0.5rem' }}
              >
                Browse
              </button>
            )}
          </div>
        </div>
        {messages.length > 0 && !streaming && (
          <button onClick={clearMessages} className="btn-ghost"
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}>Clear</button>
        )}
      </div>

      {/* No-key warning */}
      {noKeyWarning && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.75rem 1.5rem', backgroundColor: 'rgba(245,158,11,0.08)',
          borderBottom: '1px solid rgba(245,158,11,0.2)',
          fontSize: '0.85rem', color: '#f59e0b',
        }}>
          <AlertTriangle size={15} />
          No {provider} API key set.{' '}
          <Link href="/settings" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 600 }}>
            Add your key in Settings →
          </Link>
          <button onClick={() => setNoKeyWarning(false)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(220 15% 50%)', fontSize: '1rem' }}>
            ×
          </button>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
        {messages.length === 0
          ? <EmptyState provider={provider} model={model} />
          : <MessageList messages={messages} />
        }
        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={sendMessage} onStop={stopStreaming} streaming={streaming} />
    </div>
  )
}

function EmptyState({ provider, model }: { provider: string; model: string }) {
  const entry = MODEL_CATALOGUE.find(m => m.id === model)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1.5rem', padding: '3rem 0' }}>
      <div style={{
        width: '56px', height: '56px', borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(192,132,252,0.2))',
        border: '1px solid rgba(99,102,241,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Bot size={26} color="#818cf8" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#fff', marginBottom: '0.4rem' }}>
          {entry?.label ?? model}
        </div>
        <div style={{ fontSize: '0.85rem', color: 'hsl(220 15% 50%)', maxWidth: '360px', lineHeight: 1.6 }}>
          Start a conversation. Your API key is used directly — no costs go through AgentHub.
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {["Explain quantum entanglement simply", "Write a Python web scraper", "What's the best way to learn Rust?"].map(s => (
          <div key={s} style={{
            padding: '0.5rem 0.875rem', borderRadius: '20px', fontSize: '0.8rem',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'hsl(220 15% 60%)', cursor: 'pointer',
          }}>{s}</div>
        ))}
      </div>
    </div>
  )
}
