import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })

    pool.on('error', (err) => {
      console.error('[db] Unexpected pool error:', err)
    })
  }
  return pool
}

export function getDb() {
  return drizzle(getPool(), { schema, logger: process.env.NODE_ENV === 'development' })
}

export type Db = ReturnType<typeof getDb>

// Health check — returns true if a simple query succeeds
export async function checkDbHealth(): Promise<boolean> {
  try {
    const pool = getPool()
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    return true
  } catch {
    return false
  }
}

export * from './schema.js'
