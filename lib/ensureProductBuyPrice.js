const { query, usePostgres } = require('../config/db');

let ensured = false;

function isDuplicateColumnError(err) {
  const code = err?.code || err?.errno;
  return code === 'ER_DUP_FIELDNAME' || code === '42701' || /duplicate column/i.test(String(err?.message));
}

async function ensureProductBuyPrice() {
  if (ensured) return true;
  const pg = usePostgres();
  const type = pg ? 'NUMERIC(12,2)' : 'DECIMAL(12,2) NULL';
  try {
    await query(`ALTER TABLE products ADD COLUMN buy_price ${type}`);
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }
  ensured = true;
  return true;
}

module.exports = { ensureProductBuyPrice };
