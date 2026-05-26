/**
 * Apply supabase-full.sql via Supabase Management API
 * Usage: SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=dymliuodmmmgvwjbonjn node scripts/supabase-apply-sql.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || 'dymliuodmmmgvwjbonjn';

if (!token) {
  console.error('❌ Set SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

async function runQuery(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${text}`);
  }
  return text;
}

async function main() {
  const sqlPath = path.join(__dirname, '../database/supabase-full.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = sql
    .split(/;\s*\n/)
    .map((s) =>
      s
        .replace(/^--[^\n]*\n/gm, '')
        .trim()
    )
    .filter((s) => s.length > 0);

  console.log(`📦 Applying ${statements.length} statements to ${ref}...`);
  let ok = 0;
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    try {
      await runQuery(stmt);
      ok++;
      if ((i + 1) % 5 === 0) console.log(`   ${i + 1}/${statements.length}`);
    } catch (e) {
      if (/already exists|duplicate/i.test(e.message)) {
        ok++;
        continue;
      }
      console.error(`❌ Statement ${i + 1} failed:`, e.message.slice(0, 200));
      console.error(stmt.slice(0, 150) + '...');
      process.exit(1);
    }
  }
  const check = await runQuery('SELECT COUNT(*) AS admins FROM admins');
  console.log('✅ Done.', check);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
