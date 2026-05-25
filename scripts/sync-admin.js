/**
 * Sync admin user from .env (run: npm run admin:sync)
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getPool } = require('../config/db');

async function main() {
  const username = (process.env.ADMIN_USERNAME || 'admin').trim();
  const email = (process.env.ADMIN_EMAIL || 'admin@rakushopbd.com').trim().toLowerCase();
  const password = (process.env.ADMIN_PASSWORD || '').trim();

  if (!password || password.length < 6) {
    console.error('❌ Set ADMIN_PASSWORD in .env (min 6 characters)');
    process.exit(1);
  }

  const pool = getPool();
  const hash = await bcrypt.hash(password, 10);

  const [rows] = await pool.query('SELECT id FROM admins LIMIT 1');
  if (rows.length) {
    await pool.query(
      'UPDATE admins SET username = ?, email = ?, password_hash = ?, full_name = ? WHERE id = ?',
      [username, email, hash, 'Administrator', rows[0].id]
    );
    console.log('✅ Admin updated');
  } else {
    await pool.query(
      'INSERT INTO admins (username, email, password_hash, full_name) VALUES (?, ?, ?, ?)',
      [username, email, hash, 'Administrator']
    );
    console.log('✅ Admin created');
  }

  console.log(`   Username: ${username}`);
  console.log(`   Email:    ${email}`);
  console.log('   Password: (from .env ADMIN_PASSWORD)');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
