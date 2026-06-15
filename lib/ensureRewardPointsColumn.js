const { query } = require('../config/db');
const { usePostgres } = require('../config/db');

let ensured = false;

function isDuplicateColumnError(err) {
  const code = err?.code || err?.errno;
  return code === 'ER_DUP_FIELDNAME' || code === '42701' || /duplicate column/i.test(String(err?.message));
}

async function ensureRewardPointsColumn() {
  if (ensured) return true;
  const pg = usePostgres();
  const userDef = pg ? 'INT NOT NULL DEFAULT 0' : 'INT UNSIGNED NOT NULL DEFAULT 0';
  const orderDef = pg ? 'INT NOT NULL DEFAULT 0' : 'INT UNSIGNED NOT NULL DEFAULT 0';

  try {
    await query(`ALTER TABLE users ADD COLUMN reward_points ${userDef}`);
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }

  try {
    await query(`ALTER TABLE orders ADD COLUMN reward_points_awarded ${orderDef}`);
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }

  ensured = true;
  return true;
}

module.exports = { ensureRewardPointsColumn };
