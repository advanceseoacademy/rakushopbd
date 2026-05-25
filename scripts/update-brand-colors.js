/**
 * Run: npm run db:brand-colors
 * Updates existing products/banners to RakushopBD logo palette
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });
  const sql = fs.readFileSync(path.join(__dirname, 'update-brand-colors.sql'), 'utf8');
  for (const part of sql.split(';').filter((s) => s.trim())) {
    await conn.query(part);
  }
  await conn.end();
  console.log('✅ Brand colors updated in database');
}

run().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
