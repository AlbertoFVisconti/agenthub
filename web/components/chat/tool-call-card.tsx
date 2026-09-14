'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Wrench, CheckCircle, AlertTriangle, Loader, ShieldAlert } from 'lucide-react'
import type { ToolCall } from '@agenthub-tools/types'
import { LOCAL_API_BASE } from '../../lib/config'

export interface ToolCallState {
  call: ToolCall
  status: 'running' | 'done' | 'error' | 'pending_confirmation'
  result?: string
  confirmCmd?: string
}

interface ToolCallCardProps {
  state: ToolCallState
  onConfirmed?: () => void
}

export function ToolCallCard({ state, onConfirmed }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)
  const { call, status, result, confirmCmd } = state

  const isPending = status === 'pending_confirmation'

  const statusIcon =
    isPending            ? <ShieldAlert size={13} style={{ color: '#fbbf24' }} /> :
    status === 'running' ? <Loader size={13} style={{ animation: 'spin 1s linear infinite', color: '#818cf8' }} /> :
    status === 'done'    ? <CheckCircle size={13} style={{ color: '#22c55e' }} /> :
                           <AlertTriangle size={13} style={{ color: '#ef4444' }} />

  const statusColor =
    isPending            ? 'rgba(245,158,11,0.12)' :
    status === 'running' ? 'rgba(99,102,241,0.12)' :
    status === 'done'    ? 'rgba(34,197,94,0.08)'  :
                           'rgba(239,68,68,0.08)'

  const borderColor =
    isPending            ? 'rgba(245,158,11,0.3)'  :
    status === 'running' ? 'rgba(99,102,241,0.25)' :
    status === 'done'    ? 'rgba(34,197,94,0.2)'   :
                           'rgba(239,68,68,0.2)'


  const handleConfirm = async (approved: boolean | string) => {
    try {
      await fetch(`${LOCAL_API_BASE}/agent/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          callId: call.id, 
          approved,
        })
      })
      onConfirmed?.()
    } catch (err) {
      console.error('Failed to confirm', err)
    }
  }

  return (
    <div style={{
      margin: '0.5rem 0', borderRadius: '10px',
      background: statusColor, border: `1px solid ${borderColor}`,
      fontSize: '0.82rem', overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          width: '100%', padding: '0.6rem 0.875rem',
          background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', color: '#e2e8f0',
        }}
      >
        <Wrench size={13} style={{ color: 'hsl(220 15% 55%)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#c4b5fd' }}>
          {call.name}
        </span>
        <span style={{ color: 'hsl(220 15% 50%)', fontWeight: 400, flex: 1 }}>
          {isPending ? 'waiting for approval...' : status === 'running' ? 'running...' : status === 'done' ? 'completed' : 'failed'}
        </span>
        {statusIcon}
        {expanded || isPending
          ? <ChevronDown size={13} style={{ color: 'hsl(220 15% 45%)', flexShrink: 0 }} />
          : <ChevronRight size={13} style={{ color: 'hsl(220 15% 45%)', flexShrink: 0 }} />
        }
      </button>

      {(expanded || isPending) && (
        <div style={{ padding: '0 0.875rem 0.875rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {isPending && confirmCmd && (
            <div style={{ marginTop: '0.6rem', padding: '0.75rem', background: 'rgba(245,158,11,0.1)', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fcd34d', marginBottom: '0.5rem' }}>
                Confirmation Required
              </div>
              <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.75rem', color: '#e2e8f0', marginBottom: '0.75rem', whiteSpace: 'pre-wrap' }}>
                {confirmCmd}
              </pre>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => handleConfirm(true)} style={{
                  padding: '0.4rem 0.75rem', background: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600
                }}>Proceed</button>
                <button onClick={() => handleConfirm(false)} style={{
                  padding: '0.4rem 0.75rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600
                }}>Reject</button>
              </div>
            </div>
          )}

          <div style={{ marginTop: '0.6rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(220 15% 45%)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
              Input
            </div>
            <pre style={{
              background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '0.6rem 0.75rem',
              overflow: 'auto', fontSize: '0.78rem', color: '#e2e8f0', margin: 0,
              fontFamily: "'JetBrains Mono','Fira Code',monospace", lineHeight: 1.5,
            }}>
              {JSON.stringify(call.input, null, 2)}
            </pre>
          </div>

          {result !== undefined && (
            <div style={{ marginTop: '0.6rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(220 15% 45%)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                {status === 'error' ? 'Error' : 'Result'}
              </div>
              <pre style={{
                background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '0.6rem 0.75rem',
                overflow: 'auto', fontSize: '0.78rem', margin: 0,
                color: status === 'error' ? '#fca5a5' : '#86efac',
                fontFamily: "'JetBrains Mono','Fira Code',monospace", lineHeight: 1.5,
                maxHeight: '200px',
              }}>
                {result}
              </pre>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}


