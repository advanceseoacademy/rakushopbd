/**
 * Test remote MySQL from your Mac
 * Usage: npm run db:test-remote
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

const remotePath = path.join(__dirname, '../.env.remote');
if (!fs.existsSync(remotePath)) {
  console.error('❌ .env.remote নেই — cp .env.remote.example .env.remote');
  process.exit(1);
}
dotenv.config({ path: remotePath });

async function main() {
  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 15000,
  };

  console.log('Testing:', config.user, '@', config.host + ':' + config.port, '/', config.database);

  try {
    const conn = await mysql.createConnection(config);
    const [rows] = await conn.query('SELECT COUNT(*) AS c FROM admins');
    const [prods] = await conn.query('SELECT COUNT(*) AS c FROM products');
    console.log('✅ Connected!');
    console.log('   admins:', rows[0].c, '| products:', prods[0].c);
    await conn.end();
  } catch (err) {
    console.error('❌ Failed:', err.code || err.message);
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      console.error('\n→ Port 3306 blocked? cPanel এ IP whitelist করুন:', await publicIp());
      console.error('→ অথবা SSH tunnel লাগতে পারে (Hostnin support জিজ্ঞেস করুন)');
    }
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n→ DB_USER / DB_PASSWORD ভুল — cPanel MySQL password চেক করুন');
    }
    if (err.code === 'ER_BAD_DB_ERROR') {
      console.error('\n→ DB_NAME ভুল');
    }
    process.exit(1);
  }
}

async function publicIp() {
  try {
    const res = await fetch('https://api.ipify.org');
    return await res.text();
  } catch {
    return '(curl ifconfig.me)';
  }
}

main();
