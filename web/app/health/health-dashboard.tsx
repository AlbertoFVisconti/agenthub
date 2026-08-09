'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Clock, Database, Server } from 'lucide-react'
import { REMOTE_API_BASE } from '../../lib/config'

interface HealthData {
  status: 'ok' | 'degraded' | 'error'
  version: string
  db: 'ok' | 'error'
  uptime: number
}

type FetchStatus = 'loading' | 'ok' | 'degraded' | 'error' | 'unreachable'

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

function StatusIcon({ status }: { status: FetchStatus }) {
  if (status === 'loading') return <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', color: '#818cf8' }} />
  if (status === 'ok') return <CheckCircle size={18} style={{ color: '#22c55e' }} />
  if (status === 'degraded') return <AlertCircle size={18} style={{ color: '#f59e0b' }} />
  return <XCircle size={18} style={{ color: '#ef4444' }} />
}

function StatusBadge({ status }: { status: FetchStatus }) {
  const map: Record<FetchStatus, { cls: string; label: string }> = {
    loading:     { cls: 'badge-neutral', label: 'Checking…' },
    ok:          { cls: 'badge-ok',      label: 'Operational' },
    degraded:    { cls: 'badge-warning', label: 'Degraded' },
    error:       { cls: 'badge-error',   label: 'Error' },
    unreachable: { cls: 'badge-error',   label: 'Unreachable' },
  }
  const { cls, label } = map[status]
  return <span className={`badge ${cls}`}>{label}</span>
}

interface ServiceRowProps {
  icon: React.ReactNode
  name: string
  description: string
  status: FetchStatus
  detail?: string
}

function ServiceRow({ icon, name, description, status, detail }: ServiceRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1.25rem',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px',
        marginBottom: '0.75rem',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'hsl(220 15% 55%)',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff', marginBottom: '0.15rem' }}>
          {name}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'hsl(220 15% 50%)' }}>{description}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
        {detail && (
          <span style={{ fontSize: '0.8rem', color: 'hsl(220 15% 50%)', fontFamily: 'monospace' }}>
            {detail}
          </span>
        )}
        <StatusIcon status={status} />
        <StatusBadge status={status} />
      </div>
    </div>
  )
}

export function HealthDashboard() {
  const [data, setData] = useState<HealthData | null>(null)
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('loading')
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  async function check() {
    setFetchStatus('loading')
    try {
      const res = await fetch(`${REMOTE_API_BASE}/health`, { cache: 'no-store' })
      if (!res.ok) {
        setFetchStatus('error')
        return
      }
      const json: HealthData = await res.json()
      setData(json)
      setFetchStatus(json.status === 'ok' ? 'ok' : 'degraded')
      setLastChecked(new Date())
    } catch {
      setFetchStatus('unreachable')
      setData(null)
    }
  }

  useEffect(() => {
    check()
    const interval = setInterval(check, 15_000)
    return () => clearInterval(interval)
  }, [])

  const apiStatus: FetchStatus = fetchStatus === 'loading' ? 'loading'
    : fetchStatus === 'unreachable' ? 'unreachable'
    : data ? 'ok'
    : 'error'

  const dbStatus: FetchStatus = fetchStatus === 'loading' ? 'loading'
    : fetchStatus === 'unreachable' ? 'unreachable'
    : data?.db === 'ok' ? 'ok'
    : 'error'

  const overallStatus: FetchStatus = fetchStatus === 'loading' ? 'loading'
    : apiStatus === 'ok' && dbStatus === 'ok' ? 'ok'
    : apiStatus === 'unreachable' ? 'unreachable'
    : 'degraded'

  return (
    <div className="fade-in">
      {/* Overall status banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1.25rem 1.5rem',
          borderRadius: '14px',
          marginBottom: '2rem',
          background: overallStatus === 'ok'
            ? 'rgba(34,197,94,0.06)'
            : overallStatus === 'degraded'
            ? 'rgba(245,158,11,0.06)'
            : 'rgba(239,68,68,0.06)',
          border: `1px solid ${overallStatus === 'ok' ? 'rgba(34,197,94,0.2)' : overallStatus === 'degraded' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
        }}
      >
        <StatusIcon status={overallStatus} />
        <div>
          <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>
            {overallStatus === 'ok' ? 'All systems operational'
              : overallStatus === 'degraded' ? 'Partial outage detected'
              : overallStatus === 'loading' ? 'Checking services…'
              : 'API server unreachable'}
          </div>
          {lastChecked && (
            <div style={{ fontSize: '0.78rem', color: 'hsl(220 15% 50%)', marginTop: '0.15rem' }}>
              Last checked: {lastChecked.toLocaleTimeString()}
            </div>
          )}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={check}
            className="btn-ghost"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', gap: '0.35rem' }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Services */}
      <ServiceRow
        icon={<Server size={18} />}
        name="API Server"
        description="Fastify backend on port 8080"
        status={apiStatus}
        detail={data ? `v${data.version}` : undefined}
      />
      <ServiceRow
        icon={<Database size={18} />}
        name="PostgreSQL"
        description="Primary database via Drizzle ORM"
        status={dbStatus}
      />
      <ServiceRow
        icon={<Clock size={18} />}
        name="Uptime"
        description="API server process uptime"
        status={apiStatus === 'ok' ? 'ok' : 'loading'}
        detail={data ? formatUptime(data.uptime) : undefined}
      />

      {/* Style for spin animation */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
