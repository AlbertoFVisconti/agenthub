'use client'

import { useState, useEffect } from 'react'
import { Store, Search, Download, CheckCircle2, ChevronRight, Package, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { REMOTE_API_BASE } from '../../lib/config'

interface Tool {
  id: string
  name: string
  description: string
  installCount: number
  ownerId: string
  manifestJson: {
    version: string
  }
}

export default function MarketplacePage() {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState<Record<string, boolean>>({})
  const [installed, setInstalled] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${REMOTE_API_BASE}/marketplace/tools`)
      .then(async res => {
        if (!res.ok) throw new Error('Failed to load marketplace tools')
        return res.json()
      })
      .then(data => {
        if (data.tools) {
          setTools(data.tools)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch tools', err)
        setError(err.message || 'Failed to fetch tools')
        setLoading(false)
      })
  }, [])

  const handleInstall = async (toolId: string) => {
    setInstalling(prev => ({ ...prev, [toolId]: true }))
    try {
      const res = await fetch(`${REMOTE_API_BASE}/marketplace/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId })
      })
      if (res.ok) {
        setInstalled(prev => ({ ...prev, [toolId]: true }))
      } else {
        alert('Failed to install tool. Ensure you are logged in.')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setInstalling(prev => ({ ...prev, [toolId]: false }))
    }
  }

  const filteredTools = tools.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="gradient-bg" style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Store size={36} color="#c084fc" />
              Tool Marketplace
            </h1>
            <p style={{ color: 'hsl(220 15% 65%)', fontSize: '1rem', maxWidth: '600px', lineHeight: 1.6 }}>
              Discover and install MCP tools to supercharge your AI agent. Tools execute locally in sandboxed Docker containers.
            </p>
          </div>
          <Link href="/chat" className="btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Go to Chat <ChevronRight size={16} />
          </Link>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: '3rem' }}>
          <Search size={20} color="#818cf8" style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search tools by name or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '1.25rem 1.25rem 1.25rem 3.5rem',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#fff',
              fontSize: '1.05rem',
              outline: 'none',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              transition: 'border-color 0.2s ease'
            }}
            onFocus={e => (e.target.style.borderColor = 'rgba(192, 132, 252, 0.5)')}
            onBlur={e => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
          />
        </div>

        {/* Loading State */}
        {loading && !error && (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'hsl(220 15% 55%)' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem' }} />
            Loading tools...
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{ textAlign: 'center', padding: '5rem 0', background: 'rgba(239,68,68,0.1)', borderRadius: '16px', border: '1px dashed rgba(239,68,68,0.3)' }}>
            <ShieldCheck size={48} color="#ef4444" style={{ opacity: 0.5, marginBottom: '1rem' }} />
            <h3 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '0.5rem' }}>Error loading marketplace</h3>
            <p style={{ color: 'hsl(220 15% 75%)' }}>{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredTools.length === 0 && (
          <div style={{ textAlign: 'center', padding: '5rem 0', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <Package size={48} color="#818cf8" style={{ opacity: 0.5, marginBottom: '1rem' }} />
            <h3 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '0.5rem' }}>No tools found</h3>
            <p style={{ color: 'hsl(220 15% 55%)' }}>Try adjusting your search query or check back later.</p>
          </div>
        )}

        {/* Tools Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {filteredTools.map(tool => (
            <div key={tool.id} style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
              cursor: 'default',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.3)'
              e.currentTarget.style.borderColor = 'rgba(192, 132, 252, 0.3)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
            }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #c084fc, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={22} color="#fff" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem', fontWeight: 600 }}>{tool.name}</h3>
                    <span style={{ color: 'hsl(220 15% 55%)', fontSize: '0.8rem' }}>v{tool.manifestJson?.version || '1.0.0'}</span>
                  </div>
                </div>
              </div>
              
              <p style={{ color: 'hsl(220 15% 70%)', fontSize: '0.9rem', lineHeight: 1.5, flex: 1, marginBottom: '1.5rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {tool.description}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'hsl(220 15% 55%)', fontSize: '0.8rem' }}>
                  <Download size={14} />
                  <span>{tool.installCount || 0} installs</span>
                </div>
                
                {installed[tool.id] ? (
                  <button disabled style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '6px', padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, cursor: 'default' }}>
                    <CheckCircle2 size={14} />
                    Installed
                  </button>
                ) : (
                  <button 
                    onClick={() => handleInstall(tool.id)}
                    disabled={installing[tool.id]}
                    style={{ background: '#c084fc', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, cursor: installing[tool.id] ? 'wait' : 'pointer', transition: 'background 0.2s ease', opacity: installing[tool.id] ? 0.7 : 1 }}
                    onMouseEnter={e => !installing[tool.id] && (e.currentTarget.style.background = '#a855f7')}
                    onMouseLeave={e => !installing[tool.id] && (e.currentTarget.style.background = '#c084fc')}
                  >
                    {installing[tool.id] ? 'Installing...' : 'Install'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
