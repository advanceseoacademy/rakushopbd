const {
  REVIEW_PROFILES,
  buildReviewAssignments,
  buildSyntheticStatsFromAssignments,
  syntheticReviewsForProduct,
} = require('./customerReviews');
const { getHomeProductSections } = require('./homeProducts');

/** Same product order as homepage Customer Reviews (home-customer-reviews.js). */
async function getReviewProductPool(query) {
  const { bestSelling, newArrivals } = await getHomeProductSections(query, 24);
  const seen = new Set();
  const pool = [];

  for (const p of [...bestSelling, ...newArrivals]) {
    const id = Number(p?.id);
    if (id && !seen.has(id)) {
      seen.add(id);
      pool.push({ id, name_bn: p.name_bn || p.nameBn || '' });
    }
  }

  if (pool.length < REVIEW_PROFILES.length) {
    const extra = await query(
      `SELECT p.id, p.name_bn
       FROM products p
       WHERE p.is_featured = 1
       ORDER BY p.name_bn ASC
       LIMIT 48`
    ).catch(() => []);
    for (const p of extra) {
      const id = Number(p?.id);
      if (id && !seen.has(id)) {
        seen.add(id);
        pool.push({ id, name_bn: p.name_bn || '' });
      }
    }
  }

  return pool;
}

async function getDbApprovedReviews(query, productId) {
  return query(
    `SELECT customer_name, rating, comment, created_at
     FROM product_reviews
     WHERE product_id = ? AND status = 'approved'
     ORDER BY created_at DESC
     LIMIT 50`,
    [productId]
  );
}

async function getProductReviewsPayload(query, productId, opts = {}) {
  const pid = Number(productId);
  if (!pid) return { reviews: [], count: 0, avgRating: 0 };

  const dbReviews = await getDbApprovedReviews(query, pid);
  const rows = await query('SELECT name_bn FROM products WHERE id = ? LIMIT 1', [pid]);
  const productName = rows[0]?.name_bn || '';
  const pool = opts.pool || (await getReviewProductPool(query));
  const assignments = opts.assignments || buildReviewAssignments(pool);
  const synthetic = syntheticReviewsForProduct(pid, productName, pool, assignments);
  const reviews = [...dbReviews, ...synthetic];
  const count = reviews.length;
  const avgRating = count
    ? Math.round((reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / count) * 10) / 10
    : 0;

  return { reviews, count, avgRating };
}

function buildSyntheticStatsByProductId(pool) {
  return buildSyntheticStatsFromAssignments(buildReviewAssignments(pool));
}

async function attachMergedReviewStatsToProducts(query, products, opts = {}) {
  if (!Array.isArray(products) || !products.length) return products;

  const pool = opts.pool || (await getReviewProductPool(query));
  const assignments = buildReviewAssignments(pool);
  const syntheticMap = buildSyntheticStatsFromAssignments(assignments);
  const ids = [...new Set(products.map((p) => Number(p.id)).filter(Boolean))];
  const dbMap = new Map();

  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    const rows = await query(
      `SELECT product_id, COUNT(*) AS c, SUM(rating) AS rating_sum
       FROM product_reviews
       WHERE product_id IN (${placeholders}) AND status = 'approved'
       GROUP BY product_id`,
      ids
    ).catch(() => []);
    rows.forEach((row) => {
      const pid = Number(row.product_id);
      dbMap.set(pid, {
        count: Number(row.c) || 0,
        ratingSum: Number(row.rating_sum) || 0,
      });
    });
  }

  return products.map((p) => {
    const id = Number(p.id);
    const db = dbMap.get(id) || { count: 0, ratingSum: 0 };
    const syn = syntheticMap.get(id) || { count: 0, ratingSum: 0 };
    const totalCount = db.count + syn.count;
    if (!totalCount) return p;
    const avgRating =
      Math.round(((db.ratingSum + syn.ratingSum) / totalCount) * 10) / 10;
    return { ...p, review_count: totalCount, rating: avgRating };
  });
}

async function syncProductReviewStats(query, productId) {
  const pid = Number(productId);
  if (!pid) return;
  const rows = await query(
    `SELECT COUNT(*) AS c, ROUND(AVG(rating), 1) AS avg
     FROM product_reviews
     WHERE product_id = ? AND status = 'approved'`,
    [pid]
  );
  const count = Number(rows[0]?.c) || 0;
  const avg = count ? Number(rows[0]?.avg) || 0 : 0;
  await query('UPDATE products SET review_count = ?, rating = ? WHERE id = ?', [count, avg, pid]);
}

module.exports = {
  getReviewProductPool,
  getProductReviewsPayload,
  attachMergedReviewStatsToProducts,
  syncProductReviewStats,
};
