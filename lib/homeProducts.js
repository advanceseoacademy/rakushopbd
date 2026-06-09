/**
 * Homepage product sections: best sellers (by order qty) and new arrivals (by created_at).
 */
const PRODUCT_FIELDS = `p.*, c.slug AS category_slug, c.name_bn AS category_name`;

let sectionsCache = null;
let sectionsCacheAt = 0;
const SECTIONS_TTL_MS = 5 * 60 * 1000;

function clearHomeProductsCache() {
  sectionsCache = null;
  sectionsCacheAt = 0;
}

async function getBestSellingProducts(query, limit = 24) {
  return query(
    `SELECT ${PRODUCT_FIELDS}, COALESCE(sales.qty, 0) AS sold_qty
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN (
       SELECT oi.product_id, SUM(oi.quantity) AS qty
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
       GROUP BY oi.product_id
     ) sales ON sales.product_id = p.id
     ORDER BY sold_qty DESC, p.created_at DESC, p.id DESC
     LIMIT ?`,
    [limit]
  ).catch(() => []);
}

async function getNewArrivalProducts(query, limit = 24) {
  return query(
    `SELECT ${PRODUCT_FIELDS}
     FROM products p
     JOIN categories c ON c.id = p.category_id
     ORDER BY p.id DESC, p.created_at DESC
     LIMIT ?`,
    [limit]
  ).catch(() => []);
}

/** Cached best-selling + new-arrival lists (shared by bootstrap and /api/products/home-sections). */
async function getHomeProductSections(query, limit = 24) {
  const lim = Math.min(48, Math.max(4, Number(limit) || 24));
  if (
    sectionsCache &&
    sectionsCache.limit === lim &&
    Date.now() - sectionsCacheAt < SECTIONS_TTL_MS &&
    (sectionsCache.data.bestSelling.length || sectionsCache.data.newArrivals.length)
  ) {
    return sectionsCache.data;
  }

  const [bestSelling, newArrivals] = await Promise.all([
    getBestSellingProducts(query, lim),
    getNewArrivalProducts(query, lim),
  ]);
  const data = { bestSelling, newArrivals };

  // Never cache empty — startup timeouts can poison cache for 5 minutes on VPS.
  if (bestSelling.length || newArrivals.length) {
    sectionsCache = { limit: lim, data };
    sectionsCacheAt = Date.now();
  }

  return data;
}

module.exports = {
  getBestSellingProducts,
  getNewArrivalProducts,
  getHomeProductSections,
  clearHomeProductsCache,
};
