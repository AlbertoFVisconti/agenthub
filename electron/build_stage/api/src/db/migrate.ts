import 'dotenv/config'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { getDb, getPool } from './index.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function runMigrations() {
  console.log('[migrate] Connecting to database...')
  const db = getDb()

  console.log('[migrate] Running migrations...')
  await migrate(db, {
    migrationsFolder: path.join(__dirname, '../../drizzle'),
  })

  console.log('[migrate] ✅ Migrations complete')
  await getPool().end()
}

runMigrations().catch((err) => {
  console.error('[migrate] ❌ Migration failed:', err)
  process.exit(1)
})
