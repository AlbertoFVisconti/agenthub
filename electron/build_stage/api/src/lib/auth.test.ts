import { describe, it, expect } from 'vitest'
import { encryptApiKey, decryptApiKey } from '../lib/auth.js'

// Set env var before tests
process.env.KEY_ENCRYPTION_KEY = 'a'.repeat(64)
process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough-32chars'

describe('encryptApiKey / decryptApiKey', () => {
  it('round-trips a plaintext API key', () => {
    const original = 'sk-ant-api03-supersecretkey12345'
    const encrypted = encryptApiKey(original)
    const decrypted = decryptApiKey(encrypted)
    expect(decrypted).toBe(original)
  })

  it('produces different ciphertext each time (random IV)', () => {
    const key = 'sk-ant-same-key'
    const enc1 = encryptApiKey(key)
    const enc2 = encryptApiKey(key)
    expect(enc1).not.toBe(enc2)
  })

  it('has the iv:authTag:ciphertext format', () => {
    const encrypted = encryptApiKey('test-key')
    const parts = encrypted.split(':')
    expect(parts).toHaveLength(3)
    // IV = 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24)
    // authTag = 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32)
  })

  it('throws on tampered auth tag', () => {
    const encrypted = encryptApiKey('my-api-key')
    const parts = encrypted.split(':')
    // Flip one char in the auth tag
    parts[1] = parts[1].replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))
    expect(() => decryptApiKey(parts.join(':'))).toThrow()
  })

  it('throws on malformed format', () => {
    expect(() => decryptApiKey('notvalid')).toThrow('Invalid encrypted key format')
  })
})
