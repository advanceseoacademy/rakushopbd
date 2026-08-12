const { query, usePostgres } = require('../config/db');

let ensured = false;

function isDuplicateColumnError(err) {
  const code = err?.code || err?.errno;
  return code === 'ER_DUP_FIELDNAME' || code === '42701' || /duplicate column/i.test(String(err?.message));
}

async function ensureContactMessagesTable() {
  if (ensured) return true;
  const pg = usePostgres();
  let viewedColumnAddedNow = false;
  const sql = pg
    ? `CREATE TABLE IF NOT EXISTS contact_messages (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(120) NOT NULL,
        customer_phone VARCHAR(30) NOT NULL,
        customer_email VARCHAR(120),
        subject VARCHAR(160) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'new',
        viewed_by_admin BOOLEAN NOT NULL DEFAULT false,
        viewed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )`
    : `CREATE TABLE IF NOT EXISTS contact_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_name VARCHAR(120) NOT NULL,
        customer_phone VARCHAR(30) NOT NULL,
        customer_email VARCHAR(120) NULL,
        subject VARCHAR(160) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'new',
        viewed_by_admin TINYINT(1) NOT NULL DEFAULT 0,
        viewed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`;
  await query(sql);
  try {
    await query(
      `ALTER TABLE contact_messages ADD COLUMN viewed_by_admin ${pg ? 'BOOLEAN NOT NULL DEFAULT false' : 'TINYINT(1) NOT NULL DEFAULT 0'}`
    );
    viewedColumnAddedNow = true;
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }
  try {
    await query(
      `ALTER TABLE contact_messages ADD COLUMN viewed_at ${pg ? 'TIMESTAMPTZ NULL' : 'TIMESTAMP NULL'}`
    );
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }
  if (viewedColumnAddedNow) {
    await query(
      'UPDATE contact_messages SET viewed_by_admin = true, viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP)'
    );
  }
  ensured = true;
  return true;
}

module.exports = { ensureContactMessagesTable };
