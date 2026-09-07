'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Cpu, Key, Box } from 'lucide-react'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const navItems = [
    { href: '/settings/models', label: 'Models', icon: Cpu },
    { href: '/settings/api-keys', label: 'API Keys', icon: Key },
    { href: '/settings/docker', label: 'Docker', icon: Box },
  ]

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      {/* Sidebar */}
      <div style={{
        width: '260px',
        backgroundColor: 'rgba(10,10,20,0.8)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h2 style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Settings
          </h2>
        </div>
        <div style={{ padding: '1rem 0.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map(item => {
            const isActive = pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '0.6rem 0.75rem',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  color: isActive ? '#fff' : 'hsl(220 15% 75%)',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  transition: 'all 0.1s'
                }}>
                  <Icon size={16} />
                  {item.label}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="gradient-bg" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '3rem 2rem', maxWidth: '720px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
