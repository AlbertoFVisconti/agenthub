'use client'

import { useState, useEffect } from 'react'
import { Store, Search, Download, Package, ShieldCheck } from 'lucide-react'
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
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [sourceFiles, setSourceFiles] = useState<{name: string, size: number}[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [loadingSource, setLoadingSource] = useState(false)

  useEffect(() => {
    fetch(`${REMOTE_API_BASE}/marketplace/tools`)
      .then(async res => {
        if (!res.ok) throw new Error('Failed to load marketplace tools')
        return res.json()
      })
      .then(data => {
        if (data.tools) setTools(data.tools)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch tools', err)
        setError(err.message || 'Failed to fetch tools')
        setLoading(false)
      })
  }, [])

  const handleViewTool = async (tool: Tool) => {
    setSelectedTool(tool)
    setSourceFiles([])
    setSelectedFile(null)
    setFileContent('')
    setLoadingSource(true)

    try {
      const res = await fetch(`${REMOTE_API_BASE}/marketplace/tools/${tool.id}/files`)
      if (res.ok) {
        const data = await res.json()
        setSourceFiles(data.files || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingSource(false)
    }
  }

  const handleViewFile = async (toolId: string, filename: string) => {
    setSelectedFile(filename)
    setFileContent('Loading...')
    try {
      const res = await fetch(`${REMOTE_API_BASE}/marketplace/tools/${toolId}/files/${encodeURIComponent(filename)}`)
      if (res.ok) {
        const data = await res.json()
        setFileContent(data.content)
      } else {
        const data = await res.json()
        setFileContent('Error loading file: ' + data.message)
      }
    } catch (err: any) {
      setFileContent('Error loading file content: ' + err.message)
    }
  }

  const filteredTools = tools.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="gradient-bg" style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0 0 0.5rem', color: '#fff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Store size={36} color="#c084fc" />
              Tool Marketplace
            </h1>
            <p style={{ color: 'hsl(220 15% 65%)', fontSize: '1rem', maxWidth: '600px', lineHeight: 1.6 }}>
              Discover and install MCP tools to supercharge your AI agent.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: '3rem' }}>
          <Search size={20} color="#818cf8" style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search tools by name or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '1.25rem 1.25rem 1.25rem 3.5rem', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', color: '#fff', fontSize: '1.05rem', outline: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', transition: 'border-color 0.2s ease' }}
            onFocus={e => (e.target.style.borderColor = 'rgba(192, 132, 252, 0.5)')}
            onBlur={e => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
          />
        </div>

        {loading && !error && <div style={{ textAlign: 'center', padding: '4rem 0', color: 'hsl(220 15% 55%)' }}>Loading tools...</div>}
        {error && <div style={{ textAlign: 'center', padding: '5rem 0', color: '#ef4444' }}>{error}</div>}

        {!selectedTool ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {filteredTools.map(tool => (
              <div key={tool.id} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease', cursor: 'pointer' }}
                onClick={() => handleViewTool(tool)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #c084fc, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={22} color="#fff" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem', fontWeight: 600 }}>{tool.name}</h3>
                    <span style={{ color: 'hsl(220 15% 55%)', fontSize: '0.8rem' }}>v{tool.manifestJson?.version || '1.0.0'}</span>
                  </div>
                </div>
                <p style={{ color: 'hsl(220 15% 70%)', fontSize: '0.9rem', lineHeight: 1.5, flex: 1, marginBottom: '1.5rem' }}>{tool.description}</p>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem', color: 'hsl(220 15% 55%)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Download size={14} /> {tool.installCount || 0} installs
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '2rem' }}>
            <button onClick={() => setSelectedTool(null)} style={{ background: 'transparent', border: 'none', color: '#818cf8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', padding: 0, fontWeight: 600 }}>
               &larr; Back to Marketplace
            </button>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>{selectedTool.name}</h2>
            <p style={{ color: 'hsl(220 15% 65%)', fontSize: '1.1rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>{selectedTool.description}</p>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '2rem' }}>
              <h3 style={{ color: '#fff', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>View Source</h3>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ width: '280px', flexShrink: 0, background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h4 style={{ color: 'hsl(220 15% 60%)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Files</h4>
                  {loadingSource ? <div style={{ color: 'hsl(220 15% 55%)' }}>Loading...</div> : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {sourceFiles.map(f => (
                        <li key={f.name}>
                          <button onClick={() => handleViewFile(selectedTool.id, f.name)} style={{ width: '100%', textAlign: 'left', background: selectedFile === f.name ? 'rgba(129, 140, 248, 0.15)' : 'transparent', border: 'none', color: selectedFile === f.name ? '#818cf8' : 'hsl(220 15% 75%)', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                            <span style={{ fontSize: '0.75rem', color: 'hsl(220 15% 45%)' }}>{(f.size/1024).toFixed(1)}kb</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: '300px', background: '#0f111a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '0.75rem 1.5rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'hsl(220 15% 65%)', fontSize: '0.9rem' }}>{selectedFile || 'Select a file'}</div>
                  <div style={{ padding: '1.5rem', overflow: 'auto', flex: 1, maxHeight: '600px' }}>
                    <pre style={{ margin: 0, color: '#e2e8f0', fontFamily: 'monospace', fontSize: '0.9rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{fileContent}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
