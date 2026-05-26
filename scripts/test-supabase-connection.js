require('dotenv').config();
const { query } = require('../config/db');

async function main() {
  const products = await query('SELECT COUNT(*) AS c FROM products');
  const admins = await query('SELECT COUNT(*) AS c FROM admins');
  console.log('✅ Supabase connected');
  console.log('   products:', products[0].c, '| admins:', admins[0].c);
  process.exit(0);
}

main().catch((e) => {
  console.error('❌', e.message);
  console.error('\n→ Supabase Dashboard → Database → Reset password to:');
  console.error('   RakuShopBd_Supabase_2026_Xk9');
  console.error('   (must match DATABASE_URL in .env)');
  process.exit(1);
});
