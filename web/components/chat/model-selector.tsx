'use client'

import { useState, useEffect } from 'react'
import { useModelCatalogue } from '@/lib/use-models'
import { ChevronDown } from 'lucide-react'

const TIER_COLORS: Record<string, string> = {
  premium:   '#818cf8',
  standard:  '#34d399',
  fast:      '#38bdf8',
  reasoning: '#c084fc',
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai:    'OpenAI',
  google:    'Google',
}

interface ModelSelectorProps {
  provider: string
  model: string
  onChange: (provider: string, model: string) => void
  disabled?: boolean
}

export function ModelSelector({ provider, model, onChange, disabled }: ModelSelectorProps) {
  const { models } = useModelCatalogue()
  const [open, setOpen] = useState(false)
  const [customModel, setCustomModel] = useState('')
  const selected = models.find(m => m.id === model)

  const grouped = models.reduce<Record<string, typeof models[number][]>>((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = []
    acc[m.provider].push(m)
    return acc
  }, {})

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.35rem 0.75rem', borderRadius: '8px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', fontSize: '0.82rem', fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1, transition: 'all 0.15s',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <span style={{
          width: '7px', height: '7px', borderRadius: '50%',
          backgroundColor: TIER_COLORS[selected?.tier ?? 'fast'],
          flexShrink: 0,
        }} />
        <span style={{ color: 'hsl(220 15% 60%)', fontWeight: 400, fontSize: '0.78rem' }}>
          {PROVIDER_LABELS[provider]}
        </span>
        <span>{selected?.label ?? model}</span>
        <ChevronDown size={13} style={{ color: 'hsl(220 15% 50%)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          {/* Dropdown */}
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
            background: 'hsl(225 22% 11%)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px', padding: '0.5rem', minWidth: '260px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          }}>
            {Object.entries(grouped).map(([prov, models]) => (
              <div key={prov}>
                <div style={{ padding: '0.35rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, color: 'hsl(220 15% 45%)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {PROVIDER_LABELS[prov]}
                </div>
                {models.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { onChange(m.provider, m.id); setOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem',
                      width: '100%', padding: '0.5rem 0.6rem', borderRadius: '8px',
                      background: m.id === model ? 'rgba(99,102,241,0.12)' : 'transparent',
                      border: m.id === model ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
                      color: m.id === model ? '#fff' : 'hsl(220 15% 65%)',
                      fontSize: '0.83rem', fontWeight: m.id === model ? 600 : 400,
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <span style={{
                      width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                      backgroundColor: TIER_COLORS[m.tier],
                    }} />
                    <span style={{ flex: 1 }}>{m.label}</span>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 600, padding: '0.1rem 0.4rem',
                      borderRadius: '4px', letterSpacing: '0.04em',
                      background: `${TIER_COLORS[m.tier]}18`,
                      color: TIER_COLORS[m.tier], textTransform: 'capitalize',
                    }}>
                      {m.tier}
                    </span>
                  </button>
                ))}
                
                {prov === 'openai' && (
                  <div style={{ padding: '0.2rem 0', marginTop: '0.2rem' }}>
                    <input 
                      type="text"
                      placeholder="Type custom model & press Enter..."
                      value={customModel}
                      onChange={e => setCustomModel(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      onKeyDown={e => {
                        e.stopPropagation()
                        if (e.key === 'Enter' && customModel.trim()) {
                          onChange('openai', customModel.trim())
                          setOpen(false)
                          setCustomModel('')
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.6rem',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px dashed rgba(255,255,255,0.15)',
                        color: '#fff',
                        fontSize: '0.78rem',
                        fontFamily: 'var(--font-sans)',
                        outline: 'none',
                        transition: 'border-color 0.15s'
                      }}
                      onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.5)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
                    />
                  </div>
                )}
                
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0.35rem 0' }} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
