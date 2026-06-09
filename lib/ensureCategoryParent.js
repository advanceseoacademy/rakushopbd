const { query, usePostgres } = require('../config/db');

let ensured = false;

function isDuplicateColumnError(err) {
  const code = err?.code || err?.errno;
  return code === 'ER_DUP_FIELDNAME' || code === '42701' || /duplicate column/i.test(String(err?.message));
}

async function ensureCategoryParent() {
  if (ensured) return true;
  const pg = usePostgres();
  const colType = pg ? 'INT' : 'INT UNSIGNED NULL';
  try {
    await query(`ALTER TABLE categories ADD COLUMN parent_id ${colType}`);
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }
  ensured = true;
  return true;
}

module.exports = { ensureCategoryParent };
