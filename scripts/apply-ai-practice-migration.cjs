/**
 * Applies 202611040001_ai_practice_scenarios.sql when DATABASE_URL is set.
 * Usage: DATABASE_URL=postgres://... node scripts/apply-ai-practice-migration.cjs
 */
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Set DATABASE_URL to your Supabase Postgres connection string, then re-run this script.');
    console.error('Or paste supabase/migrations/202611040001_ai_practice_scenarios.sql into the Supabase SQL editor.');
    process.exit(1);
  }
  let pg;
  try {
    pg = require('pg');
  } catch {
    console.error('Install pg first: npm.cmd install pg --no-save');
    process.exit(1);
  }
  const sql = readFileSync(resolve(__dirname, '../supabase/migrations/202611040001_ai_practice_scenarios.sql'), 'utf8');
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Applied 202611040001_ai_practice_scenarios.sql');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
