'use client'

import { useState, useEffect } from 'react'
import { Key, Eye, EyeOff, Trash2, CheckCircle, AlertCircle, Shield, ShieldOff, Database, Monitor } from 'lucide-react'
import { useSession } from '@/lib/session-context'
import { REMOTE_API_BASE, loginWithGithub } from '@/lib/config'

type Provider = 'anthropic' | 'openai' | 'google' | 'custom'

const PROVIDERS: { id: Provider; name: string; placeholder: string; color: string; docsUrl: string }[] = [
  { id: 'anthropic', name: 'Anthropic',  placeholder: 'sk-ant-api03-…', color: '#d97706', docsUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'openai',    name: 'OpenAI',     placeholder: 'sk-proj-…',      color: '#10b981', docsUrl: 'https://platform.openai.com/api-keys' },
  { id: 'google',    name: 'Google AI',  placeholder: 'AIza…',           color: '#3b82f6', docsUrl: 'https://aistudio.google.com/app/apikey' },
  { id: 'custom',    name: 'Custom Models', placeholder: 'Any key or leave blank…', color: '#8b5cf6', docsUrl: '#' },
]

const STORAGE_KEY = 'agenthub:api_keys'

function loadKeys(): Record<Provider, string> {
  const defaults: Record<Provider, string> = { anthropic: '', openai: '', google: '', custom: '' }
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (!raw) return defaults
    const parsed = JSON.parse(raw)
    return { ...defaults, ...parsed }
  } catch { return defaults }
}

function saveKeys(keys: Record<Provider, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
}

// Retrieve key for a session API call — used by future model gateway calls
export function getStoredKey(provider: Provider): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const keys = JSON.parse(raw) as Record<Provider, string>
    return keys[provider]?.trim() || null
  } catch { return null }
}

export function KeySettings() {
  const { user, loading: sessionLoading } = useSession()
  const [keys, setKeys]     = useState<Record<Provider, string>>({ anthropic: '', openai: '', google: '', custom: '' })
  const [visible, setVisible] = useState<Record<Provider, boolean>>({ anthropic: false, openai: false, google: false, custom: false })
  const [saved, setSaved]   = useState<Record<Provider, boolean>>({ anthropic: false, openai: false, google: false, custom: false })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setKeys(loadKeys())
    setMounted(true)
  }, [])

  function handleChange(p: Provider, value: string) {
    setKeys(prev => ({ ...prev, [p]: value }))
    setSaved(prev => ({ ...prev, [p]: false }))
  }

  function handleSave(p: Provider) {
    saveKeys({ ...keys })
    setSaved(prev => ({ ...prev, [p]: true }))
    setTimeout(() => setSaved(prev => ({ ...prev, [p]: false })), 2000)
  }

  function handleDelete(p: Provider) {
    const updated = { ...keys, [p]: '' }
    setKeys(updated)
    saveKeys(updated)
  }

  const isAnonymous = !sessionLoading && (!user || user.isAnonymous)

  if (!mounted || sessionLoading) {
    return (
      <div>
        {PROVIDERS.map(p => (
          <div key={p.id} className="skeleton" style={{ height: '108px', marginBottom: '1rem', borderRadius: '12px' }} />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Storage mode banner */}
      <div style={{
        display: 'flex', gap: '0.75rem', padding: '1rem 1.25rem', borderRadius: '12px',
        background: 'rgba(245,158,11,0.06)',
        border: '1px solid rgba(245,158,11,0.2)',
        marginBottom: '1.75rem', fontSize: '0.85rem', color: 'hsl(220 15% 65%)', lineHeight: 1.6,
      }}>
        <Monitor size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong style={{ color: '#f59e0b' }}>Browser storage</strong>
          {' — '}Your keys are stored in this browser only (localStorage). They are{' '}
          <strong style={{ color: '#fff' }}>never sent to AgentHub servers</strong>.
        </div>
      </div>

      {/* Key cards */}
      {PROVIDERS.map(({ id, name, placeholder, color, docsUrl }) => {
        const hasKey = keys[id].trim().length > 0

        return (
          <div key={id} style={{
            padding: '1.25rem',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${hasKey ? `${color}30` : 'rgba(255,255,255,0.07)'}`,
            borderRadius: '12px', marginBottom: '1rem', transition: 'border-color 0.2s',
          }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.875rem' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: hasKey ? '#22c55e' : 'rgba(255,255,255,0.2)',
                transition: 'background-color 0.2s', flexShrink: 0,
              }} />
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>{name}</span>
              {hasKey && (
                <span className="badge badge-ok" style={{ marginLeft: 'auto', fontSize: '0.72rem' }}>
                  <CheckCircle size={10} />
                  In browser
                </span>
              )}
              <a href={docsUrl} target="_blank" rel="noopener noreferrer"
                style={{ marginLeft: hasKey ? '0' : 'auto', fontSize: '0.75rem', color: '#818cf8', textDecoration: 'none' }}>
                Get key ↗
              </a>
            </div>

            {/* Input row — always show so users can manage browser storage even if logged in */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    id={`api-key-${id}`}
                    type={visible[id] ? 'text' : 'password'}
                    className="input"
                    value={keys[id]}
                    onChange={e => handleChange(id, e.target.value)}
                    placeholder={placeholder}
                    style={{ paddingRight: '2.75rem', fontFamily: 'monospace', fontSize: '0.8rem' }}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <button onClick={() => setVisible(v => ({ ...v, [id]: !v[id] }))}
                    style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(220 15% 50%)', padding: '0.25rem', display: 'flex' }}
                    aria-label={visible[id] ? 'Hide key' : 'Show key'}>
                    {visible[id] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button onClick={() => handleSave(id)} disabled={!keys[id].trim()} className="btn-primary"
                  style={{ padding: '0 1rem', fontSize: '0.82rem', opacity: keys[id].trim() ? 1 : 0.45, transition: 'opacity 0.2s' }}>
                  {saved[id] ? <CheckCircle size={14} /> : <Key size={14} />}
                  {saved[id] ? 'Saved!' : 'Save'}
                </button>
                {hasKey && (
                  <button onClick={() => handleDelete(id)} className="btn-ghost"
                    style={{ padding: '0 0.75rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                    aria-label={`Remove ${name} key`}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
          </div>
        )
      })}

      <div className="divider" />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.8rem', color: 'hsl(220 15% 40%)', lineHeight: 1.6 }}>
        <AlertCircle size={14} style={{ color: '#818cf8', flexShrink: 0, marginTop: '2px' }} />
        <span>
          Keys are stored securely in your browser's localStorage. They are never sent to AgentHub servers except when authenticating API requests to the model provider.
        </span>
      </div>
    </div>
  )
}
