const { query, usePostgres } = require('../config/db');

let ensured = false;

function isDuplicateColumnError(err) {
  const code = err?.code || err?.errno;
  return code === 'ER_DUP_FIELDNAME' || code === '42701' || /duplicate column/i.test(String(err?.message));
}

async function ensureAdminRoleColumn() {
  if (ensured) return true;
  const pg = usePostgres();
  const type = pg ? "VARCHAR(32) NOT NULL DEFAULT 'super_admin'" : "VARCHAR(32) NOT NULL DEFAULT 'super_admin'";
  try {
    await query(`ALTER TABLE admins ADD COLUMN role ${type}`);
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }
  ensured = true;
  return true;
}

module.exports = { ensureAdminRoleColumn };
