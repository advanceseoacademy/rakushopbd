/**
 * Build database/rakushopbd-full-import.sql (one file for phpMyAdmin Import)
 * Run: node scripts/build-full-sql.js
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const root = path.join(__dirname, '..');
const dbDir = path.join(root, 'database');
const outFile = path.join(dbDir, 'rakushopbd-full-import.sql');

const parts = [
  { file: 'drop-all-tables.sql', label: 'Drop existing tables' },
  { file: 'schema.sql', label: 'Core schema' },
  { file: 'seed.sql', label: 'Sample categories & products' },
  { file: 'auth-schema.sql', label: 'Users & orders link' },
  { file: 'admin-schema.sql', label: 'Admin, settings, coupons' },
  { file: 'admin-extended.sql', label: 'Reviews, banners, product columns' },
];

async function main() {
  const adminPass = process.env.ADMIN_PASSWORD || 'BDRakuadmin2026%%';
  const hash = await bcrypt.hash(adminPass, 10);

  const header = `-- ═══════════════════════════════════════════════════════════
-- RakuShopBD — FULL DATABASE (single import file)
-- cPanel → phpMyAdmin → select database → Import → this file
--
-- Admin login after import:
--   Username: admin@rakushopbd.com
--   Password: BDRakuadmin2026%%
--
-- Generated: ${new Date().toISOString().slice(0, 10)}
-- ═══════════════════════════════════════════════════════════

`;

  let body = header;

  for (const { file, label } of parts) {
    const content = fs.readFileSync(path.join(dbDir, file), 'utf8');
    body += `\n-- ─── ${label} (${file}) ───\n\n${content.trim()}\n\n`;
  }

  body += `-- ─── Admin account ───
INSERT INTO admins (username, email, password_hash, full_name)
VALUES (
  'admin@rakushopbd.com',
  'admin@rakushopbd.com',
  '${hash}',
  'Administrator'
);

`;

  const extraFiles = [
    path.join(root, 'scripts/insert-site-settings.sql'),
    path.join(dbDir, 'sessions-table.sql'),
    path.join(root, 'scripts/update-brand-colors.sql'),
  ];

  for (const filePath of extraFiles) {
    const name = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    body += `\n-- ─── ${name} ───\n\n${content.trim()}\n\n`;
  }

  body += `-- Done\n`;
  fs.writeFileSync(outFile, body, 'utf8');
  const kb = (Buffer.byteLength(body) / 1024).toFixed(1);
  console.log(`✅ Wrote ${outFile} (${kb} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
