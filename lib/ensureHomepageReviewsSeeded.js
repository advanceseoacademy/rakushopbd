const { query, usePostgres } = require('../config/db');
const { REVIEW_PROFILES, productLabel } = require('./customerReviews');
const { ensureProductReviewAvatarColumn } = require('./ensureProductReviewAvatarColumn');

let seeded = false;

function isDuplicateColumnError(err) {
  const code = err?.code || err?.errno;
  return code === 'ER_DUP_FIELDNAME' || code === '42701' || /duplicate column/i.test(String(err?.message));
}

function isDuplicateIndexError(err) {
  const code = err?.code || err?.errno;
  return code === 'ER_DUP_KEYNAME' || code === '23505' || /duplicate key|already exists/i.test(String(err?.message));
}

async function addColumnIfMissing(sql) {
  try {
    await query(sql);
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }
}

async function ensureHomepageReviewColumns() {
  const pg = usePostgres();
  await ensureProductReviewAvatarColumn();
  await addColumnIfMissing(
    pg
      ? 'ALTER TABLE product_reviews ADD COLUMN homepage_seed_key VARCHAR(40)'
      : 'ALTER TABLE product_reviews ADD COLUMN homepage_seed_key VARCHAR(40) NULL'
  );
  await addColumnIfMissing(
    pg
      ? 'ALTER TABLE product_reviews ADD COLUMN reviewer_city VARCHAR(80)'
      : 'ALTER TABLE product_reviews ADD COLUMN reviewer_city VARCHAR(80) NULL'
  );
  await addColumnIfMissing(
    pg
      ? 'ALTER TABLE product_reviews ADD COLUMN homepage_sort_order INTEGER'
      : 'ALTER TABLE product_reviews ADD COLUMN homepage_sort_order INT NULL'
  );
  try {
    await query(
      pg
        ? 'CREATE UNIQUE INDEX IF NOT EXISTS idx_product_reviews_homepage_seed ON product_reviews (homepage_seed_key) WHERE homepage_seed_key IS NOT NULL'
        : 'CREATE UNIQUE INDEX idx_product_reviews_homepage_seed ON product_reviews (homepage_seed_key)'
    );
  } catch (err) {
    if (!isDuplicateIndexError(err)) throw err;
  }
}

/** Insert default homepage carousel reviews into product_reviews (idempotent). */
async function ensureHomepageReviewsSeeded(force = false) {
  if (seeded && !force) return true;

  await ensureHomepageReviewColumns();

  const { getReviewProductPool } = require('./productReviews');
  const pool = await getReviewProductPool(query);
  if (!pool.length) {
    seeded = true;
    return true;
  }

  const productIdsTouched = new Set();

  for (let i = 0; i < REVIEW_PROFILES.length; i++) {
    const profile = REVIEW_PROFILES[i];
    const seedKey = `homepage_${i}`;
    const existing = await query(
      'SELECT id, product_id FROM product_reviews WHERE homepage_seed_key = ? LIMIT 1',
      [seedKey]
    ).catch(() => []);

    const product = pool[i % pool.length];
    const productId = Number(product?.id);
    if (!productId) continue;

    const comment = profile.text(productLabel(product.name_bn || ''));

    if (existing.length) {
      // Keep admin-edited content; only ensure carousel sort order stays stable.
      await query(
        `UPDATE product_reviews SET homepage_sort_order = ? WHERE homepage_seed_key = ?`,
        [i, seedKey]
      ).catch(() => {});
      productIdsTouched.add(Number(existing[0].product_id || existing[0].productId));
      continue;
    }

    await query(
      `INSERT INTO product_reviews
        (product_id, user_id, customer_name, rating, comment, reviewer_city, reviewer_avatar_url, status, homepage_seed_key, homepage_sort_order)
       VALUES (?, NULL, ?, ?, ?, ?, NULL, 'approved', ?, ?)`,
      [productId, profile.name, profile.rating, comment, profile.city || null, seedKey, i]
    );
    productIdsTouched.add(productId);
  }

  const { syncProductReviewStats } = require('./productReviews');
  for (const pid of productIdsTouched) {
    await syncProductReviewStats(query, pid).catch(() => {});
  }

  seeded = true;
  return true;
}

module.exports = { ensureHomepageReviewsSeeded, ensureHomepageReviewColumns };
