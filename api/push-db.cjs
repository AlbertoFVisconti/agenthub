const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  
  try {
    await client.query(`ALTER TYPE "tool_status" ADD VALUE IF NOT EXISTS 'building';`);
    console.log('Added building to tool_status enum');
  } catch (e) {
    console.log('tool_status error (might already exist):', e.message);
  }

  try {
    await client.query(`ALTER TABLE "tools" ADD COLUMN IF NOT EXISTS "build_error" text;`);
    console.log('Added build_error column');
  } catch (e) {
    console.log('build_error column error:', e.message);
  }

  await client.end();
}

run().catch(console.error);
