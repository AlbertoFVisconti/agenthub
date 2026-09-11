'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Bot, Store, LayoutDashboard, Settings, Zap, LogOut, User, Download } from 'lucide-react'
import { useSession } from '@/lib/session-context'
import { REMOTE_API_BASE, loginWithGithub } from '@/lib/config'
import { useState, useEffect } from 'react'

const allNavLinks = [
  { href: '/chat',        label: 'Chat',        icon: Bot },
  { href: '/marketplace', label: 'Marketplace', icon: Store },
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
]

export function Navbar() {
  const pathname = usePathname()
  const { user, loading, logout } = useSession()
  const [isElectron, setIsElectron] = useState(true)

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && !!(window as any).electron)
  }, [])

  const navLinks = allNavLinks.filter(link => {
    if (link.href === '/chat' && !isElectron) return false
    return true
  })

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}>
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.4rem 0.75rem', borderRadius: '8px',
                fontSize: '0.875rem', fontWeight: active ? 600 : 500,
                textDecoration: 'none',
                color: active ? '#fff' : 'hsl(220 15% 60%)',
                backgroundColor: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                border: active ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                transition: 'all 0.15s ease',
              }}>
                <Icon size={15} />{label}
              </Link>
            )
          })}
        </div>

        {/* Right: session state */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isElectron && (
            <a href="https://example.com/download" style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.4rem 0.75rem', borderRadius: '8px',
              fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
              backgroundColor: '#6366f1', color: '#fff', border: 'none',
              transition: 'all 0.15s',
            }}>
              <Download size={14} /> Download AgentHub
            </a>
          )}

          <Link href="/settings" style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.4rem 0.75rem', borderRadius: '8px',
            fontSize: '0.8rem', fontWeight: 500, textDecoration: 'none',
            color: 'hsl(220 15% 60%)', border: '1px solid transparent',
            transition: 'all 0.15s',
          }}>
            <Settings size={14} />Settings
          </Link>

          {loading ? (
            <div className="skeleton" style={{ width: '110px', height: '32px', borderRadius: '8px' }} />
          ) : user && !user.isAnonymous ? (
            /* Signed-in user */
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {user.avatarUrl ? (
                <Image
                  src={user.avatarUrl} alt={user.displayName ?? 'Avatar'}
                  width={28} height={28}
                  style={{ borderRadius: '50%', border: '2px solid rgba(99,102,241,0.4)' }}
                />
              ) : (
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #c084fc)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <User size={14} color="#fff" />
                </div>
              )}
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.displayName ?? user.email ?? 'User'}
              </span>
              <button onClick={logout} title="Sign out" style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'hsl(220 15% 50%)', padding: '0.25rem', display: 'flex',
                transition: 'color 0.15s',
              }}>
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            /* Anonymous / not loaded */
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="badge badge-neutral" style={{ fontSize: '0.72rem', gap: '0.3rem' }}>
                <span className="pulse-dot" style={{ backgroundColor: 'hsl(220 15% 45%)', width: '6px', height: '6px' }} />
                Anonymous
              </span>
              <button
                className="btn-primary"
                style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', gap: '0.35rem' }}
                onClick={() => loginWithGithub()}
              >
                Sign in with GitHub
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  )
}
