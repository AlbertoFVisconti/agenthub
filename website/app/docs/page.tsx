'use client'

import Link from 'next/link'
import { ArrowLeft, PenTool, Server } from 'lucide-react'

export default function DocsIndex() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 1.5rem', lineHeight: 1.7 }}>
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#6366f1', textDecoration: 'none', marginBottom: '2rem', fontWeight: 500 }}>
        <ArrowLeft size={16} /> Back to home
      </Link>

      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', color: '#fff', letterSpacing: '-0.02em' }}>
        Documentation
      </h1>
      <p style={{ fontSize: '1.125rem', color: 'hsl(220 15% 70%)', marginBottom: '3rem' }}>
        Learn how to extend AgentHub with your own tools and models.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <Link href="/docs/create-tool" style={{ textDecoration: 'none' }}>
          <div style={{ padding: '2rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', transition: 'all 0.2s', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99,102,241,0.1)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PenTool size={24} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff', margin: 0 }}>Create a Tool</h2>
            <p style={{ color: 'hsl(220 15% 70%)', margin: 0 }}>Learn how to scaffold, write, test, and publish a tool to the AgentHub Marketplace.</p>
          </div>
        </Link>
        <Link href="/docs/connect-local-model" style={{ textDecoration: 'none' }}>
          <div style={{ padding: '2rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', transition: 'all 0.2s', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(52,211,153,0.1)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Server size={24} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff', margin: 0 }}>Connect Local Model</h2>
            <p style={{ color: 'hsl(220 15% 70%)', margin: 0 }}>Configure AgentHub to use your locally hosted LLM via Ollama, LM Studio, etc.</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
