import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import { Zap, Store, Download } from 'lucide-react'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'AgentHub — BYOK AI Agent Platform',
    template: '%s | AgentHub',
  },
  description: 'Run AI agents with your own API key + a one-click tool marketplace.',
}

function Navbar() {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      backgroundColor: 'rgba(10,10,20,0.85)',
    }}>
      <nav style={{
        maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem',
        height: '60px', display: 'flex', alignItems: 'center', gap: '2rem',
      }}>
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', flexShrink: 0 }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #6366f1, #c084fc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(99,102,241,0.5)',
          }}>
            <Zap size={16} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em', color: '#fff' }}>
            Agent<span style={{ color: '#818cf8' }}>Hub</span>
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
          <Link href="/marketplace" style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.4rem 0.75rem', borderRadius: '8px',
            fontSize: '0.875rem', fontWeight: 500,
            textDecoration: 'none', color: '#fff',
            transition: 'all 0.15s ease',
          }}>
            <Store size={15} /> Marketplace
          </Link>
          <Link href="/docs" style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.4rem 0.75rem', borderRadius: '8px',
            fontSize: '0.875rem', fontWeight: 500,
            textDecoration: 'none', color: '#fff',
            transition: 'all 0.15s ease',
          }}>
            Documentation
          </Link>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href="/download" style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.4rem 0.75rem', borderRadius: '8px',
            fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
            backgroundColor: '#6366f1', color: '#fff', border: 'none',
            transition: 'all 0.15s',
          }}>
            <Download size={14} /> Download AgentHub
          </Link>
        </div>
      </nav>
    </header>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  )
}
