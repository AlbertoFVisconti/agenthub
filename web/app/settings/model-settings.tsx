'use client'

import { useState } from 'react'
import { useModelCatalogue, ModelEntry } from '@/lib/use-models'
import { Plus, Trash2, Edit2 } from 'lucide-react'

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

export function ModelSettings() {
  const { models, saveModels, loaded } = useModelCatalogue()
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [newModel, setNewModel] = useState<ModelEntry>({ provider: 'openai', id: '', label: '', tier: 'fast' })

  if (!loaded) return null

  const handleSave = (m: ModelEntry) => {
    // replace or append
    const existingIdx = models.findIndex(x => x.id === m.id && x.provider === m.provider)
    if (existingIdx >= 0) {
      const next = [...models]
      next[existingIdx] = m
      saveModels(next)
    } else {
      saveModels([...models, m])
    }
    setEditingId(null)
    setNewModel({ provider: 'openai', id: '', label: '', tier: 'fast' })
  }

  const handleDelete = (provider: string, id: string) => {
    saveModels(models.filter(m => !(m.provider === provider && m.id === id)))
  }

  const grouped = models.reduce<Record<string, ModelEntry[]>>((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = []
    acc[m.provider].push(m)
    return acc
  }, {})

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
      <h2 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem' }}>Manage Models</h2>
      
      {Object.entries(grouped).map(([provider, providerModels]) => (
        <div key={provider} style={{ marginBottom: '1.5rem' }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
            {PROVIDER_LABELS[provider] || provider}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {providerModels.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                {editingId === m.id ? (
                  <ModelForm initial={m} onSave={handleSave} onCancel={() => setEditingId(null)} />
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ color: '#fff', fontWeight: 500, fontSize: '0.9rem' }}>{m.label}</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', fontFamily: 'monospace' }}>{m.id}</span>
                      {m.tier && (
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                          color: TIER_COLORS[m.tier] || '#9ca3af',
                          background: (TIER_COLORS[m.tier] || '#9ca3af') + '20',
                          padding: '0.15rem 0.4rem', borderRadius: '4px'
                        }}>
                          {m.tier}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => setEditingId(m.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(m.provider, m.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      
      <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 500, marginBottom: '1rem' }}>Add New Model</h3>
        <ModelForm initial={newModel} onSave={handleSave} onCancel={() => setNewModel({ provider: 'openai', id: '', label: '', tier: 'fast' })} />
      </div>
    </div>
  )
}

function ModelForm({ initial, onSave, onCancel }: { initial: ModelEntry, onSave: (m: ModelEntry) => void, onCancel: () => void }) {
  const [model, setModel] = useState(initial)
  
  return (
    <div style={{ display: 'flex', gap: '0.75rem', width: '100%', alignItems: 'center', flexWrap: 'wrap' }}>
      <CustomSelect
        value={model.provider} onChange={val => setModel({...model, provider: val})}
        options={[
          { value: 'openai', label: 'OpenAI' },
          { value: 'anthropic', label: 'Anthropic' },
          { value: 'google', label: 'Google' },
          { value: 'custom', label: 'Custom' }
        ]}
      />
      
      <input 
        type="text" placeholder="Model ID (e.g. gpt-4)" value={model.id} onChange={e => setModel({...model, id: e.target.value})}
        style={{ flex: 1, minWidth: '150px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: '6px', colorScheme: 'dark' }}
      />
      
      <input 
        type="text" placeholder="Display Name" value={model.label} onChange={e => setModel({...model, label: e.target.value})}
        style={{ flex: 1, minWidth: '150px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: '6px', colorScheme: 'dark' }}
      />
      
      {model.provider === 'custom' && (
        <input 
          type="text" placeholder="Base URL (e.g. http://127.0.0.1:11434/v1)" value={model.baseUrl || ''} onChange={e => setModel({...model, baseUrl: e.target.value})}
          style={{ flex: 1, minWidth: '200px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: '6px', colorScheme: 'dark' }}
        />
      )}
      
      <CustomSelect
        value={model.tier} onChange={val => setModel({...model, tier: val})}
        options={[
          { value: '', label: 'No Badge' },
          { value: 'fast', label: 'Fast' },
          { value: 'premium', label: 'Premium' },
          { value: 'standard', label: 'Standard' },
          { value: 'reasoning', label: 'Reasoning' }
        ]}
      />
      
      <button onClick={() => onSave(model)} style={{ padding: '0.5rem 1rem', background: '#818cf8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
        Save
      </button>
      <button onClick={onCancel} style={{ padding: '0.5rem 1rem', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', cursor: 'pointer' }}>
        Cancel
      </button>
    </div>
  )
}
function CustomSelect({
  value,
  onChange,
  options
}: {
  value: string
  onChange: (val: string) => void
  options: {value: string, label: string}[]
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value)

  return (
    <div style={{ position: 'relative' }}>
      <div 
        onClick={() => setOpen(!open)}
        style={{ 
          background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', 
          padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', minWidth: '120px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}
      >
        {selected?.label ?? value}
        <span style={{ fontSize: '0.7em', opacity: 0.5 }}>▼</span>
      </div>
      
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: '4px',
            background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px', overflow: 'hidden', zIndex: 50,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)', minWidth: '100%'
          }}>
            {options.map(opt => (
              <div 
                key={opt.value}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                style={{
                  padding: '0.5rem', cursor: 'pointer', color: '#fff',
                  background: opt.value === value ? 'rgba(255,255,255,0.1)' : 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = opt.value === value ? 'rgba(255,255,255,0.1)' : 'transparent'}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
