'use client'

import Link from 'next/link'
import { ArrowRight, Store, Download } from 'lucide-react'
import { useState, useEffect } from 'react'

export function HeroButtons() {
  const [isElectron, setIsElectron] = useState(true)

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && !!(window as any).electron)
  }, [])

  return (
    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
      {isElectron ? (
        <Link href="/chat" className="btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 1.75rem' }}>
          Start chatting <ArrowRight size={16} />
        </Link>
      ) : (
        <a href="https://example.com/download" className="btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 1.75rem' }}>
          <Download size={16} style={{ marginRight: '0.4rem' }} /> Download AgentHub
        </a>
      )}
      <Link href="/marketplace" className="btn-ghost" style={{ fontSize: '1rem', padding: '0.75rem 1.75rem' }}>
        <Store size={16} /> Browse tools
      </Link>
    </div>
  )
}
