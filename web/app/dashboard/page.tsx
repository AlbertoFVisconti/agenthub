'use client'

import { useState, useEffect, useRef } from 'react'
import { BarChart3, Activity, AlertCircle, Download, Package, ChevronRight, LayoutDashboard, Loader2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { REMOTE_API_BASE, loginWithGithub } from '../../lib/config'

interface ToolMetrics {
  installCount: number
  invocations30d: number
  errors30d: number
}

interface Tool {
  id: string
  name: string
  description: string
  status: string
  metrics?: ToolMetrics
}

export default function DashboardPage() {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadTools = async () => {
    try {
      const res = await fetch(`${REMOTE_API_BASE}/creator/tools`)
      if (!res.ok) throw new Error('Unauthorized')
      const data = await res.json()
      if (data.tools) {
        const toolsWithMetrics = await Promise.all(
          data.tools.map(async (tool: Tool) => {
            try {
              const metricRes = await fetch(`${REMOTE_API_BASE}/creator/tools/${tool.id}/metrics`)
              if (metricRes.ok) {
                tool.metrics = await metricRes.json()
              }
            } catch (e) {
              console.error('Failed to fetch metrics for', tool.id)
            }
            return tool
          })
        )
        setTools(toolsWithMetrics)
      }
    } catch (err: any) {
      if (err.message !== 'Unauthorized') console.error('Failed to fetch tools', err)
      setError(err.message || 'Failed to fetch tools')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTools()
  }, [])

  const handleDeleteTool = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tool? It will be removed from the marketplace but remain available to existing users.')) return

    try {
      const res = await fetch(`${REMOTE_API_BASE}/marketplace/tools/${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to delete tool')
      }
      setTools(tools.filter(t => t.id !== id))
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsPublishing(true)
    setPublishError(null)

    const formData = new FormData()
    formData.append('package', file)

    try {
      const res = await fetch(`${REMOTE_API_BASE}/marketplace/publish`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        const code = data.error
        let msg = data.message || 'An unknown error occurred.'
        if (code === 'BAD_REQUEST') msg = 'Invalid request. Please provide a valid .zip file.'
        else if (code === 'FORBIDDEN') msg = 'You must be signed in and own this tool to publish updates.'
        else if (code === 'INVALID_PACKAGE') msg = 'The package is missing a manifest.json file.'
        else if (code === 'INVALID_MANIFEST') msg = 'Invalid manifest.json: ' + (data.message || '')
        else if (code === 'DRY_RUN_FAILED') msg = 'The tool failed the MCP handshake during the dry run.'
        else if (code === 'INTERNAL_ERROR') msg = 'An internal server error occurred while publishing.'
        
        throw new Error(msg)
      }

      await loadTools()
    } catch (err: any) {
      setPublishError(err.message || 'Something went wrong while publishing.')
    } finally {
      setIsPublishing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (loading && !error) {
    return (
      <div className="gradient-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (error === 'Unauthorized') {
    return (
      <div className="gradient-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', maxWidth: '400px' }}>
          <LayoutDashboard size={48} color="#38bdf8" style={{ margin: '0 auto 1.5rem', opacity: 0.8 }} />
          <h2 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1.5rem' }}>Creator Dashboard</h2>
          <p style={{ color: 'hsl(220 15% 65%)', marginBottom: '2rem', lineHeight: 1.6 }}>
            Sign in with GitHub to view your published tools and monitor their performance.
          </p>
          <button
            onClick={() => loginWithGithub()}
            className="btn-primary"
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', fontSize: '1rem', fontWeight: 600 }}
          >
            Sign in with GitHub
          </button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="gradient-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(239,68,68,0.1)', borderRadius: '16px', border: '1px dashed rgba(239,68,68,0.3)' }}>
          <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ color: '#fff', marginBottom: '0.5rem' }}>Failed to load dashboard</h2>
          <p style={{ color: 'hsl(220 15% 75%)' }}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="gradient-bg" style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <BarChart3 size={36} color="#38bdf8" />
              Creator Dashboard
            </h1>
            <p style={{ color: 'hsl(220 15% 65%)', fontSize: '1rem', maxWidth: '600px', lineHeight: 1.6 }}>
              Monitor the performance, installs, and reliability of the MCP tools you have published to the marketplace.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {publishError && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', maxWidth: '300px', lineHeight: 1.2, background: 'rgba(239,68,68,0.1)', padding: '0.5rem', borderRadius: '6px' }}>
                {publishError}
              </div>
            )}
            <input 
              type="file" 
              accept=".zip" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileChange}
            />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isPublishing}
              className="btn-primary" 
              style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', cursor: isPublishing ? 'wait' : 'pointer', background: isPublishing ? '#475569' : '#38bdf8', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {isPublishing ? (
                <>
                  <Loader2 size={16} className="spinner-icon" style={{ animation: 'spin 1s linear infinite' }} />
                  Publishing...
                </>
              ) : (
                'Publish New Tool'
              )}
            </button>
            <Link href="/marketplace" className="btn-secondary" style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 600 }}>
              Browse Marketplace <ChevronRight size={16} />
            </Link>
          </div>
        </div>

        {/* Empty State */}
        {tools.length === 0 && (
          <div style={{ textAlign: 'center', padding: '5rem 0', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <Package size={48} color="#38bdf8" style={{ opacity: 0.5, marginBottom: '1rem' }} />
            <h3 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '0.5rem' }}>No published tools</h3>
            <p style={{ color: 'hsl(220 15% 55%)' }}>You haven&apos;t published any tools yet. Click &quot;Publish New Tool&quot; above to upload a .zip package.</p>
          </div>
        )}

        {/* Tools List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {tools.map(tool => (
            <div key={tool.id} style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem',
              transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.3)'
              e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.3)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
            }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>{tool.name}</h3>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ color: 'hsl(220 15% 60%)', fontSize: '0.9rem' }}>{tool.description}</span>
                    <span style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                      {tool.status}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteTool(tool.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    opacity: 0.8,
                    transition: 'opacity 0.2s ease, background 0.2s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.opacity = '1'
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.opacity = '0.8'
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>

              {/* Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                
                {/* Installs Card */}
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(220 15% 55%)', marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: 500 }}>
                    <Download size={18} color="#a855f7" /> Total Installs
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>
                    {tool.metrics?.installCount ?? 0}
                  </div>
                </div>

                {/* Invocations Card */}
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(220 15% 55%)', marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: 500 }}>
                    <Activity size={18} color="#38bdf8" /> 30-Day Invocations
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>
                    {tool.metrics?.invocations30d ?? 0}
                  </div>
                </div>

                {/* Errors Card */}
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(220 15% 55%)', marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: 500 }}>
                    <AlertCircle size={18} color="#ef4444" /> 30-Day Errors
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>
                    {tool.metrics?.errors30d ?? 0}
                  </div>
                  {tool.metrics && tool.metrics.invocations30d > 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'hsl(220 15% 45%)', marginTop: '0.5rem' }}>
                      {((tool.metrics.errors30d / (tool.metrics.invocations30d + tool.metrics.errors30d)) * 100).toFixed(1)}% Error Rate
                    </div>
                  )}
                </div>

              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


