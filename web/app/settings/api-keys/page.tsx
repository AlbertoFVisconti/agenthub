import type { Metadata } from 'next'
import { KeySettings } from '../key-settings'

export const metadata: Metadata = {
  title: 'API Keys — Settings',
  description: 'Manage your API keys.',
}

export default function ApiKeysPage() {
  return (
    <>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
        API Keys
      </h1>
      <p style={{ color: 'hsl(220 15% 55%)', marginBottom: '2.5rem', fontSize: '0.9rem' }}>
        Your API keys are stored locally in this browser only — never sent to our servers while you&apos;re anonymous.
      </p>
      <KeySettings />
    </>
  )
}
