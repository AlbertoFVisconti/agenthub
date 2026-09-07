import type { Metadata } from 'next'
import { ModelSettings } from '../model-settings'

export const metadata: Metadata = {
  title: 'Models — Settings',
  description: 'Manage your model preferences.',
}

export default function ModelsPage() {
  return (
    <>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
        Models
      </h1>
      <p style={{ color: 'hsl(220 15% 55%)', marginBottom: '2.5rem', fontSize: '0.9rem' }}>
        Customize your local model catalogue and display preferences.
      </p>
      <ModelSettings />
    </>
  )
}
