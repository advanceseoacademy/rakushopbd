/**
 * Fresh database: drop all tables + full setup.
 * cPanel Terminal: CONFIRM_FRESH_DB=YES npm run db:fresh
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  if (process.env.CONFIRM_FRESH_DB !== 'YES') {
    console.error('❌ সব ডেটা মুছে যাবে। চালাতে:');
    console.error('   CONFIRM_FRESH_DB=YES npm run db:fresh');
    process.exit(1);
  }

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  };

  if (!config.user || !config.database) {
    console.error('❌ .env বা cPanel env তে DB_USER, DB_NAME, DB_PASSWORD সেট করুন');
    process.exit(1);
  }

  console.log('🗑️  সব টেবিল মুছছি...', config.database);
  const conn = await mysql.createConnection(config);
  const dropSql = fs.readFileSync(path.join(__dirname, '../database/drop-all-tables.sql'), 'utf8');
  await conn.query(dropSql);
  await conn.end();

  console.log('📦 নতুন schema + seed + admin তৈরি হচ্ছে...');
  require('./setup-db.js');
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
