import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/layout/navbar'
import { SessionProvider } from '@/lib/session-context'

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
  description:
    'Bring your own API key and run AI agents with a powerful tool marketplace. Install MCP tools in one click and supercharge your AI workflows.',
  keywords: ['AI agent', 'MCP tools', 'BYOK', 'tool marketplace', 'LLM'],
  openGraph: {
    title: 'AgentHub — BYOK AI Agent Platform',
    description: 'Run AI agents with your own API key + a one-click tool marketplace.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <SessionProvider>
          <Navbar />
          <main>{children}</main>
        </SessionProvider>
      </body>
    </html>
  )
}
