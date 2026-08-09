import type { Metadata } from 'next'
import { ChatInterface } from '@/components/chat/chat-interface'

export const metadata: Metadata = {
  title: 'Chat — AgentHub',
  description: 'Chat with an AI agent using your API key. Supports Claude, GPT-4o, Gemini, and more.',
}

export default function ChatPage() {
  return <ChatInterface />
}
