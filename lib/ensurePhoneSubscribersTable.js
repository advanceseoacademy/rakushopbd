const { query, usePostgres } = require('../config/db');

let ensured = false;

async function ensurePhoneSubscribersTable() {
  if (ensured) return true;
  const pg = usePostgres();
  const sql = pg
    ? `CREATE TABLE IF NOT EXISTS phone_subscribers (
        id SERIAL PRIMARY KEY,
        customer_phone VARCHAR(30) NOT NULL,
        source VARCHAR(40) NOT NULL DEFAULT 'marketing',
        status VARCHAR(20) NOT NULL DEFAULT 'new',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )`
    : `CREATE TABLE IF NOT EXISTS phone_subscribers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_phone VARCHAR(30) NOT NULL,
        source VARCHAR(40) NOT NULL DEFAULT 'marketing',
        status VARCHAR(20) NOT NULL DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`;
  await query(sql);
  ensured = true;
  return true;
}

module.exports = { ensurePhoneSubscribersTable };
