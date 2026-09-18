const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://agenthub:agenthub@localhost:5432/agenthub' });

async function run() {
  const manifest = {
    name: "word-counter",
    version: "1.0.1",
    description: "Counts the number of words in a piece of text \u2014 a simple example of a working AgentHub tool.",
    entrypoint: ["node", "index.js"],
    permissions: { network: false }
  };
  const desc = "Counts the number of words in a piece of text \u2014 a simple example of a working AgentHub tool.";
  const url = "/uploads/tools/word-counter-1.0.1.zip";

  const updateRes = await pool.query(
    "UPDATE tools SET description = $1, manifest_json = $2, package_url = $3 WHERE name = 'word-counter' RETURNING id, name",
    [desc, manifest, url]
  );
  console.log('Updated tool:', updateRes.rows);
  pool.end();
}
run().catch(console.error);
