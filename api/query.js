const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://agenthub:agenthub@localhost:5432/agenthub'
});

async function run() {
  const tools = await pool.query('SELECT id, name, status, "installCount" FROM tools');
  console.log('--- TOOLS ---');
  console.table(tools.rows);

  const users = await pool.query('SELECT id, "githubId", username, name, "createdAt" FROM users');
  console.log('--- USERS ---');
  console.table(users.rows);

  // Soft delete my-new-tool and my-cool-tool
  const updateRes = await pool.query("UPDATE tools SET status='removed' WHERE name IN ('my-new-tool', 'my-cool-tool') RETURNING id, name");
  console.log('Soft deleted tools:', updateRes.rows);

  // Delete 'Test User'
  const delUserRes = await pool.query("DELETE FROM users WHERE name = 'Test User' RETURNING id, name");
  console.log('Deleted users:', delUserRes.rows);

  pool.end();
}
run().catch(console.error);
