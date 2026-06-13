require('dotenv').config();
// cPanel: .env file may still list old MySQL — Supabase must win
if (process.env.DATABASE_URL) {
  delete process.env.DB_HOST;
  delete process.env.DB_USER;
  delete process.env.DB_PASSWORD;
  delete process.env.DB_NAME;
  delete process.env.DB_DRIVER;
}

const path = require('path');
const compression = require('compression');
const express = require('express');
const cookieSession = require('cookie-session');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const { renderMaintenanceIfNeeded } = require('./lib/maintenanceGate');
const { getStoreBootstrap, getProductByRef } = require('./lib/storeBootstrap');
const { isNumericProductRef } = require('./lib/productUrl');
const { registerAdminAuth } = require('./lib/registerAdminAuth');
const { usePostgres, query } = require('./config/db');
const { ensureAppointmentsTable } = require('./lib/ensureAppointmentsTable');
const { ensureProductSeoColumns } = require('./lib/ensureProductSeoColumns');
const { ensureTodaySellingColumn } = require('./lib/ensureTodaySellingColumn');
const { ensureProductBuyPrice } = require('./lib/ensureProductBuyPrice');
const { ensureProductImagesTable } = require('./lib/ensureProductImagesTable');
const { ensureFooterSettings } = require('./lib/ensureFooterSettings');
const { ensureContactMessagesTable } = require('./lib/ensureContactMessagesTable');
const { ensurePhoneSubscribersTable } = require('./lib/ensurePhoneSubscribersTable');
const { ensureMarketingSettings } = require('./lib/ensureMarketingSettings');
const { ensureRewardsSettings } = require('./lib/ensureRewardsSettings');
const { ensureMessengerChats } = require('./lib/ensureMessengerChats');
const { ensureFaqsTable } = require('./lib/ensureFaqsTable');
const { ensureFaceAnalyzerSetting } = require('./lib/ensureFaceAnalyzerSetting');
const { ensureSeoSettings } = require('./lib/ensureSeoSettings');
const { ensureTrackingSettings } = require('./lib/ensureTrackingSettings');
const { ensureLegalPages } = require('./lib/ensureLegalPages');
const { ensureCategoryParent } = require('./lib/ensureCategoryParent');
const { ensureCategoryIconUrl } = require('./lib/ensureCategoryIconUrl');
const { buildTrackingScripts } = require('./lib/trackingScripts');
const { buildPageSeo, buildSitemapXml, robotsTxt, getSiteBaseUrl, getCategoryBySlug } = require('./lib/seo');
const { getSiteSettings } = require('./lib/siteSettings');
const faceAnalyzerRoutes = require('./routes/faceAnalyzer');

const app = express();
const PORT = process.env.PORT || 3000;
const { legacyUploadWebpFallback } = require('./lib/legacyUploadWebp');
const isProduction = process.env.NODE_ENV === 'production';

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason);
});

function warmBootstrapCache() {
  const timeoutMs = 45000;
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`bootstrap warm timeout (${timeoutMs}ms)`)), timeoutMs);
  });
  return Promise.race([getStoreBootstrap(null), timeout])
    .then(() => console.log('store bootstrap cache warmed'))
    .catch((err) => console.warn('bootstrap warm:', err.message));
}

// cPanel / reverse proxy: HTTPS terminates in front of Node
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicDir = path.join(__dirname, 'public');

// SEO — before static files so /robots.txt and /sitemap.xml are always dynamic
app.get('/robots.txt', async (req, res) => {
  try {
    const settings = await getSiteSettings(query);
    const base = getSiteBaseUrl(req, settings);
    res.type('text/plain').send(robotsTxt(base));
  } catch (_) {
    res.type('text/plain').send(robotsTxt(getSiteBaseUrl(req, {})));
  }
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const xml = await buildSitemapXml(req);
    res.type('application/xml').send(xml);
  } catch (err) {
    console.error('sitemap', err);
    res.status(500).type('text/plain').send('Sitemap unavailable');
  }
});

