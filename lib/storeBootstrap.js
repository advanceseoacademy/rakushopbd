const { query } = require('../config/db');
const { getSiteSettings } = require('./siteSettings');
const { getAdminIdFromRequest } = require('./adminToken');
const { sql: sqlDialect } = require('./db-dialect');
const { getHomeProductSections, clearHomeProductsCache } = require('./homeProducts');
const { attachGalleryToProduct } = require('./productImages');
const {
  stripInternalProductFields,
  toCardProductList,
  slimStorefrontSettings,
} = require('./productPublic');
const { listPublicFaqs } = require('./faqs');
const { listActiveMessengerChats } = require('./ensureMessengerChats');
const { listCategoriesWithCounts } = require('./categoryHelpers');
const { SERVICE_TYPES, TIME_SLOTS } = require('./appointments');
const { getHeroSideSlider } = require('./heroSideSlider');
const { getTodayDealsProducts, getTodayDealsMeta } = require('./todayDeals');
const { withMarketingDefaults } = require('./marketingDefaults');
const { attachMergedReviewStatsToProducts, getReviewProductPool } = require('./productReviews');
const appCache = require('./appCache');

const TTL_SEC = 5 * 60;
const BOOTSTRAP_CACHE_KEY = 'bootstrap:full:v2';

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
  // Prefer cached sections — do not clear on every bootstrap rebuild.
  let home = await getHomeProductSections(query, 24);
  if (!home.bestSelling.length && !home.newArrivals.length) {
    await new Promise((r) => setTimeout(r, 2000));
    clearHomeProductsCache();
    home = await getHomeProductSections(query, 24);
  }
  return home;
}

async function getStoreBootstrap(req, opts = {}) {
  const lite = Boolean(opts.lite);
  const adminPreview = req && getAdminIdFromRequest(req);
  if (!lite && !adminPreview) {
    const cached = await appCache.getJson(BOOTSTRAP_CACHE_KEY);
    if (cached && cacheIsUsable(cached)) return cached;
  }

  const [settingsRaw, categories, banners, statsRow, faqs, messengerChats] = await Promise.all([
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

  const settingsFull = withMarketingDefaults({ ...settingsRaw });
  const settings = slimStorefrontSettings(settingsFull);

  const s = statsRow[0] || {};
  const statsOk = Boolean(statsRow?.length && statsRow[0]);
  const productCount = statsOk ? Number(s.product_count ?? s.productcount) || 0 : 0;

  let bestSelling = [];
  let newArrivals = [];
  if (!lite && (!statsOk || productCount > 0)) {
    ({ bestSelling, newArrivals } = await loadHomeSectionsWithRetry(statsOk ? productCount : 1));
  }

  const heroSideSlider = getHeroSideSlider(settingsFull);

  let todayDeals = [];
  try {
    todayDeals = await getTodayDealsProducts(query, settingsFull);
  } catch (err) {
    console.warn('today deals products:', err.message);
  }
  const todayDealsMeta = getTodayDealsMeta(settingsFull);

  try {
    const pool = await getReviewProductPool(query);
    if (bestSelling.length) {
      bestSelling = await attachMergedReviewStatsToProducts(query, bestSelling, { pool });
    }
    if (newArrivals.length) {
      newArrivals = await attachMergedReviewStatsToProducts(query, newArrivals, { pool });
    }
    if (todayDeals.length) {
      todayDeals = await attachMergedReviewStatsToProducts(query, todayDeals, { pool });
    }
  } catch (err) {
    console.warn('merge product review stats:', err.message);
  }

  const payload = {
    ok: true,
    maintenance: maintenanceActiveForRequest(req, settingsFull),
    settings,
    categories,
    banners,
    bestSelling: toCardProductList(bestSelling),
    newArrivals: toCardProductList(newArrivals),
    heroSideSlider,
    todayDeals: toCardProductList(todayDeals),
    todayDealsMeta,
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

  if (!lite && (cacheIsUsable(payload) || (statsOk && productCount === 0))) {
    await appCache.setJson(BOOTSTRAP_CACHE_KEY, payload, TTL_SEC);
  }
  return payload;
}

function clearStoreBootstrapCache() {
  void appCache.delByPrefix('bootstrap:');
  void appCache.delByPrefix('product:');
  clearHomeProductsCache();
  void require('./pageRenderCache').clearAll();
}

const PRODUCT_SELECT = `SELECT p.*, c.slug AS category_slug, c.name_bn AS category_name
     FROM products p JOIN categories c ON c.id = p.category_id`;

async function cacheProduct(product) {
  if (!product?.id) return;
  await appCache.setJson(`product:id:${product.id}`, product, TTL_SEC);
  if (product.slug) await appCache.setJson(`product:slug:${product.slug}`, product, TTL_SEC);
}

async function getProductById(id) {
  const pid = Number(id);
  if (!pid) return null;
  const hit = await appCache.getJson(`product:id:${pid}`);
  if (hit) return stripInternalProductFields(hit);

  const rows = await query(`${PRODUCT_SELECT} WHERE p.id = ? LIMIT 1`, [pid]);
  let product = rows[0] || null;
  if (product) {
    product = await attachGalleryToProduct(product);
    await cacheProduct(product);
    return stripInternalProductFields(product);
  }
  return null;
}

async function getProductBySlug(slug) {
  const s = String(slug || '').trim();
  if (!s) return null;
  const hit = await appCache.getJson(`product:slug:${s}`);
  if (hit) return stripInternalProductFields(hit);

  const rows = await query(`${PRODUCT_SELECT} WHERE p.slug = ? LIMIT 1`, [s]);
  let product = rows[0] || null;
  if (product) {
    product = await attachGalleryToProduct(product);
    await cacheProduct(product);
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
