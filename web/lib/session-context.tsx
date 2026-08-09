'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

import { REMOTE_API_BASE } from './config'

export interface SessionUser {
  userId: string
  isAnonymous: boolean
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  oauthProvider: string | null
}

export interface KeysData {
  keys: { id: string; provider: string; createdAt: string }[]
  storage: 'browser' | 'vault'
}

interface SessionContextValue {
  user: SessionUser | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  loading: true,
  error: null,
  refresh: async () => {},
  logout: async () => {},
})

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSession = useCallback(async () => {
    try {
      console.log('[TRACE] Fetching /auth/me from', `${REMOTE_API_BASE}/auth/me`)
      const meRes = await fetch(`${REMOTE_API_BASE}/auth/me`, { credentials: 'include' })
      if (meRes.ok) {
        const userData = await meRes.json()
        console.log('[TRACE] /auth/me successful. User:', userData)
        setUser(userData)
      } else {
        console.log('[TRACE] /auth/me failed. Status:', meRes.status)
      }
    } catch (err) {
      console.error('Session fetch error:', err)
      setError('Failed to fetch session data')
      // Network error — leave as null, UI handles it gracefully
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSession() }, [fetchSession])

  const logout = useCallback(async () => {
    try {
      await fetch(`${REMOTE_API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' })
    } catch (err) {
      console.error('Logout error:', err)
    }
    setUser(null)
    // Re-fetch to get new anonymous session
    await fetchSession()
  }, [fetchSession])

  return (
    <SessionContext.Provider value={{ user, loading, error, refresh: fetchSession, logout }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
