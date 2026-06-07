const { query, usePostgres } = require('../config/db');

let ensured = false;

async function ensureContactMessagesTable() {
  if (ensured) return true;
  const pg = usePostgres();
  const sql = pg
    ? `CREATE TABLE IF NOT EXISTS contact_messages (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(120) NOT NULL,
        customer_phone VARCHAR(30) NOT NULL,
        customer_email VARCHAR(120),
        subject VARCHAR(160) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'new',
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`;
  await query(sql);
  ensured = true;
  return true;
}

module.exports = { ensureContactMessagesTable };
