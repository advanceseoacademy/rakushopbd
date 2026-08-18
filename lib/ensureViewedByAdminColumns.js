const { query, usePostgres } = require('../config/db');

const ALLOWED_TABLES = new Set(['product_reviews', 'product_review_videos']);

function isDuplicateColumnError(err) {
  const code = err?.code || err?.errno;
  return code === 'ER_DUP_FIELDNAME' || code === '42701' || /duplicate column/i.test(String(err?.message));
}

const ensuredTables = new Set();

async function ensureViewedByAdminColumns(tableName) {
  if (!ALLOWED_TABLES.has(tableName)) {
    throw new Error(`Unsupported table for viewed columns: ${tableName}`);
  }
  if (ensuredTables.has(tableName)) return true;

  const pg = usePostgres();
  const boolDef = pg ? 'BOOLEAN NOT NULL DEFAULT false' : 'TINYINT(1) NOT NULL DEFAULT 0';
  const tsDef = pg ? 'TIMESTAMPTZ NULL' : 'TIMESTAMP NULL';
  let viewedColumnAddedNow = false;

  try {
    await query(`ALTER TABLE ${tableName} ADD COLUMN viewed_by_admin ${boolDef}`);
    viewedColumnAddedNow = true;
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }

  try {
    await query(`ALTER TABLE ${tableName} ADD COLUMN viewed_at ${tsDef}`);
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }

  if (viewedColumnAddedNow) {
    await query(
      `UPDATE ${tableName} SET viewed_by_admin = true, viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP)`
    );
  }

  ensuredTables.add(tableName);
  return true;
}

function isViewedByAdmin(val) {
  return val === true || val === 1 || val === '1' || val === 't' || val === 'true';
}

async function countUnreadByAdmin(tableName) {
  if (!ALLOWED_TABLES.has(tableName)) {
    throw new Error(`Unsupported table for unread count: ${tableName}`);
  }
  const rows = await query(`SELECT COUNT(*) AS c FROM ${tableName} WHERE viewed_by_admin IS NOT TRUE`);
  if (!rows?.[0]) return 0;
  return Number(Object.values(rows[0])[0]) || 0;
}

async function markRowsViewedByAdmin(tableName, ids) {
  if (!ALLOWED_TABLES.has(tableName)) {
    throw new Error(`Unsupported table for mark viewed: ${tableName}`);
  }
  const cleanIds = [...new Set((ids || []).map(Number).filter(Boolean))];
  if (!cleanIds.length) return { updated: 0, unreadCount: await countUnreadByAdmin(tableName) };
  const placeholders = cleanIds.map(() => '?').join(',');
  await query(
    `UPDATE ${tableName}
     SET viewed_by_admin = true, viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP)
     WHERE id IN (${placeholders})`,
    cleanIds
  );
  return { updated: cleanIds.length, unreadCount: await countUnreadByAdmin(tableName) };
}

module.exports = {
  ensureViewedByAdminColumns,
  isViewedByAdmin,
  countUnreadByAdmin,
  markRowsViewedByAdmin,
};
