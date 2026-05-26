/**
 * Start app using live database via .env.remote
 * Usage: npm run start:remote
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const remotePath = path.join(__dirname, '../.env.remote');
if (!fs.existsSync(remotePath)) {
  console.error('❌ .env.remote নেই। চালান:');
  console.error('   cp .env.remote.example .env.remote');
  console.error('   তারপর DB_PASSWORD = cPanel MySQL password দিন');
  process.exit(1);
}

dotenv.config({ path: remotePath, override: true });
require('../server.js');
