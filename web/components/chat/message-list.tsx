'use client'

import { useRef, useEffect } from 'react'
import type { UIMessage } from './chat-interface'
import { User, Bot, AlertTriangle } from 'lucide-react'
import { ToolCallCard } from './tool-call-card'

// Minimal markdown-like rendering: bold, code, code blocks
function renderContent(content: string) {
  // Split on fenced code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g)
  return parts.map((part, i) => {
    if (part.startsWith('```')) {
      const lines = part.slice(3).split('\n')
      const lang = lines[0].trim()
      const code = lines.slice(1, -1).join('\n')
      return (
        <pre key={i} style={{
          background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px', padding: '1rem', overflow: 'auto',
          fontSize: '0.82rem', lineHeight: 1.6, margin: '0.75rem 0',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}>
          {lang && <div style={{ fontSize: '0.7rem', color: '#818cf8', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{lang}</div>}
          <code style={{ color: '#e2e8f0' }}>{code}</code>
        </pre>
      )
    }
    // Inline: bold, inline code
    const segments = part.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
    return (
      <span key={i}>
        {segments.map((seg, j) => {
          if (seg.startsWith('`') && seg.endsWith('`')) {
            return <code key={j} style={{ background: 'rgba(99,102,241,0.15)', color: '#c4b5fd', padding: '0.1em 0.35em', borderRadius: '4px', fontSize: '0.88em', fontFamily: 'monospace' }}>{seg.slice(1, -1)}</code>
          }
          if (seg.startsWith('**') && seg.endsWith('**')) {
            return <strong key={j} style={{ color: '#fff' }}>{seg.slice(2, -2)}</strong>
          }
          return <span key={j}>{seg}</span>
        })}
      </span>
    )
  })
}

function StreamingCursor() {
  return (
    <span style={{
      display: 'inline-block', width: '2px', height: '1em',
      background: '#818cf8', marginLeft: '2px', verticalAlign: 'text-bottom',
      animation: 'blink 0.75s step-end infinite',
    }} />
  )
}

interface MessageBubbleProps { msg: UIMessage }

function MessageBubble({ msg }: MessageBubbleProps) {
  const isUser = msg.role === 'user'
  const isError = msg.role === 'error'

  return (
    <div style={{
      display: 'flex', gap: '0.875rem', marginBottom: '1.5rem',
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
    }}>
      {/* Avatar */}
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isUser
          ? 'linear-gradient(135deg, #6366f1, #818cf8)'
          : isError
          ? 'rgba(239,68,68,0.15)'
          : 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(192,132,252,0.3))',
        border: `1px solid ${isError ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`,
      }}>
        {isUser ? <User size={15} color="#fff" /> : isError ? <AlertTriangle size={15} color="#ef4444" /> : <Bot size={15} color="#818cf8" />}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: '72%',
        padding: '0.875rem 1.1rem',
        borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
        background: isUser
          ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(99,102,241,0.15))'
          : isError
          ? 'rgba(239,68,68,0.08)'
          : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isUser ? 'rgba(99,102,241,0.25)' : isError ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`,
        fontSize: '0.9rem', lineHeight: 1.7, color: isError ? '#fca5a5' : '#e2e8f0',
      }}>
        {renderContent(msg.content)}
        {msg.isStreaming && !msg.toolCalls?.some(tc => tc.status === 'running') && <StreamingCursor />}

        {/* Tool call cards */}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            {msg.toolCalls.map(tc => (
              <ToolCallCard key={tc.call.id} state={tc} />
            ))}
          </div>
        )}

        {/* Usage footer */}
        {msg.usage && (
          <div style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: 'hsl(220 15% 40%)', display: 'flex', gap: '0.75rem' }}>
            <span>↑ {msg.usage.inputTokens} tokens</span>
            <span>↓ {msg.usage.outputTokens} tokens</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  )
}

export function MessageList({ messages }: { messages: UIMessage[] }) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <div ref={listRef} style={{ maxWidth: '800px', margin: '0 auto' }}>
      {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
    </div>
  )
}