const staticCache = (maxAge) => ({
  maxAge: isProduction ? maxAge : 0,
  etag: true,
  immutable: Boolean(isProduction && maxAge),
});
app.use('/js', express.static(path.join(publicDir, 'js'), staticCache('365d')));
app.use('/css', express.static(path.join(publicDir, 'css'), staticCache('365d')));
app.use('/images', express.static(path.join(publicDir, 'images'), staticCache('30d')));
app.use('/uploads', legacyUploadWebpFallback);
app.use('/uploads', express.static(path.join(publicDir, 'uploads'), staticCache('7d')));
app.use(express.static(publicDir, staticCache(0)));

const sessionMaxAge = 7 * 24 * 60 * 60 * 1000;
const sessionSecret = process.env.SESSION_SECRET || 'rakushopbd-dev-secret-change-me';

// Signed cookie session — survives page reload & cPanel multi-worker (no shared memory/DB store)
app.use(
  cookieSession({
    name: 'rakushopbd.sid',
    keys: [sessionSecret],
    maxAge: sessionMaxAge,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.COOKIE_SECURE === 'true',
  })
);

// Public utility pages — registered before maintenance gate (always reachable)

app.use(renderMaintenanceIfNeeded);

// Admin auth on app (live cPanel: always reachable after restart)
registerAdminAuth(app);

/** Always fast — used by reverse proxy / uptime checks (prevents 503 during warm-up). */
app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, uptime: Math.round(process.uptime()) });
});

/** Live diagnostic (works after git pull + restart) */
app.get('/api/db-check', async (req, res) => {
  const { getPool, usePostgres, query } = require('./config/db');
  const info = {
    ok: false,
    build: 'supabase-v2',
    usePostgres: usePostgres(),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    nodeEnv: process.env.NODE_ENV || null,
  };
  try {
    require.resolve('pg');
    info.hasPgModule = true;
  } catch {
    info.hasPgModule = false;
    info.hint = 'cPanel → Run NPM Install (pg package missing)';
  }
  try {
    await getPool().query('SELECT 1');
    info.connected = true;
    const [row] = await query('SELECT COUNT(*) AS adminCount FROM admins');
    const [prow] = await query('SELECT COUNT(*) AS productCount FROM products');
    info.adminCount = Number(row.adminCount ?? row.admincount) || 0;
    info.productCount = Number(prow.productCount ?? prow.productcount) || 0;
    info.ok = true;
    res.json(info);
  } catch (err) {
    info.connected = false;
    info.errorCode = err.code || 'UNKNOWN';
    info.errorMessage = err.message;
    info.hint =
      err.code === 'MODULE_NOT_FOUND'
        ? 'Run NPM Install on cPanel'
        : 'Check DATABASE_URL password matches Supabase; then STOP → START';
    res.status(503).json(info);
  }
});

async function renderStorefront(req, res) {
  try {
    const productMatch = req.path.match(/^\/product\/([^/]+)$/);
    const productRef = productMatch ? decodeURIComponent(productMatch[1]) : null;
    const categoryMatch = req.path.match(/^\/category\/([^/]+)$/);
    const categorySlug = categoryMatch ? decodeURIComponent(categoryMatch[1]) : null;

    const bootstrap = await getStoreBootstrap(req, { lite: true });
    let product = null;
    let category = null;

    if (productRef) {
      try {
        product = await getProductByRef(productRef);
      } catch (err) {
        console.warn('renderStorefront product lookup failed', err.message);
      }
    }

    if (categorySlug) {
      try {
        category = await getCategoryBySlug(categorySlug, bootstrap?.settings || {});
      } catch (err) {
        console.warn('renderStorefront category lookup failed', err.message);
      }
    }

    if (product && productRef && isNumericProductRef(productRef) && product.slug) {
      return res.redirect(301, `/product/${encodeURIComponent(product.slug)}`);
    }
    const seo = await buildPageSeo(req, { bootstrap, product, category });
    const trackingScripts = buildTrackingScripts(bootstrap.settings || {});
    const bootstrapJson = JSON.stringify(bootstrap).replace(/</g, '\\u003c');
    const productJson = product
      ? JSON.stringify({ ok: true, product }).replace(/</g, '\\u003c')
      : null;
    const seoJson = JSON.stringify(seo).replace(/</g, '\\u003c');
    res.render('index', { bootstrapJson, productJson, seoJson, seo, trackingScripts });
  } catch (err) {
    console.error('renderStorefront', err);
    res.render('index', { bootstrapJson: null, productJson: null, seoJson: null, seo: null, trackingScripts: null });
  }
}

