import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function ConnectLocalModelGuide() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 1.5rem', lineHeight: 1.7 }}>
      <Link href="/docs" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#6366f1', textDecoration: 'none', marginBottom: '2rem', fontWeight: 500 }}>
        <ArrowLeft size={16} /> Back to docs
      </Link>

      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', color: '#fff', letterSpacing: '-0.02em' }}>
        Connect a Local Model
      </h1>
      <p style={{ fontSize: '1.125rem', color: 'hsl(220 15% 70%)', marginBottom: '3rem' }}>
        You can connect your own locally hosted language models (via Ollama, LM Studio, vLLM, etc.) to AgentHub, ensuring complete privacy and zero API costs.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
        
        {/* Step 1 */}
        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.1)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>1</div>
            Start Your Local Model
          </h2>
          <p style={{ color: 'hsl(220 15% 75%)', marginBottom: '1rem' }}>
            Start your LLM runner and ensure it's exposing an OpenAI-compatible API. For example, if you are using Ollama:
          </p>
          <pre style={{ backgroundColor: '#111', border: '1px solid #333', padding: '1rem', borderRadius: '8px', overflowX: 'auto', color: '#e5e7eb', marginBottom: '1rem' }}>
            <code>ollama run llama3</code>
          </pre>
          <p style={{ color: 'hsl(220 15% 75%)', marginBottom: '1rem' }}>
            By default, Ollama exposes its API at <code>http://127.0.0.1:11434/v1</code>.
          </p>
        </section>

        {/* Step 2 */}
        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.1)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>2</div>
            Configure AgentHub
          </h2>
          <p style={{ color: 'hsl(220 15% 75%)', marginBottom: '1rem' }}>
            Open the AgentHub app and go to Settings -{'>'} Models.
          </p>
          <ul style={{ color: 'hsl(220 15% 75%)', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', listStyleType: 'disc' }}>
            <li>Select <strong>Custom (OpenAI Compatible)</strong> as the provider.</li>
            <li>Enter the model name (e.g., <code>llama3</code>) exactly as it appears in your runner.</li>
            <li>Give it a display label (e.g., "My Local Llama3").</li>
            <li>Enter your local server URL in the Base URL field (e.g., <code>http://127.0.0.1:11434/v1</code>).</li>
            <li>Click <strong>Save</strong>.</li>
          </ul>
        </section>

        {/* Step 3 */}
        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.1)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>3</div>
            Select the Model in Chat
          </h2>
          <p style={{ color: 'hsl(220 15% 75%)', marginBottom: '1rem' }}>
            Go to the Chat view. In the model dropdown at the top, you will see a new section for <strong>Custom Models</strong>. Select your newly added model.
          </p>
          <p style={{ color: 'hsl(220 15% 75%)' }}>
            You can now start chatting with your local model! It will be able to run tools just like the hosted models, provided the model supports OpenAI tool calling structures.
          </p>
        </section>

      </div>
    </div>
  )
}
