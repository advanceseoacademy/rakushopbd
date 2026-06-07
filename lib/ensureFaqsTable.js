const { query, usePostgres } = require('../config/db');
const { DEFAULT_FAQS } = require('./faqs');

let ensured = false;

async function ensureFaqsTable() {
  if (ensured) return true;
  const pg = usePostgres();
  const sql = pg
    ? `CREATE TABLE IF NOT EXISTS faqs (
        id SERIAL PRIMARY KEY,
        question VARCHAR(500) NOT NULL,
        answer TEXT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_active SMALLINT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )`
    : `CREATE TABLE IF NOT EXISTS faqs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        question VARCHAR(500) NOT NULL,
        answer TEXT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`;
  await query(sql);

  const countRow = await query('SELECT COUNT(*) AS c FROM faqs');
  const count = Number(countRow[0]?.c ?? Object.values(countRow[0] || {})[0]) || 0;
  if (count === 0) {
    for (const faq of DEFAULT_FAQS) {
      await query(
        'INSERT INTO faqs (question, answer, sort_order, is_active) VALUES (?, ?, ?, 1)',
        [faq.question, faq.answer, faq.sortOrder]
      );
    }
  }

  ensured = true;
  return true;
}

module.exports = { ensureFaqsTable };