app.get('/', (req, res) => renderStorefront(req, res));

app.get('/admin', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  try {
    await ensureRewardsSettings();
    const { parseRewardsContent } = require('./lib/rewardsPage');
    const { query } = require('./config/db');
    const rows = await query(
      'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
      ['rewards_page_content']
    );
    const rewardsContent = parseRewardsContent({
      rewards_page_content: rows[0]?.setting_value,
    });
    res.render('admin', { rewardsContent });
  } catch (err) {
    console.warn('admin render:', err.message);
    const { getDefaultRewardsContent } = require('./lib/rewardsPage');
    res.render('admin', { rewardsContent: getDefaultRewardsContent() });
  }
});

app.use('/api', apiRoutes);
app.use('/api/face-analyzer', faceAnalyzerRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Storefront SPA — clean URLs (no hash)
app.get(
  ['/account', '/cart', '/checkout', '/wishlist', '/success', '/appointment', '/faq', '/rewards', '/contact', '/track', '/privacy-policy', '/terms-and-conditions', '/return-policy', '/pre-order-policy'],
  (req, res) => renderStorefront(req, res)
);
app.get('/product/:ref', (req, res) => renderStorefront(req, res));
app.get('/category/:slug', (req, res) => renderStorefront(req, res));

app.use((req, res) => {
  // API 404 stays JSON/plain
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ ok: false, error: 'Not found' });
  }

  // Admin 404
  if (req.path.startsWith('/admin')) {
    return res.status(404).send('Page not found');
  }

  // Website 404 (cute page)
  if (req.method === 'GET') {
    // For clean URLs we do NOT render the SPA shell anymore—unknown paths should be 404
    getSiteSettings(query)
      .then((settings) => {
        const trackingScripts = buildTrackingScripts(settings);
        res.status(404).render('404', { pathName: req.originalUrl || req.path, trackingScripts });
      })
      .catch(() => {
        res.status(404).render('404', { pathName: req.originalUrl || req.path, trackingScripts: null });
      });
    return;
  }

  res.status(404).send('Page not found');
});

app.listen(PORT, () => {
  const db = usePostgres() ? 'Supabase (PostgreSQL)' : 'MySQL';
  console.log(`RakuShopBD running — http://localhost:${PORT} [${db}]`);
  void warmBootstrapCache();
  ensureCategoryParent()
    .then(() => console.log('categories.parent_id ready'))
    .catch((err) => console.warn('category parent_id:', err.message));
  ensureCategoryIconUrl()
    .then(() => console.log('categories.icon_url ready'))
    .catch((err) => console.warn('category icon_url:', err.message));
  ensureAppointmentsTable().catch((err) => console.warn('appointments table:', err.message));
  ensureProductSeoColumns().catch((err) => console.warn('product SEO columns:', err.message));
  ensureProductBuyPrice().catch((err) => console.warn('product buy_price column:', err.message));
  ensureTodaySellingColumn().catch((err) => console.warn('today_selling_slot column:', err.message));
  ensureFooterSettings().catch((err) => console.warn('footer settings:', err.message));
  ensureContactMessagesTable().catch((err) => console.warn('contact messages table:', err.message));
  ensurePhoneSubscribersTable().catch((err) => console.warn('phone subscribers table:', err.message));
  ensureMarketingSettings().catch((err) => console.warn('marketing settings:', err.message));
  ensureRewardsSettings().catch((err) => console.warn('rewards settings:', err.message));
  ensureMessengerChats().catch((err) => console.warn('messenger chats:', err.message));
  ensureFaqsTable().catch((err) => console.warn('faqs table:', err.message));
  ensureFaceAnalyzerSetting().catch((err) => console.warn('face analyzer setting:', err.message));
  ensureSeoSettings().catch((err) => console.warn('SEO settings:', err.message));
  ensureTrackingSettings().catch((err) => console.warn('Tracking settings:', err.message));
  ensureLegalPages().catch((err) => console.warn('Legal pages:', err.message));
});
