const { query, usePostgres } = require('../config/db');

let ensured = false;
let ensurePromise = null;

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

function isMissingColumnError(err) {
  const code = err?.code || err?.errno;
  return (
    code === '42703' ||
    code === 'ER_BAD_FIELD_ERROR' ||
    /does not exist|unknown column/i.test(String(err?.message || ''))
  );
}

async function ensureBlogSeoColumns() {
  if (ensured) return true;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    // Fast path: one SELECT — if SEO columns exist, skip ALTER round-trips.
    try {
      await query(
        'SELECT seo_title, seo_description, seo_keywords, image_alt, og_image FROM blog_posts LIMIT 1'
      );
      ensured = true;
      return true;
    } catch (err) {
      if (!isMissingColumnError(err)) {
        // Table may not exist yet — still try ADD COLUMN below.
      }
    }

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
  })().finally(() => {
    ensurePromise = null;
  });

  return ensurePromise;
}

module.exports = { ensureBlogSeoColumns };
