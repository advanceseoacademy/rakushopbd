const { query, usePostgres } = require('../config/db');

let ensured = false;

function isDuplicateColumnError(err) {
  const code = err?.code || err?.errno;
  return code === 'ER_DUP_FIELDNAME' || code === '42701' || /duplicate column/i.test(String(err?.message));
}

async function ensureOrderAdminViewColumns() {
  if (ensured) return true;
  const pg = usePostgres();
  const boolDef = pg ? 'BOOLEAN NOT NULL DEFAULT false' : 'TINYINT(1) NOT NULL DEFAULT 0';
  const tsDef = pg ? 'TIMESTAMPTZ NULL' : 'TIMESTAMP NULL';
  let viewedColumnAddedNow = false;

  try {
    await query(`ALTER TABLE orders ADD COLUMN viewed_by_admin ${boolDef}`);
    viewedColumnAddedNow = true;
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }

  try {
    await query(`ALTER TABLE orders ADD COLUMN viewed_at ${tsDef}`);
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }

  if (viewedColumnAddedNow) {
    // Baseline existing orders as viewed so only future/new orders appear as unread.
    await query('UPDATE orders SET viewed_by_admin = true, viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP)');
  }

  ensured = true;
  return true;
}

module.exports = { ensureOrderAdminViewColumns };
