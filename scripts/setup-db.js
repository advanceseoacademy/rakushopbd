/**
 * Run: npm run db:setup
 * Requires .env with DB_* credentials
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  };

  if (!config.user || !config.database) {
    console.error('❌ .env ফাইলে DB_USER ও DB_NAME সেট করুন (.env.example দেখুন)');
    process.exit(1);
  }

  const conn = await mysql.createConnection(config);
  const schema = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
  const seed = fs.readFileSync(path.join(__dirname, '../database/seed.sql'), 'utf8');

  console.log('📦 Schema তৈরি হচ্ছে...');
  await conn.query(schema);
  console.log('🌱 Sample data যোগ হচ্ছে...');
  try {
    await conn.query(seed);
  } catch (e) {
    if (!/Duplicate entry/i.test(e.message)) throw e;
    console.log('   (seed already applied — skipping)');
  }

  const authSchema = fs.readFileSync(path.join(__dirname, '../database/auth-schema.sql'), 'utf8');
  console.log('👤 User accounts schema...');
  const parts = authSchema.split(';').filter((s) => s.trim());
  for (const part of parts) {
    try {
      await conn.query(part);
    } catch (e) {
      if (!/Duplicate column|already exists|Duplicate key name/i.test(e.message)) throw e;
    }
  }

  for (const file of ['admin-schema.sql', 'admin-extended.sql']) {
    const adminSchema = fs.readFileSync(path.join(__dirname, '../database/' + file), 'utf8');
    console.log('🔐 ' + file + '...');
    const adminParts = adminSchema.split(';').filter((s) => s.trim());
    for (const part of adminParts) {
      try {
        await conn.query(part);
      } catch (e) {
        if (!/Duplicate|already exists|Duplicate column/i.test(e.message)) throw e;
      }
    }
  }

  const bcrypt = require('bcryptjs');
  const [adminRows] = await conn.query('SELECT COUNT(*) AS adminCount FROM admins');
  const adminCount = Number(adminRows[0]?.adminCount) || 0;
  if (adminCount === 0) {
    const adminUser = (process.env.ADMIN_USERNAME || '').trim() || 'admin';
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim() || 'admin@rakushopbd.com';
    const adminPass = (process.env.ADMIN_PASSWORD || '').trim();
    if (!adminPass || adminPass.length < 6) {
      throw new Error(
        'First-time setup: set ADMIN_PASSWORD in .env (min 6 characters). Credentials are stored hashed in the admins table.'
      );
    }
    const hash = await bcrypt.hash(adminPass, 10);
    await conn.query(
      `INSERT INTO admins (username, email, password_hash, full_name) VALUES (?, ?, ?, 'Administrator')`,
      [adminUser, adminEmail, hash]
    );
    console.log(`👤 Admin account created (username: ${adminUser}) — password stored in database only.`);
  } else {
    console.log('👤 Admin account exists — password unchanged (not reset from .env).');
  }

  const settingsSql = fs.readFileSync(path.join(__dirname, 'insert-site-settings.sql'), 'utf8');
  for (const part of settingsSql.split(';').filter((s) => s.trim())) {
    try {
      await conn.query(part);
    } catch (e) {
      if (!/Duplicate/i.test(e.message)) throw e;
    }
  }

  const brandSql = fs.readFileSync(path.join(__dirname, 'update-brand-colors.sql'), 'utf8');
  console.log('🎨 Brand colors sync...');
  for (const part of brandSql.split(';').filter((s) => s.trim())) {
    try {
      await conn.query(part);
    } catch (e) {
      if (!/Unknown column|doesn't exist/i.test(e.message)) throw e;
    }
  }

  await conn.end();
  console.log('✅ Database setup complete!');
  console.log('   Admin panel: http://localhost:3000/admin');
}

run().catch((err) => {
  console.error('❌ Setup ব্যর্থ:', err.message);
  process.exit(1);
});
