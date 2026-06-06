const { query } = require('../config/db');
const { getSiteSettings } = require('./siteSettings');
const { getAdminIdFromRequest } = require('./adminToken');
const { sql: sqlDialect } = require('./db-dialect');
const { getBestSellingProducts, getNewArrivalProducts } = require('./homeProducts');

let cache = null;
let cacheAt = 0;
const TTL_MS = 60 * 1000;
const productCache = new Map();

function maintenanceActiveForRequest(req, settings) {
  if (settings.maintenance_mode !== '1') return false;
  if (req && getAdminIdFromRequest(req)) return false;
  return true;
}

async function getStoreBootstrap(req) {
  const adminPreview = req && getAdminIdFromRequest(req);
  if (cache && Date.now() - cacheAt < TTL_MS && !adminPreview) return cache;

  const [
    settings,
    categories,
    banners,
    bestSelling,
    newArrivals,
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
    getBestSellingProducts(query, 24),
    getNewArrivalProducts(query, 24),
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
    maintenance: maintenanceActiveForRequest(req, settings),
    settings,
    categories,
    banners,
    bestSelling,
    newArrivals,
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
  productCache.clear();
}

const PRODUCT_SELECT = `SELECT p.*, c.slug AS category_slug, c.name_bn AS category_name
     FROM products p JOIN categories c ON c.id = p.category_id`;

function cacheProduct(product) {
  if (!product?.id) return;
  productCache.set(product.id, { data: product, at: Date.now() });
}

async function getProductById(id) {
  const pid = Number(id);
  if (!pid) return null;
  const hit = productCache.get(pid);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const rows = await query(`${PRODUCT_SELECT} WHERE p.id = ? LIMIT 1`, [pid]);
  const product = rows[0] || null;
  if (product) cacheProduct(product);
  return product;
}

async function getProductBySlug(slug) {
  const s = String(slug || '').trim();
  if (!s) return null;
  for (const [, hit] of productCache) {
    if (hit.data?.slug === s && Date.now() - hit.at < TTL_MS) return hit.data;
  }
  const rows = await query(`${PRODUCT_SELECT} WHERE p.slug = ? LIMIT 1`, [s]);
  const product = rows[0] || null;
  if (product) cacheProduct(product);
  return product;
}

async function getProductByRef(ref) {
  const r = String(ref || '').trim();
  if (!r) return null;
  if (/^\d+$/.test(r)) return getProductById(Number(r));
  return getProductBySlug(decodeURIComponent(r));
}

module.exports = {
  getStoreBootstrap,
  clearStoreBootstrapCache,
  getProductById,
  getProductBySlug,
  getProductByRef,
};
