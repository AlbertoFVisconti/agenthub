'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, Square, Paperclip } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  onStop: () => void
  streaming: boolean
}

export function ChatInput({ onSend, onStop, streaming }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || streaming) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [value, streaming, onSend])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div style={{
      borderTop: '1px solid rgba(255,255,255,0.07)',
      padding: '1rem 1.5rem 1.25rem',
      backgroundColor: 'rgba(10,10,20,0.8)',
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{
        maxWidth: '800px', margin: '0 auto',
        display: 'flex', alignItems: 'flex-end', gap: '0.75rem',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px', padding: '0.6rem 0.75rem',
        transition: 'border-color 0.2s',
      }}
        onFocusCapture={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)')}
        onBlurCapture={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
      >
        {/* Attach icon (future) */}
        <button disabled style={{ background: 'none', border: 'none', cursor: 'not-allowed', color: 'hsl(220 15% 35%)', padding: '0.25rem', display: 'flex', flexShrink: 0 }} title="Attachments coming soon">
          <Paperclip size={16} />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          id="chat-input"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message the agent… (Enter to send, Shift+Enter for newline)"
          rows={1}
          disabled={false}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none',
            color: '#e2e8f0', fontSize: '0.9rem', lineHeight: 1.6,
            fontFamily: 'var(--font-inter, sans-serif)',
            padding: '0.25rem 0', minHeight: '28px', maxHeight: '200px',
          }}
        />

        {/* Send / Stop button */}
        {streaming ? (
          <button
            onClick={onStop}
            style={{
              width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.15s', color: '#ef4444',
            }}
            title="Stop streaming"
          >
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!value.trim()}
            style={{
              width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
              background: value.trim() ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${value.trim() ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: value.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s', color: value.trim() ? '#fff' : 'hsl(220 15% 35%)',
              boxShadow: value.trim() ? '0 0 16px rgba(99,102,241,0.3)' : 'none',
            }}
            title="Send message"
          >
            <Send size={14} />
          </button>
        )}
      </div>

      <div style={{ maxWidth: '800px', margin: '0.4rem auto 0', fontSize: '0.72rem', color: 'hsl(220 15% 35%)', textAlign: 'center' }}>
        Your API key is used directly — AgentHub never sees your conversations.
      </div>
    </div>
  )
}
