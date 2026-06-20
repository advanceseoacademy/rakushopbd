const {
  REVIEW_PROFILES,
  productLabel,
  buildReviewAssignments,
  buildSyntheticStatsFromAssignments,
  syntheticReviewsForProduct,
} = require('./customerReviews');
const { ensureProductReviewAvatarColumn } = require('./ensureProductReviewAvatarColumn');
const { getHomeProductSections } = require('./homeProducts');
const { ensureProductSyntheticReviewsColumn } = require('./ensureProductSyntheticReviewsColumn');

function isSyntheticReviewEligible(productOrRow) {
  if (!productOrRow) return true;
  const v = productOrRow.allow_synthetic_reviews;
  if (v === 0 || v === false || v === '0') return false;
  return true;
}

function poolForSyntheticAssignments(pool) {
  return (pool || []).filter(isSyntheticReviewEligible);
}

async function attachSyntheticEligibility(query, pool) {
  if (!Array.isArray(pool) || !pool.length) return pool || [];
  const ids = [...new Set(pool.map((p) => Number(p?.id)).filter(Boolean))];
  if (!ids.length) return pool;

  const placeholders = ids.map(() => '?').join(',');
  const rows = await query(
    `SELECT id, allow_synthetic_reviews FROM products WHERE id IN (${placeholders})`,
    ids
  ).catch(() => []);
  const flags = new Map(rows.map((r) => [Number(r.id), r.allow_synthetic_reviews]));

  return pool.map((p) => ({
    ...p,
    allow_synthetic_reviews: flags.has(Number(p.id)) ? flags.get(Number(p.id)) : 1,
  }));
}

/** Same product order as homepage Customer Reviews (home-customer-reviews.js). */
async function getReviewProductPool(query) {
  await ensureProductSyntheticReviewsColumn();

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
      `SELECT p.id, p.name_bn, p.allow_synthetic_reviews
       FROM products p
       WHERE p.is_featured = 1
       ORDER BY p.name_bn ASC
       LIMIT 48`
    ).catch(() => []);
    for (const p of extra) {
      const id = Number(p?.id);
      if (id && !seen.has(id)) {
        seen.add(id);
        pool.push({
          id,
          name_bn: p.name_bn || '',
          allow_synthetic_reviews: p.allow_synthetic_reviews,
        });
      }
    }
  }

  return attachSyntheticEligibility(query, pool);
}

async function getDbApprovedReviews(query, productId) {
  await ensureProductReviewAvatarColumn();
  return query(
    `SELECT customer_name, rating, comment, created_at, image_url,
            reviewer_avatar_url, reviewer_city
     FROM product_reviews
     WHERE product_id = ? AND status = 'approved'
     ORDER BY created_at DESC
     LIMIT 50`,
    [productId]
  );
}

function reviewCustomerName(review) {
  return String(review?.customer_name || review?.customerName || '').trim();
}

function reviewNameKey(review) {
  return reviewCustomerName(review).toLowerCase();
}

/** Admin avatar URLs keyed by reviewer name (homepage + product reviews). */
async function getReviewerAvatarMap(query) {
  await ensureProductReviewAvatarColumn();
  const rows = await query(
    `SELECT customer_name, reviewer_avatar_url, reviewer_city
     FROM product_reviews
     WHERE reviewer_avatar_url IS NOT NULL AND TRIM(reviewer_avatar_url) != ''`
  ).catch(() => []);
  const map = new Map();
  for (const row of rows) {
    const name = String(row.customer_name || row.customerName || '').trim().toLowerCase();
    const url = String(row.reviewer_avatar_url || row.reviewerAvatarUrl || '').trim();
    if (!name || !url || map.has(name)) continue;
    map.set(name, {
      url,
      city: String(row.reviewer_city || row.reviewerCity || '').trim() || null,
    });
  }
  return map;
}

function enrichReviewsWithAvatars(reviews, avatarMap) {
  if (!avatarMap?.size || !Array.isArray(reviews)) return reviews || [];
  return reviews.map((review) => {
    const hit = avatarMap.get(reviewNameKey(review));
    if (!hit) return review;
    const out = { ...review };
    if (!String(out.reviewer_avatar_url || out.reviewerAvatarUrl || '').trim()) {
      out.reviewer_avatar_url = hit.url;
    }
    if (!String(out.reviewer_city || out.reviewerCity || out.city || '').trim() && hit.city) {
      out.reviewer_city = hit.city;
    }
    return out;
  });
}

async function getProductReviewsPayload(query, productId, opts = {}) {
  const pid = Number(productId);
  if (!pid) return { reviews: [], count: 0, avgRating: 0 };

  const dbReviews = await getDbApprovedReviews(query, pid);
  const avatarMap = opts.avatarMap || (await getReviewerAvatarMap(query));
  const rows = await query(
    'SELECT name_bn, allow_synthetic_reviews FROM products WHERE id = ? LIMIT 1',
    [pid]
  );
  const productRow = rows[0] || {};
  const productName = productRow.name_bn || '';
  const pool = opts.pool || (await getReviewProductPool(query));
  const assignmentPool = poolForSyntheticAssignments(pool);
  const assignments = opts.assignments || buildReviewAssignments(assignmentPool);
  const syntheticRaw = isSyntheticReviewEligible(productRow)
    ? syntheticReviewsForProduct(pid, productName, pool, assignments)
    : [];
  const dbNames = new Set(dbReviews.map(reviewNameKey).filter(Boolean));
  const synthetic = enrichReviewsWithAvatars(
    syntheticRaw.filter((r) => !dbNames.has(reviewNameKey(r))),
    avatarMap
  );
  const reviews = [...enrichReviewsWithAvatars(dbReviews, avatarMap), ...synthetic];
  const count = reviews.length;
  const avgRating = count
    ? Math.round((reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / count) * 10) / 10
    : 0;

  return { reviews, count, avgRating };
}

function buildSyntheticStatsByProductId(pool) {
  return buildSyntheticStatsFromAssignments(buildReviewAssignments(poolForSyntheticAssignments(pool)));
}

async function attachMergedReviewStatsToProducts(query, products, opts = {}) {
  if (!Array.isArray(products) || !products.length) return products;

  await ensureProductSyntheticReviewsColumn();
  const pool = await attachSyntheticEligibility(
    query,
    opts.pool || (await getReviewProductPool(query))
  );
  const assignments = buildReviewAssignments(poolForSyntheticAssignments(pool));
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

/** Approved DB reviews for homepage (all seeded/managed in product_reviews). */
async function getHomepageReviews(query, limit = 25) {
  const { ensureHomepageReviewsSeeded } = require('./ensureHomepageReviewsSeeded');
  await ensureHomepageReviewsSeeded();

  await ensureProductReviewAvatarColumn();
  const l = Math.min(30, Math.max(1, Number(limit) || 25));

  const rows = await query(
    `SELECT r.id, r.customer_name, r.rating, r.comment, r.created_at, r.product_id,
            r.reviewer_avatar_url, r.reviewer_city, r.homepage_sort_order,
            p.name_bn AS product_name, p.slug AS product_slug
     FROM product_reviews r
     INNER JOIN products p ON p.id = r.product_id
     WHERE r.status = 'approved' AND TRIM(COALESCE(r.comment, '')) != ''
     ORDER BY COALESCE(r.homepage_sort_order, 9999) ASC, r.created_at DESC
     LIMIT ?`,
    [l]
  ).catch(() => []);

  return rows;
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
  getHomepageReviews,
  getProductReviewsPayload,
  attachMergedReviewStatsToProducts,
  syncProductReviewStats,
};
