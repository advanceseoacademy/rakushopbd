/**
 * Apply database/supabase-full.sql to Supabase (needs DATABASE_URL in .env)
 * Run: npm run db:setup:supabase
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getPool, usePostgres } = require('../config/db');

async function main() {
  if (!usePostgres()) {
    console.error('❌ Set DATABASE_URL in .env (Supabase → Settings → Database → URI)');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '../database/supabase-full.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('❌ Missing supabase-full.sql — run: npm run db:build:supabase');
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const pool = getPool();
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('--'));

  console.log(`📦 Running ${statements.length} SQL statements on Supabase...`);
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await pool.query(stmt);
    } catch (e) {
      if (/already exists|duplicate/i.test(e.message)) continue;
      console.error(`❌ Statement ${i + 1} failed:`, e.message);
      console.error(stmt.slice(0, 120) + '...');
      process.exit(1);
    }
  }

  await pool.end();
  console.log('✅ Supabase database ready!');
  console.log('   npm run admin:sync');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
