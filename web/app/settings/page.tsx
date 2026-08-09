import type { Metadata } from 'next'
import { KeySettings } from './key-settings'

export const metadata: Metadata = {
  title: 'Settings — AgentHub',
  description: 'Manage your API keys and model preferences.',
}

export default function SettingsPage() {
  return (
    <div className="gradient-bg" style={{ minHeight: 'calc(100vh - 60px)', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
          Settings
        </h1>
        <p style={{ color: 'hsl(220 15% 55%)', marginBottom: '2.5rem', fontSize: '0.9rem' }}>
          Your API keys are stored locally in this browser only — never sent to our servers while you&apos;re anonymous.
        </p>
        <KeySettings />
      </div>
    </div>
  )
}
