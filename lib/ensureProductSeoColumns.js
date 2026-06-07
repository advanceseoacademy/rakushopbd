const { query, usePostgres } = require('../config/db');

let ensured = false;
let widenedShortDescription = false;

const COLUMNS = [
  ['short_description', 'TEXT'],
  ['seo_title', 'VARCHAR(255)'],
  ['seo_description', 'VARCHAR(320)'],
  ['seo_keywords', 'VARCHAR(255)'],
  ['image_alt', 'VARCHAR(255)'],
  ['og_image', 'VARCHAR(500)'],
];

async function widenShortDescriptionColumn() {
  if (widenedShortDescription) return;
  const pg = usePostgres();
  try {
    if (pg) {
      await query(`ALTER TABLE products ALTER COLUMN short_description TYPE TEXT`);
    } else {
      await query(`ALTER TABLE products MODIFY COLUMN short_description TEXT NULL`);
    }
  } catch (err) {
    /* column may already be TEXT or missing on fresh installs */
  }
  widenedShortDescription = true;
}

function isDuplicateColumnError(err) {
  const code = err?.code || err?.errno;
  return code === 'ER_DUP_FIELDNAME' || code === '42701' || /duplicate column/i.test(String(err?.message));
}

async function ensureProductSeoColumns() {
  if (ensured) return true;
  const pg = usePostgres();
  for (const [name, type] of COLUMNS) {
    const def = pg ? `${type}` : `${type} NULL`;
    try {
      await query(`ALTER TABLE products ADD COLUMN ${name} ${def}`);
    } catch (err) {
      if (!isDuplicateColumnError(err)) throw err;
    }
  }
  await widenShortDescriptionColumn();
  ensured = true;
  return true;
}

module.exports = { ensureProductSeoColumns };
