const { query } = require('../config/db');
const { usePostgres } = require('../config/db');
const { getSiteSettings } = require('./siteSettings');
const { setTodaySellingProducts } = require('./todaySellingSlots');

let ensured = false;

function isDuplicateColumnError(err) {
  const code = err?.code || err?.errno;
  return code === 'ER_DUP_FIELDNAME' || code === '42701' || /duplicate column/i.test(String(err?.message));
}

async function migrateTodaySellingFromSettings() {
  try {
    const rows = await query(
      'SELECT COUNT(*) AS c FROM products WHERE today_selling_slot IN (1, 2)'
    );
    const count = Number(rows[0]?.c ?? rows[0]?.count ?? 0);
    if (count > 0) return;

    const settings = await getSiteSettings(query);
    const id1 = settings.today_selling_product_1;
    const id2 = settings.today_selling_product_2;
    if (!id1 && !id2) return;
    await setTodaySellingProducts(query, id1 || null, id2 || null);
  } catch (err) {
    console.warn('Today Selling settings migration:', err.message);
  }
}

async function ensureTodaySellingColumn() {
  if (ensured) return true;
  const pg = usePostgres();
  const def = pg ? 'SMALLINT NOT NULL DEFAULT 0' : 'TINYINT UNSIGNED NOT NULL DEFAULT 0';
  try {
    await query(`ALTER TABLE products ADD COLUMN today_selling_slot ${def}`);
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }
  await migrateTodaySellingFromSettings();
  ensured = true;
  return true;
}

module.exports = { ensureTodaySellingColumn };
