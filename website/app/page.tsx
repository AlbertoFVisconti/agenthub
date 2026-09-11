import Link from 'next/link'
import { Store, Download, Zap, Shield, Puzzle, Bot, LayoutDashboard } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AgentHub — BYOK AI Agent Platform',
  description:
    'Run powerful AI agents with your own API keys. Browse and install MCP tools from the marketplace in one click.',
}

const features = [
  {
    icon: Bot,
    title: 'BYOK Agent Runtime',
    description: 'Bring your own Anthropic, OpenAI, or Google API key. No subscriptions, no middleman — your key, your bill.',
    color: '#818cf8',
  },
  {
    icon: Store,
    title: 'MCP Tool Marketplace',
    description: 'Browse hundreds of MCP-compatible tools. Install with one click and they immediately appear in your agent sessions.',
    color: '#c084fc',
  },
  {
    icon: LayoutDashboard,
    title: 'Creator Dashboard',
    description: 'Publish your own tools and track installs, invocations, and errors with real-time analytics.',
    color: '#38bdf8',
  },
  {
    icon: Puzzle,
    title: 'MCP Standard',
    description: 'Every tool is a real MCP server — compatible with Claude Desktop, Cursor, and any other MCP-aware client.',
    color: '#34d399',
  },
  {
    icon: Shield,
    title: 'Isolated Execution',
    description: 'Tool code runs in Docker containers with zero access to your data or other users\' sessions.',
    color: '#f59e0b',
  },
  {
    icon: Zap,
    title: 'No Sign-up Required',
    description: 'Get started instantly. Just download the app and plug in your keys.',
    color: '#f43f5e',
  },
]

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <section
        style={{
          position: 'relative',
          padding: '8rem 1.5rem 4rem',
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Background glow effects */}
        <div style={{
          position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
          width: '800px', height: '600px',
          background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(10,10,20,0) 70%)',
          pointerEvents: 'none', zIndex: -1,
        }} />
        <div style={{
          position: 'absolute', top: '20%', left: '20%',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(192,132,252,0.1) 0%, rgba(10,10,20,0) 70%)',
          pointerEvents: 'none', zIndex: -1,
        }} />

        <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative', zIndex: 1 }} className="fade-in">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem', borderRadius: '100px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', fontSize: '0.85rem', fontWeight: 600, marginBottom: '2rem' }}>
            <Zap size={14} fill="currentColor" />
            v1.0 Desktop Beta
          </div>

          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', margin: '0 0 1.5rem', color: '#fff' }}>
            AI agents, powered by <br />
            <span style={{ background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>your API keys</span>
          </h1>

          <p style={{ fontSize: 'clamp(1.1rem, 2vw, 1.35rem)', lineHeight: 1.6, color: 'hsl(220 15% 65%)', margin: '0 auto 2.5rem', maxWidth: '650px' }}>
            A unified desktop app to chat with LLMs using your own keys, with a 
            one-click marketplace of tools running securely on your machine.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/download" className="btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 1.75rem' }}>
              <Download size={16} style={{ marginRight: '0.4rem' }} /> Download AgentHub
            </Link>
            <Link href="/marketplace" className="btn-ghost" style={{ fontSize: '1rem', padding: '0.75rem 1.75rem' }}>
              <Store size={16} /> Browse tools
            </Link>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem 6rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {features.map(({ icon: Icon, title, description, color }) => (
            <div key={title} className="card fade-in" style={{ cursor: 'default' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Icon size={20} color={color} />
              </div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                {title}
              </h3>
              <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.65, color: 'hsl(220 15% 55%)' }}>
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
