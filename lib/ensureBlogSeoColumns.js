const { query, usePostgres } = require('../config/db');

let ensured = false;

const COLUMNS = [
  ['seo_title', 'VARCHAR(255)'],
  ['seo_description', 'VARCHAR(320)'],
  ['seo_keywords', 'VARCHAR(255)'],
  ['image_alt', 'VARCHAR(255)'],
  ['og_image', 'VARCHAR(500)'],
];

function isDuplicateColumnError(err) {
  const code = err?.code || err?.errno;
  return code === 'ER_DUP_FIELDNAME' || code === '42701' || /duplicate column/i.test(String(err?.message));
}

async function ensureBlogSeoColumns() {
  if (ensured) return true;
  const pg = usePostgres();
  for (const [name, type] of COLUMNS) {
    const def = pg ? `${type}` : `${type} NULL`;
    try {
      await query(`ALTER TABLE blog_posts ADD COLUMN ${name} ${def}`);
    } catch (err) {
      if (!isDuplicateColumnError(err)) throw err;
    }
  }
  ensured = true;
  return true;
}

module.exports = { ensureBlogSeoColumns };
