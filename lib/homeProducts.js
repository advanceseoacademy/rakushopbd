/**
 * Homepage product sections: best sellers (by order qty) and new arrivals (by created_at).
 */
const appCache = require('./appCache');
const { CARD_PRODUCT_SQL, toCardProductList } = require('./productPublic');

const PRODUCT_FIELDS = CARD_PRODUCT_SQL;
const SECTIONS_TTL_SEC = 5 * 60;

function sectionsCacheKey(limit) {
  return `home-sections:v2:${limit}`;
}

function clearHomeProductsCache() {
  void appCache.delByPrefix('home-sections:');
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
  const cacheKey = sectionsCacheKey(lim);
  const cached = await appCache.getJson(cacheKey);
  if (cached && (cached.bestSelling?.length || cached.newArrivals?.length)) {
    return cached;
  }

  const [bestSellingRaw, newArrivalsRaw] = await Promise.all([
    getBestSellingProducts(query, lim),
    getNewArrivalProducts(query, lim),
  ]);
  const data = {
    bestSelling: toCardProductList(bestSellingRaw),
    newArrivals: toCardProductList(newArrivalsRaw),
  };

  // Never cache empty — startup timeouts can poison cache for 5 minutes on VPS.
  if (data.bestSelling.length || data.newArrivals.length) {
    await appCache.setJson(cacheKey, data, SECTIONS_TTL_SEC);
  }

  return data;
}

module.exports = {
  getBestSellingProducts,
  getNewArrivalProducts,
  getHomeProductSections,
  clearHomeProductsCache,
};
