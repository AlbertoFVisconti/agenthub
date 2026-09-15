import Link from 'next/link'
import { Download, ArrowLeft, Monitor, Terminal } from 'lucide-react'

export default function DownloadPage() {
  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="card fade-in" style={{ maxWidth: '600px', width: '100%', textAlign: 'center', padding: '3rem 2rem' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #6366f1, #c084fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 8px 32px rgba(99,102,241,0.3)' }}>
          <Download size={32} color="#fff" />
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '0 0 1rem', color: '#fff' }}>
          Download AgentHub
        </h1>
        <p style={{ color: 'hsl(220 15% 65%)', lineHeight: 1.6, marginBottom: '2.5rem' }}>
          Get the desktop app to install tools, run AI agents with your own API keys, and securely execute tasks in isolated Docker containers.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '3rem' }}>
          <a 
            href="https://github.com/AlbertoFVisconti/agenthub/releases/latest/download/AgentHub-Setup-0.0.1.exe" 
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', 
              padding: '1rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 600, 
              backgroundColor: '#6366f1', color: '#fff', textDecoration: 'none',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            className="hover-lift"
          >
            <Download size={20} /> Download AgentHub
          </a>
        </div>

        <Link href="/" className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Back to home
        </Link>
      </div>
    </div>
  )
}
