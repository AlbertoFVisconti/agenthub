import Link from 'next/link'
import { Download, ArrowLeft } from 'lucide-react'

export default function DownloadPage() {
  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="card fade-in" style={{ maxWidth: '500px', textAlign: 'center', padding: '3rem 2rem' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #6366f1, #c084fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 8px 32px rgba(99,102,241,0.3)' }}>
          <Download size={32} color="#fff" />
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '0 0 1rem', color: '#fff' }}>
          Coming Soon
        </h1>
        <p style={{ color: 'hsl(220 15% 65%)', lineHeight: 1.6, marginBottom: '2rem' }}>
          The AgentHub desktop installer is currently being built. Check back soon to download the app for Windows, macOS, and Linux.
        </p>
        <Link href="/" className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Back to home
        </Link>
      </div>
    </div>
  )
}
