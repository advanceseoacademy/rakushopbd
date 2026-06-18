const { query, usePostgres } = require('../config/db');

let ensured = false;

function isDuplicateColumnError(err) {
  const code = err?.code || err?.errno;
  return code === 'ER_DUP_FIELDNAME' || code === '42701' || /duplicate column/i.test(String(err?.message));
}

async function ensureProductSyntheticReviewsColumn() {
  if (ensured) return true;
  const pg = usePostgres();
  const type = pg ? 'SMALLINT NOT NULL DEFAULT 1' : 'TINYINT(1) NOT NULL DEFAULT 1';
  try {
    await query(`ALTER TABLE products ADD COLUMN allow_synthetic_reviews ${type}`);
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }
  ensured = true;
  return true;
}

module.exports = { ensureProductSyntheticReviewsColumn };
