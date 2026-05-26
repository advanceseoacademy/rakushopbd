/**
 * Create env-for-cpanel.txt from .env.remote (upload to server as .env)
 * Run: node scripts/generate-cpanel-env.js
 */
const fs = require('fs');
const path = require('path');

const remotePath = path.join(__dirname, '../.env.remote');
const outPath = path.join(__dirname, '../env-for-cpanel.txt');

if (!fs.existsSync(remotePath)) {
  console.error('❌ .env.remote নেই — password সেট করে আবার চালান');
  process.exit(1);
}

const lines = fs.readFileSync(remotePath, 'utf8').split('\n');
const get = (key) => {
  const line = lines.find((l) => l.startsWith(key + '='));
  return line ? line.slice(key.length + 1).trim() : '';
};

const content = `PORT=3000
NODE_ENV=production
DB_HOST=localhost
DB_PORT=3306
DB_USER=${get('DB_USER')}
DB_PASSWORD=${get('DB_PASSWORD')}
DB_NAME=${get('DB_NAME')}
SESSION_SECRET=${get('SESSION_SECRET') || 'rakushopbd-live-secret-change-me-32chars'}
ADMIN_USERNAME=${get('ADMIN_USERNAME')}
ADMIN_EMAIL=${get('ADMIN_EMAIL')}
ADMIN_PASSWORD=${get('ADMIN_PASSWORD')}
`;

fs.writeFileSync(outPath, content, 'utf8');
console.log('✅ Created:', outPath);
console.log('');
console.log('cPanel → File Manager → repositories/rakushopbd');
console.log('→ Upload as file name: .env');
console.log('→ Node.js App → Environment Variables (same values) → SAVE');
console.log('→ STOP → 10s → START');
