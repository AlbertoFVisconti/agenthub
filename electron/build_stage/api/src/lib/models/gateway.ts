import type { ModelAdapter, ModelProvider } from './types.js'
import { AnthropicAdapter } from './anthropic.js'
import { OpenAIAdapter } from './openai.js'
import { GoogleAdapter } from './google.js'
import { getDb, apiKeys } from '../../db/index.js'
import { decryptApiKey } from '../auth.js'
import { eq, and } from 'drizzle-orm'

// Singleton adapter instances
const adapters: Record<string, ModelAdapter> = {
  anthropic: new AnthropicAdapter(),
  openai:    new OpenAIAdapter(),
  google:    new GoogleAdapter(),
}

/**
 * Get the right adapter for a provider.
 * Throws if the provider is unknown.
 */
export function getAdapter(provider: ModelProvider): ModelAdapter {
  const adapter = adapters[provider]
  if (!adapter) throw new Error(`Unknown model provider: ${provider}`)
  return adapter
}

/**
 * Resolve the API key for a request.
 *
 * Priority:
 * 1. If the user is anonymous (or always for anon), use the key from the
 *    Authorization: Bearer header (client-side key, never stored in DB).
 * 2. If the user is authed, fetch the encrypted key from the vault.
 *
 * Returns null if no key is available.
 */
export async function resolveApiKey(opts: {
  isAnonymous: boolean
  userId: string
  provider: ModelProvider
  headerKey: string | null
}): Promise<string | null> {
  // Always use the key provided by the client in the Authorization header.
  // We no longer store keys in the backend database vault.
  return opts.headerKey ?? null
}
