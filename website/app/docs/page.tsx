import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function CreateToolGuide() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 1.5rem', lineHeight: 1.7 }}>
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#6366f1', textDecoration: 'none', marginBottom: '2rem', fontWeight: 500 }}>
        <ArrowLeft size={16} /> Back to home
      </Link>

      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', color: '#fff', letterSpacing: '-0.02em' }}>
        Create an AgentHub Tool
      </h1>
      <p style={{ fontSize: '1.125rem', color: 'hsl(220 15% 70%)', marginBottom: '3rem' }}>
        Learn how to scaffold, write, test, and publish a tool to the AgentHub Marketplace. While you can browse the tool catalog directly on this website, creating and installing tools requires our CLI and Desktop App.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
        
        {/* Step 1 */}
        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.1)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>1</div>
            Prerequisites
          </h2>
          <p style={{ color: 'hsl(220 15% 75%)', marginBottom: '1rem' }}>
            Before creating a tool, ensure you have the following installed on your machine:
          </p>
          <ul style={{ color: 'hsl(220 15% 75%)', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li><strong>Node.js</strong> (v20 or higher)</li>
            <li><strong>Docker Desktop</strong> (must be running in the background for local testing, as all tools run in isolated containers)</li>
          </ul>
        </section>

        {/* Step 2 */}
        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.1)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>2</div>
            Scaffold a new tool
          </h2>
          <p style={{ color: 'hsl(220 15% 75%)', marginBottom: '1rem' }}>
            We provide a CLI generator to instantly scaffold a working tool template. Run this in your terminal:
          </p>
          <pre style={{ backgroundColor: '#111', border: '1px solid #333', padding: '1rem', borderRadius: '8px', overflowX: 'auto', color: '#e5e7eb', marginBottom: '1rem' }}>
            <code>npx create-agenthub-tool word-counter</code>
          </pre>
          <p style={{ color: 'hsl(220 15% 75%)', marginBottom: '1rem' }}>
            Then navigate into your new folder and install the dependencies:
          </p>
          <pre style={{ backgroundColor: '#111', border: '1px solid #333', padding: '1rem', borderRadius: '8px', overflowX: 'auto', color: '#e5e7eb' }}>
            <code>cd word-counter
npm install</code>
          </pre>
        </section>

        {/* Step 3 */}
        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.1)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>3</div>
            Write your tool's logic
          </h2>
          <p style={{ color: 'hsl(220 15% 75%)', marginBottom: '1rem' }}>
            Your tool relies on two main files: <code>manifest.json</code> (which tells the marketplace about your tool) and <code>index.js</code> (the actual code).
          </p>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <strong style={{ color: '#fff', display: 'block', marginBottom: '0.5rem' }}>📌 Naming Note</strong>
            <span style={{ color: 'hsl(220 15% 75%)', fontSize: '0.9rem' }}>
              The name in <code>manifest.json</code> determines your tool's URL on the marketplace. The name inside <code>defineTool</code> is the internal identifier the AI uses to call your tool. They don't strictly have to match, but we highly recommend keeping them identical to avoid confusion!
            </span>
          </div>

          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: '0.5rem' }}>manifest.json</h3>
          <p style={{ color: 'hsl(220 15% 75%)', marginBottom: '1rem' }}>Define the name, version, and a clear description so users know what your tool does.</p>
          <pre style={{ backgroundColor: '#111', border: '1px solid #333', padding: '1rem', borderRadius: '8px', overflowX: 'auto', color: '#e5e7eb', fontSize: '0.9rem' }}>
            <code>{\{
  "name": "word-counter",
  "version": "1.0.0",
  "description": "A tool that counts the number of words in a provided text string.",
  "main": "index.js"
}\}</code>
          </pre>

          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: '0.5rem', marginTop: '1.5rem' }}>index.js</h3>
          <p style={{ color: 'hsl(220 15% 75%)', marginBottom: '1rem' }}>Use <code>defineTool</code> from the SDK to declare your input schema and the handler function.</p>
          <pre style={{ backgroundColor: '#111', border: '1px solid #333', padding: '1rem', borderRadius: '8px', overflowX: 'auto', color: '#e5e7eb', fontSize: '0.9rem' }}>
            <code>{\import { defineTool } from '@agenthub-tools/tool-sdk'
import { z } from 'zod'

export default defineTool({
  name: 'word-counter',
  description: 'Counts the number of words in a text string.',
  schema: z.object({
    text: z.string().describe('The text to count words for')
  }),
  handler: async ({ text }) => {
    const wordCount = text.trim().split(/\\s+/).length
    return {
      success: true,
      data: \\\The text contains \\\ words.\\\
    }
  }
})\}</code>
          </pre>
        </section>

        {/* Step 4 */}
        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.1)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>4</div>
            Validate and test locally
          </h2>
          <p style={{ color: 'hsl(220 15% 75%)', marginBottom: '1rem' }}>
            We provide a CLI to ensure your tool conforms to marketplace standards and works securely in isolation. 
          </p>

          <ul style={{ color: 'hsl(220 15% 75%)', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <li>
              <strong>Validate:</strong> Checks your <code>manifest.json</code> and tool schema for errors.
              <pre style={{ backgroundColor: '#111', border: '1px solid #333', padding: '0.75rem', borderRadius: '8px', marginTop: '0.5rem', color: '#e5e7eb' }}><code>npx @agenthub-tools/tool-cli validate</code></pre>
              <em style={{ fontSize: '0.85rem', color: '#9ca3af', display: 'block', marginTop: '0.5rem' }}>✅ Success: "Manifest is valid!"</em>
              <em style={{ fontSize: '0.85rem', color: '#f87171', display: 'block', marginTop: '0.25rem' }}>❌ Failure: "Invalid manifest: 'name' is required and must be a string."</em>
            </li>
            <li>
              <strong>Test:</strong> Spawns a temporary Docker container and runs your tool inside it, exactly as it will run in production.
              <pre style={{ backgroundColor: '#111', border: '1px solid #333', padding: '0.75rem', borderRadius: '8px', marginTop: '0.5rem', color: '#e5e7eb' }}><code>npx @agenthub-tools/tool-cli test</code></pre>
              <em style={{ fontSize: '0.85rem', color: '#9ca3af' }}>If Docker is not running, you will get an error: "Docker Desktop doesn't appear to be running."</em>
            </li>
          </ul>
        </section>

        {/* Step 5 */}
        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.1)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>5</div>
            Package your tool
          </h2>
          <p style={{ color: 'hsl(220 15% 75%)', marginBottom: '1rem' }}>
            When your tool is ready, run the package command to bundle it into a zip file ready for upload.
          </p>
          <pre style={{ backgroundColor: '#111', border: '1px solid #333', padding: '1rem', borderRadius: '8px', overflowX: 'auto', color: '#e5e7eb', marginBottom: '1rem' }}>
            <code>npx @agenthub-tools/tool-cli package</code>
          </pre>
          <p style={{ color: 'hsl(220 15% 75%)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            This process automatically bundles your code using esbuild and excludes unnecessary directories like <code>.git</code>, <code>node_modules</code>, and <code>.env</code>. It respects custom ignore rules if you create a <code>.agenthubignore</code> file. The result is a clean <code>word-counter-1.0.0.zip</code> file.
          </p>
          
          <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '8px' }}>
            <strong style={{ color: '#fff', display: 'block', marginBottom: '0.5rem' }}>🏷️ Versioning Guidance</strong>
            <span style={{ color: 'hsl(220 15% 75%)', fontSize: '0.9rem' }}>
              Whenever you update your tool, you <strong>must</strong> bump the version number in your <code>manifest.json</code> before packaging again. Uploading a zip file with a version number that already exists in the marketplace will be rejected.
            </span>
          </div>
        </section>

        {/* Step 6 */}
        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.1)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>6</div>
            Publish your tool
          </h2>
          <p style={{ color: 'hsl(220 15% 75%)', marginBottom: '1rem' }}>
            Tools are published through the AgentHub Desktop App. 
            There is no prior approval or manual review process required — published tools go live on the marketplace immediately! 
          </p>
          <ul style={{ color: 'hsl(220 15% 75%)', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', listStyleType: 'disc' }}>
            <li>Open the AgentHub desktop app.</li>
            <li>Sign in with your GitHub account (this automatically provisions your Creator profile).</li>
            <li>Navigate to the <strong>Creator Dashboard</strong>.</li>
            <li>Click <strong>Publish New Tool</strong>.</li>
            <li>Upload the zip file you generated in Step 5.</li>
          </ul>
        </section>

        {/* Step 7 */}
        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.1)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>7</div>
            Installing your new tool
          </h2>
          <p style={{ color: 'hsl(220 15% 75%)', marginBottom: '1rem' }}>
            Now that your tool is live, it will immediately appear on this website's catalog for the world to see! 
          </p>
          <p style={{ color: 'hsl(220 15% 75%)' }}>
            To actually use it, end-users will simply open the Marketplace tab inside their own AgentHub desktop app, search for <strong>word-counter</strong>, and click Install. It will instantly be available for their AI agents to use in Chat!
          </p>
        </section>
        
        {/* Next Steps */}
        <section style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', marginBottom: '1rem' }}>
            Next Steps
          </h2>
          <ul style={{ color: '#818cf8', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', listStyleType: 'circle' }}>
            <li><Link href="/docs/sdk-reference" style={{ color: '#818cf8', textDecoration: 'none' }}>Review the full SDK Reference</Link></li>
            <li><Link href="/docs/best-practices" style={{ color: '#818cf8', textDecoration: 'none' }}>Read our Tool Design Best Practices</Link></li>
            <li><Link href="/marketplace" style={{ color: '#818cf8', textDecoration: 'none' }}>Browse example tools on the Marketplace</Link></li>
          </ul>
        </section>

      </div>
    </div>
  )
}
