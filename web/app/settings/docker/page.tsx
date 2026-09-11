'use client'

import { useState, useEffect } from 'react'
import { LOCAL_API_BASE } from '@/lib/config'

interface DockerSettings {
  memory?: string
  cpu?: string
}

interface ToolInstall {
  toolId: string
  manifestJson: { name?: string, version: string, permissions?: { network?: boolean } }
}

export default function DockerSettingsPage() {
  const [memory, setMemory] = useState('256m')
  const [cpu, setCpu] = useState('0.5')
  
  const [customMemory, setCustomMemory] = useState('')
  const [customCpu, setCustomCpu] = useState('')

  const [perms, setPerms] = useState<Record<string, string>>({})
  const [installs, setInstalls] = useState<ToolInstall[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const PRESET_MEM = ['128m', '256m', '512m']
  const PRESET_CPU = ['0.25', '0.5', '1.0']

  useEffect(() => {
    Promise.all([
      fetch(`${LOCAL_API_BASE}/settings/docker`).then(res => res.json()),
      fetch(`${LOCAL_API_BASE}/settings/docker/tools`).then(res => res.json())
    ]).then(([settingsData, installsData]) => {
      const mem = settingsData.docker?.memory || '256m'
      const cp = settingsData.docker?.cpu || '0.5'
      setMemory(mem)
      setCpu(cp)
      if (!PRESET_MEM.includes(mem)) setCustomMemory(mem)
      if (!PRESET_CPU.includes(cp)) setCustomCpu(cp)
      
      setPerms(settingsData.perms || {})
      setInstalls(installsData.installs || [])
    }).finally(() => setLoading(false))
  }, [])

  const handleSave = async (m: string, c: string) => {
    // Hard-cap memory to 512m
    let finalMem = m
    if (m) {
      const memVal = parseInt(m)
      if (!isNaN(memVal)) {
        if (m.endsWith('g') || (m.endsWith('m') && memVal > 512)) {
          finalMem = '512m'
        }
      }
    } else {
      finalMem = '256m'
    }

    // Hard-cap CPU to 1.0
    let finalCpu = c
    if (c) {
      const cpuVal = parseFloat(c)
      if (!isNaN(cpuVal) && cpuVal > 1.0) {
        finalCpu = '1.0'
      }
    } else {
      finalCpu = '0.5'
    }

    setMemory(finalMem)
    setCpu(finalCpu)
    
    if (!PRESET_MEM.includes(finalMem)) setCustomMemory(finalMem)
    else setCustomMemory('')
    
    if (!PRESET_CPU.includes(finalCpu)) setCustomCpu(finalCpu)
    else setCustomCpu('')

    setSaving(true)

    try {
      await fetch(`${LOCAL_API_BASE}/settings/docker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docker: { memory: finalMem, cpu: finalCpu } })
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRevoke = async (toolId: string, version: string) => {
    const key = `${toolId}@${version}`
    const newPerms = { ...perms }
    delete newPerms[key]
    setPerms(newPerms)
    
    await fetch(`${LOCAL_API_BASE}/settings/docker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ perms: newPerms })
    })
  }

  if (loading) return <div style={{ color: '#e2e8f0', padding: '1rem' }}>Loading...</div>

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', marginBottom: '1.5rem' }}>
        Docker Sandbox Limits
      </h2>

      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#94a3b8', marginBottom: '0.5rem' }}>
          Memory Limit (Max: 512m)
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {PRESET_MEM.map(preset => (
            <button
              key={preset}
              onClick={() => handleSave(preset, cpu)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid',
                background: memory === preset ? '#3b82f6' : 'transparent',
                borderColor: memory === preset ? '#3b82f6' : '#334155',
                color: memory === preset ? '#fff' : '#cbd5e1',
                cursor: 'pointer'
              }}
            >
              {preset}
            </button>
          ))}
          <input 
            type="text" 
            value={customMemory} 
            onChange={e => {
              setCustomMemory(e.target.value)
            }}
            onBlur={() => {
              if (customMemory.trim() !== '') {
                handleSave(customMemory, cpu)
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && customMemory.trim() !== '') {
                handleSave(customMemory, cpu)
              }
            }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: (memory !== '' && !PRESET_MEM.includes(memory)) ? '#3b82f6' : '#334155',
              background: '#1e293b',
              color: '#f8fafc',
              width: '100px'
            }}
            placeholder="Custom"
          />
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#94a3b8', marginBottom: '0.5rem' }}>
          CPU Limit (Max: 1.0)
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {PRESET_CPU.map(preset => (
            <button
              key={preset}
              onClick={() => handleSave(memory, preset)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid',
                background: cpu === preset ? '#3b82f6' : 'transparent',
                borderColor: cpu === preset ? '#3b82f6' : '#334155',
                color: cpu === preset ? '#fff' : '#cbd5e1',
                cursor: 'pointer'
              }}
            >
              {preset}
            </button>
          ))}
          <input 
            type="text" 
            value={customCpu} 
            onChange={e => {
              setCustomCpu(e.target.value)
            }}
            onBlur={() => {
              if (customCpu.trim() !== '') {
                handleSave(memory, customCpu)
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && customCpu.trim() !== '') {
                handleSave(memory, customCpu)
              }
            }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: (cpu !== '' && !PRESET_CPU.includes(cpu)) ? '#3b82f6' : '#334155',
              background: '#1e293b',
              color: '#f8fafc',
              width: '100px'
            }}
            placeholder="Custom"
          />
        </div>
      </div>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem', marginTop: '3rem' }}>
        Tool Network Permissions
      </h2>
      <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
        Network access is disabled for all tools in this beta. This beta only supports fully sandboxed, network-isolated tools.
      </p>
      <div style={{ background: '#1e293b', borderRadius: '8px', border: '1px solid #334155', overflow: 'hidden' }}>
        {installs.length === 0 && (
          <div style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>No tools installed.</div>
        )}
        {installs.map(inst => {
          const version = inst.manifestJson.version || '0.0.0'
          const key = `${inst.toolId}@${version}`

          return (
            <div key={key} style={{ padding: '1rem', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#f8fafc', fontWeight: 500, marginBottom: '0.25rem' }}>{inst.manifestJson.name || inst.toolId}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Version {version} &bull; Network: Disabled</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

