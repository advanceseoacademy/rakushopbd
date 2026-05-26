const { query } = require('../config/db');
const { getSiteSettings } = require('./siteSettings');
const { sql: sqlDialect } = require('./db-dialect');

let cache = null;
let cacheAt = 0;
const TTL_MS = 60 * 1000;

async function getStoreBootstrap() {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;

  const [
    settings,
    categories,
    banners,
    products,
    statsRow,
  ] = await Promise.all([
    getSiteSettings(query),
    query(
      `SELECT c.id, c.slug, c.name_bn, c.icon, c.sort_order,
              COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.name_bn ASC`
    ).catch(() => []),
    query(
      `SELECT id, title, position, link_url, image_url, bg_gradient FROM banners
       WHERE is_active=1 AND ${sqlDialect.curDateOrLater()}
       ORDER BY sort_order`
    ).catch(() => []),
    query(
      `SELECT p.*, c.slug AS category_slug, c.name_bn AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.is_featured = 1
       ORDER BY p.name_bn ASC
       LIMIT 24`
    ).catch(() => []),
    query(
      `SELECT
         (SELECT COUNT(*) FROM products) AS product_count,
         (SELECT COUNT(*) FROM orders) AS order_count,
         (SELECT ROUND(AVG(rating), 1) FROM products) AS avg_rating`
    ).catch(() => [{ product_count: 0, order_count: 0, avg_rating: 4.8 }]),
  ]);

  const s = statsRow[0] || {};
  const payload = {
    ok: true,
    maintenance: settings.maintenance_mode === '1',
    settings,
    categories,
    banners,
    products,
    stats: {
      productCount: Number(s.product_count ?? s.productcount) || 0,
      orderCount: Number(s.order_count ?? s.ordercount) || 0,
      avgRating: Number(s.avg_rating ?? s.avgrating) || 4.8,
      districts: 64,
    },
  };

  cache = payload;
  cacheAt = Date.now();
  return payload;
}

function clearStoreBootstrapCache() {
  cache = null;
  cacheAt = 0;
}

module.exports = { getStoreBootstrap, clearStoreBootstrapCache };
