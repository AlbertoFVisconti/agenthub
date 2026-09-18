import crypto from 'crypto'
import { SignJWT, jwtVerify } from 'jose'

const SESSION_COOKIE = 'device_id'
const ISSUER = 'agenthub'
const AUDIENCE = 'agenthub-client'

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters')
  }
  return new TextEncoder().encode(secret)
}

export interface SessionPayload {
  userId: string
  isAnonymous: boolean
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime('90d')
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    return {
      userId: payload.userId as string,
      isAnonymous: payload.isAnonymous as boolean,
    }
  } catch {
    return null
  }
}

export { SESSION_COOKIE }

// ─────────────────────────────────────────────────────────────
// AES-256-GCM encryption for stored API keys (vault)
// Format: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
// ─────────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const hex = process.env.KEY_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('KEY_ENCRYPTION_KEY must be exactly 64 hex chars (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12) // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':')
}

export function decryptApiKey(stored: string): string {
  const key = getEncryptionKey()
  const parts = stored.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted key format — expected iv:authTag:ciphertext')
  }
  const [ivHex, authTagHex, ciphertextHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
