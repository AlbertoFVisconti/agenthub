import type { Metadata } from 'next'
import { HealthDashboard } from './health-dashboard'

export const metadata: Metadata = {
  title: 'System Health',
  description: 'AgentHub system health and connectivity status.',
}

export default function HealthPage() {
  return (
    <div
      className="gradient-bg"
      style={{ minHeight: 'calc(100vh - 60px)', padding: '3rem 1.5rem' }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '-0.02em',
            marginBottom: '0.5rem',
          }}
        >
          System Health
        </h1>
        <p style={{ color: 'hsl(220 15% 55%)', marginBottom: '2rem', fontSize: '0.9rem' }}>
          Live status of all AgentHub services.
        </p>
        <HealthDashboard />
      </div>
    </div>
  )
}
