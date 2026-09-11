import Link from 'next/link'
import { HeroButtons } from '@/components/home/hero-buttons'
import { Bot, Store, LayoutDashboard, ArrowRight, Zap, Shield, Puzzle } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AgentHub â€” BYOK AI Agent Platform',
  description:
    'Run powerful AI agents with your own API keys. Browse and install MCP tools from the marketplace in one click.',
}

const features = [
  {
    icon: Bot,
    title: 'BYOK Agent Runtime',
    description:
      'Bring your own Anthropic, OpenAI, or Google API key. No subscriptions, no middleman â€” your key, your bill.',
    color: '#818cf8',
  },
  {
    icon: Store,
    title: 'MCP Tool Marketplace',
    description:
      'Browse hundreds of MCP-compatible tools. Install with one click and they immediately appear in your agent sessions.',
    color: '#c084fc',
  },
  {
    icon: LayoutDashboard,
    title: 'Creator Dashboard',
    description:
      'Publish your own tools and track installs, invocations, and errors with real-time analytics.',
    color: '#38bdf8',
  },
  {
    icon: Puzzle,
    title: 'MCP Standard',
    description:
      'Every tool is a real MCP server â€” compatible with Claude Desktop, Cursor, and any other MCP-aware client.',
    color: '#34d399',
  },
  {
    icon: Shield,
    title: 'Isolated Execution',
    description:
      'Tool code runs in Docker containers with zero access to your data or other users\' sessions.',
    color: '#f59e0b',
  },
  {
    icon: Zap,
    title: 'No Sign-up Required',
    description:
      'Start chatting immediately. Paste your API key and go. Create an account only when you want to publish tools.',
    color: '#fb7185',
  },
]

export default function HomePage() {
  return (
    <div className="gradient-bg" style={{ minHeight: 'calc(100vh - 60px)' }}>
      {/* Hero */}
      <section
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '5rem 1.5rem 3rem',
          textAlign: 'center',
        }}
      >
        <div className="fade-in">
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.3rem 0.9rem',
              borderRadius: '99px',
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.25)',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#818cf8',
              marginBottom: '1.5rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <span
              className="pulse-dot"
              style={{ backgroundColor: '#818cf8' }}
            />
            Now in beta
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.5rem, 6vw, 4rem)',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              margin: '0 0 1.25rem',
              color: '#fff',
            }}
          >
            AI agents, powered by{' '}
            <span className="gradient-text">your API keys</span>
          </h1>

          <p
            style={{
              fontSize: '1.2rem',
              lineHeight: 1.65,
              color: 'hsl(220 15% 60%)',
              maxWidth: '600px',
              margin: '0 auto 2.5rem',
            }}
          >
            A BYOK agent platform with a one-click tool marketplace built on the
            Model Context Protocol. No subscriptions. No lock-in.
          </p>

          <HeroButtons />
        </div>
      </section>

      {/* Features grid */}
      <section
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '2rem 1.5rem 6rem',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {features.map(({ icon: Icon, title, description, color }) => (
            <div
              key={title}
              className="card fade-in"
              style={{ cursor: 'default' }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: `${color}18`,
                  border: `1px solid ${color}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                }}
              >
                <Icon size={20} color={color} />
              </div>
              <h3
                style={{
                  margin: '0 0 0.5rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#fff',
                  letterSpacing: '-0.01em',
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  lineHeight: 1.65,
                  color: 'hsl(220 15% 55%)',
                }}
              >
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

