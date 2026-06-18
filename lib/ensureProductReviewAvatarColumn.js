const { query, usePostgres } = require('../config/db');

let ensured = false;

function isDuplicateColumnError(err) {
  const code = err?.code || err?.errno;
  return code === 'ER_DUP_FIELDNAME' || code === '42701' || /duplicate column/i.test(String(err?.message));
}

async function ensureProductReviewAvatarColumn() {
  if (ensured) return true;
  const pg = usePostgres();
  const type = pg ? 'VARCHAR(500)' : 'VARCHAR(500) NULL';
  try {
    await query(`ALTER TABLE product_reviews ADD COLUMN reviewer_avatar_url ${type}`);
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }
  ensured = true;
  return true;
}

module.exports = { ensureProductReviewAvatarColumn };

