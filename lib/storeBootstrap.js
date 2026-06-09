const { query } = require('../config/db');
const { getSiteSettings } = require('./siteSettings');
const { getAdminIdFromRequest } = require('./adminToken');
const { sql: sqlDialect } = require('./db-dialect');
const { getHomeProductSections, clearHomeProductsCache } = require('./homeProducts');
const { attachGalleryToProduct } = require('./productImages');
const { stripInternalProductFields, stripInternalProductList } = require('./productPublic');
const { listPublicFaqs } = require('./faqs');
const { listActiveMessengerChats } = require('./ensureMessengerChats');
const { listCategoriesWithCounts } = require('./categoryHelpers');
const { SERVICE_TYPES, TIME_SLOTS } = require('./appointments');

let cache = null;
let cacheAt = 0;
const TTL_MS = 5 * 60 * 1000;
const productCache = new Map();

function maintenanceActiveForRequest(req, settings) {
  if (settings.maintenance_mode !== '1') return false;
  if (req && getAdminIdFromRequest(req)) return false;
  return true;
}

function cacheIsUsable(payload) {
  if (!payload?.ok) return false;
  if (payload.bestSelling?.length || payload.newArrivals?.length) return true;
  const count = Number(payload.stats?.productCount) || 0;
  // Empty store with no categories is valid; otherwise rebuild (VPS cold-start poison).
  return count === 0 && !(payload.categories?.length > 0);
}

async function loadHomeSectionsWithRetry(productCount) {
  if (productCount <= 0) return { bestSelling: [], newArrivals: [] };
  clearHomeProductsCache();
  let home = await getHomeProductSections(query, 24);
  if (!home.bestSelling.length && !home.newArrivals.length) {
    await new Promise((r) => setTimeout(r, 2000));
    clearHomeProductsCache();
    home = await getHomeProductSections(query, 24);
  }
  return home;
}

async function getStoreBootstrap(req) {
  const adminPreview = req && getAdminIdFromRequest(req);
  if (cache && Date.now() - cacheAt < TTL_MS && !adminPreview && cacheIsUsable(cache)) return cache;

  const [settings, categories, banners, statsRow, faqs, messengerChats] = await Promise.all([
    getSiteSettings(query),
    listCategoriesWithCounts(query).catch(() => []),
    query(
      `SELECT id, title, position, link_url, image_url, bg_gradient FROM banners
       WHERE is_active=1 AND ${sqlDialect.curDateOrLater()}
       ORDER BY sort_order`
    ).catch(() => []),
    query(
      `SELECT
         (SELECT COUNT(*) FROM products) AS product_count,
         (SELECT COUNT(*) FROM orders) AS order_count,
         (SELECT ROUND(AVG(rating), 1) FROM products) AS avg_rating`
    ).catch(() => []),
    listPublicFaqs(query),
    listActiveMessengerChats().catch(() => []),
  ]);

  const s = statsRow[0] || {};
  const statsOk = Boolean(statsRow?.length && statsRow[0]);
  const productCount = statsOk ? Number(s.product_count ?? s.productcount) || 0 : 0;

  let bestSelling = [];
  let newArrivals = [];
  if (!statsOk || productCount > 0) {
    ({ bestSelling, newArrivals } = await loadHomeSectionsWithRetry(statsOk ? productCount : 1));
  }

  const payload = {
    ok: true,
    maintenance: maintenanceActiveForRequest(req, settings),
    settings,
    categories,
    banners,
    bestSelling: stripInternalProductList(bestSelling),
    newArrivals: stripInternalProductList(newArrivals),
    stats: {
      productCount: statsOk
        ? productCount
        : Math.max(new Set([...bestSelling, ...newArrivals].map((p) => p.id)).size),
      orderCount: Number(s.order_count ?? s.ordercount) || 0,
      avgRating: Number(s.avg_rating ?? s.avgrating) || 4.8,
      districts: 64,
    },
    faqs,
    messengerChats: messengerChats || [],
    appointmentMeta: {
      serviceTypes: SERVICE_TYPES.filter((s) => s.value !== 'store_visit'),
      timeSlots: TIME_SLOTS,
    },
  };

  if (cacheIsUsable(payload) || (statsOk && productCount === 0)) {
    cache = payload;
    cacheAt = Date.now();
  }
  return payload;
}

function clearStoreBootstrapCache() {
  cache = null;
  cacheAt = 0;
  productCache.clear();
  try {
    const { clearHomeProductsCache } = require('./homeProducts');
    clearHomeProductsCache();
  } catch (_) {}
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
  if (hit && Date.now() - hit.at < TTL_MS) return stripInternalProductFields(hit.data);

  const rows = await query(`${PRODUCT_SELECT} WHERE p.id = ? LIMIT 1`, [pid]);
  let product = rows[0] || null;
  if (product) {
    product = await attachGalleryToProduct(product);
    cacheProduct(product);
    return stripInternalProductFields(product);
  }
  return null;
}

async function getProductBySlug(slug) {
  const s = String(slug || '').trim();
  if (!s) return null;
  for (const [, hit] of productCache) {
    if (hit.data?.slug === s && Date.now() - hit.at < TTL_MS) return stripInternalProductFields(hit.data);
  }
  const rows = await query(`${PRODUCT_SELECT} WHERE p.slug = ? LIMIT 1`, [s]);
  let product = rows[0] || null;
  if (product) {
    product = await attachGalleryToProduct(product);
    cacheProduct(product);
    return stripInternalProductFields(product);
  }
  return null;
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
