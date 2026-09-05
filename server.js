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
const fs = require('fs');
const compression = require('compression');
const express = require('express');
const cookieSession = require('cookie-session');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const { renderMaintenanceIfNeeded } = require('./lib/maintenanceGate');
const { getStoreBootstrap, getProductByRef, getProductById } = require('./lib/storeBootstrap');
const { buildHomePageSsr } = require('./lib/homePageSsr');
const { isNumericProductRef } = require('./lib/productUrl');
const { registerAdminAuth } = require('./lib/registerAdminAuth');
const { usePostgres, query } = require('./config/db');
const { ensureAppointmentsTable } = require('./lib/ensureAppointmentsTable');
const { ensureProductSeoColumns } = require('./lib/ensureProductSeoColumns');
const { ensureTodaySellingColumn } = require('./lib/ensureTodaySellingColumn');
const { ensureProductBuyPrice } = require('./lib/ensureProductBuyPrice');
const { ensureProductSyntheticReviewsColumn } = require('./lib/ensureProductSyntheticReviewsColumn');
const { ensureAdminRoleColumn } = require('./lib/ensureAdminRoleColumn');
const { ensureProductReviewAvatarColumn } = require('./lib/ensureProductReviewAvatarColumn');
const { ensureHomepageReviewsSeeded } = require('./lib/ensureHomepageReviewsSeeded');
const { ensureProductImagesTable } = require('./lib/ensureProductImagesTable');
const { ensureFooterSettings } = require('./lib/ensureFooterSettings');
const { ensureContactMessagesTable } = require('./lib/ensureContactMessagesTable');
const { ensurePhoneSubscribersTable } = require('./lib/ensurePhoneSubscribersTable');
const { ensureMarketingSettings } = require('./lib/ensureMarketingSettings');
const { ensureRewardPointsColumn } = require('./lib/ensureRewardPointsColumn');
const { ensureOrderAdminViewColumns } = require('./lib/ensureOrderAdminViewColumns');
const { ensureOrderStockCommittedColumn } = require('./lib/productStock');
const { ensureViewedByAdminColumns } = require('./lib/ensureViewedByAdminColumns');
const { ensureRewardPointEvents } = require('./lib/ensureRewardPointEvents');
const { ensureCouponFreeDeliveryType } = require('./lib/ensureCouponFreeDeliveryType');
const { ensureRewardPointSettings } = require('./lib/ensureRewardPointSettings');
const { ensureReviewVideos } = require('./lib/ensureReviewVideos');
const { ensureMessengerChats } = require('./lib/ensureMessengerChats');
const { ensureFaqsTable } = require('./lib/ensureFaqsTable');
const { ensureBlogPostsTable } = require('./lib/ensureBlogPostsTable');
const { ensureBlogSeoColumns } = require('./lib/ensureBlogSeoColumns');
const { ensureSeoSettings } = require('./lib/ensureSeoSettings');
const { ensureTrackingSettings } = require('./lib/ensureTrackingSettings');
const { ensureNotifyEmailSettings } = require('./lib/ensureNotifyEmailSettings');
const { ensureLegalPages } = require('./lib/ensureLegalPages');
const { ensureCategoryParent } = require('./lib/ensureCategoryParent');
const { ensureCategoryIconUrl } = require('./lib/ensureCategoryIconUrl');
const { buildTrackingScripts } = require('./lib/trackingScripts');
const { buildPageSeo, buildSitemapXml, robotsTxt, getSiteBaseUrl, absoluteUrl, getCategoryBySlug, resolvePageType } = require('./lib/seo');
const { buildProductPageVm } = require('./lib/productPageSsr');
const pageRenderCache = require('./lib/pageRenderCache');
const { initRedis, isRedisReady, redisConfigured } = require('./lib/redis');
const { cacheBackendLabel } = require('./lib/appCache');
const { getSiteSettings } = require('./lib/siteSettings');
const { imageVariantMiddleware } = require('./lib/imageVariantRoute');
const { buildImgAttributes } = require('./lib/imageDelivery');
const { expressStaticOptions, cacheControlPublic, applyStaticAssetCache, ONE_YEAR_SEC, ONE_MONTH_SEC } = require('./lib/httpCache');
const { isStorefrontSpaPath, STOREFRONT_SPA_EXACT_PATHS } = require('./lib/storefrontSpa');
const app = express();
const PORT = process.env.PORT || 3000;
const { legacyUploadWebpFallback } = require('./lib/legacyUploadWebp');

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

// Apex → www (rakushopbd.com → www.rakushopbd.com)
const { forceWwwRedirect } = require('./lib/forceWww');
app.use(forceWwwRedirect);

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

app.use('/fonts', express.static(path.join(publicDir, 'fonts'), expressStaticOptions(ONE_YEAR_SEC)));

function useMinifiedJs() {
  return process.env.NODE_ENV === 'production' && process.env.SERVE_UNMINIFIED_JS !== '1';
}

function useMinifiedCss() {
  return process.env.NODE_ENV === 'production' && process.env.SERVE_UNMINIFIED_CSS !== '1';
}

app.use('/js', (req, res, next) => {
  if (!useMinifiedJs()) return next();
  if (!req.path.endsWith('.js') || req.path.endsWith('.min.js')) return next();
  const minPath = path.join(publicDir, 'js', req.path.replace(/\.js$/, '.min.js'));
  if (!fs.existsSync(minPath)) return next();
  applyStaticAssetCache(res, ONE_YEAR_SEC);
  res.type('application/javascript');
  return res.sendFile(minPath);
});
app.use('/js', express.static(path.join(publicDir, 'js'), expressStaticOptions(ONE_YEAR_SEC)));
app.use('/css', (req, res, next) => {
  if (!useMinifiedCss()) return next();
  if (!req.path.endsWith('.css') || req.path.endsWith('.min.css')) return next();
  const minPath = path.join(publicDir, 'css', req.path.replace(/\.css$/, '.min.css'));
  if (!fs.existsSync(minPath)) return next();
  applyStaticAssetCache(res, ONE_YEAR_SEC);
  res.type('text/css');
  return res.sendFile(minPath);
});
app.use('/css', express.static(path.join(publicDir, 'css'), expressStaticOptions(ONE_YEAR_SEC)));
app.use('/images', express.static(path.join(publicDir, 'images'), expressStaticOptions(ONE_YEAR_SEC)));
app.get('/images/rakushopbd-logo.png', (_req, res) => {
  if (process.env.NODE_ENV === 'development') {
    res.set('Cache-Control', 'no-cache');
  } else {
    res.set('Cache-Control', cacheControlPublic(ONE_YEAR_SEC, { immutable: true }));
  }
  res.sendFile(path.join(publicDir, 'images', 'rakushopbd-logo.png'));
});
app.use('/media', imageVariantMiddleware);
app.use('/uploads', legacyUploadWebpFallback);
app.use('/uploads', express.static(path.join(publicDir, 'uploads'), expressStaticOptions(ONE_YEAR_SEC)));
app.use(express.static(publicDir, expressStaticOptions(ONE_MONTH_SEC)));

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
  res.json({
    ok: true,
    uptime: Math.round(process.uptime()),
    cache: cacheBackendLabel(),
    redis: isRedisReady(),
  });
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
    redisConfigured: redisConfigured(),
    redisConnected: isRedisReady(),
    cacheBackend: cacheBackendLabel(),
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
    const blogMatch = req.path.match(/^\/blog\/([^/]+)$/);
    const blogSlug = blogMatch ? decodeURIComponent(blogMatch[1]) : null;
    const pageType = resolvePageType(req);

    const bootstrap = await getStoreBootstrap(req, { lite: pageType !== 'home' });
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

    const initialPage = product
      ? 'product'
      : categorySlug && category
        ? 'category'
        : pageType === 'home'
          ? 'home'
          : pageType;

    let seo;
    let productVm = null;
    const cacheKey = product ? `ssr:product:${product.id}:${product.slug}` : null;
    const cached = cacheKey ? await pageRenderCache.get(cacheKey) : null;
    if (cached) {
      seo = cached.seo;
      productVm = cached.productVm;
    } else {
      seo = await buildPageSeo(req, { bootstrap, product, category });
      if (product) {
        productVm = buildProductPageVm(product, bootstrap?.settings || {});
        await pageRenderCache.set(cacheKey, { seo, productVm });
      }
    }

    if (pageType === 'product' || pageType === 'category' || pageType === 'home') {
      res.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
    } else if (['cart', 'checkout', 'account', 'wishlist', 'success'].includes(pageType)) {
      res.set('Cache-Control', 'private, no-store');
    } else {
      res.set('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=86400');
    }

    const trackingScripts = buildTrackingScripts(bootstrap.settings || {});
    let heroSideSlider = bootstrap?.heroSideSlider || null;
    let lcpHeroPreload = null;
    if (heroSideSlider?.slides?.length) {
      heroSideSlider = {
        ...heroSideSlider,
        slides: heroSideSlider.slides.map((slide) => ({
          ...slide,
          imageAttrs: buildImgAttributes(slide.image, {
            widths: [640, 960, 1280],
            sizes: '(max-width: 768px) 100vw, 1200px',
            srcWidth: 960,
          }),
        })),
      };
      const firstAttrs = heroSideSlider.slides[0]?.imageAttrs;
      if (firstAttrs?.src) {
        lcpHeroPreload = {
          href: firstAttrs.src,
          imagesrcset: firstAttrs.srcset || '',
          imagesizes: firstAttrs.sizes || '',
          type: String(firstAttrs.src).includes('.webp') ? 'image/webp' : '',
        };
      }
    }
    const bootstrapJson = JSON.stringify(bootstrap).replace(/</g, '\\u003c');
    const homeSsr = initialPage === 'home' && bootstrap?.ok ? buildHomePageSsr(bootstrap) : null;
    const productJson = product
      ? JSON.stringify({ ok: true, product }).replace(/</g, '\\u003c')
      : null;
    const seoJson = JSON.stringify(seo).replace(/</g, '\\u003c');
    res.render('index', {
      bootstrapJson,
      productJson,
      seoJson,
      seo,
      trackingScripts,
      heroSideSlider,
      lcpHeroPreload,
      homeSsr,
      initialPage,
      productVm,
      blogSlug,
    });
  } catch (err) {
    console.error('renderStorefront', err);
    res.render('index', {
      bootstrapJson: null,
      productJson: null,
      seoJson: null,
      seo: null,
      trackingScripts: null,
      heroSideSlider: null,
      lcpHeroPreload: null,
      homeSsr: null,
      initialPage: 'home',
      productVm: null,
    });
  }
}

app.get('/', (req, res) => renderStorefront(req, res));

const DR_HANCY_OFFER = {
  productId: 93,
  slug: 'dr-hancy-melasma-dark-spot-whitening-cream-melasma-care-available-on-japan-market',
  fallbackName: 'Dr. Hancy Melasma & Dark Spot Whitening Cream',
  shortName: 'Dr. Hancy Melasma Cream',
  fallbackPrice: 850,
  comparePrice: 1500,
  fallbackImage: '/uploads/1785381059287-IMG_3698.webp',
  offerEndsAt: '2026-09-07T23:59:59+06:00',
  gallery: [
    '/uploads/1785381059287-IMG_3698.webp',
    '/uploads/1785577877597-Dr-Hancy-White-Spot-Cream-Melasma.webp',
    '/uploads/1785577881261-Dr-Hancy-White-Spot-Cream-Melasma1.webp',
  ],
};

async function renderDrHancyOffer(req, res) {
  let dbProduct = null;
  try {
    dbProduct = await getProductById(DR_HANCY_OFFER.productId);
  } catch (err) {
    console.warn('offer dr-hancy product lookup failed', err.message);
  }

  const slug = dbProduct?.slug || DR_HANCY_OFFER.slug;
  const product = {
    id: dbProduct?.id || DR_HANCY_OFFER.productId,
    name: dbProduct?.name_bn || DR_HANCY_OFFER.fallbackName,
    slug,
    price: Number(dbProduct?.price) || DR_HANCY_OFFER.fallbackPrice,
    oldPrice:
      dbProduct?.old_price != null
        ? Number(dbProduct.old_price)
        : DR_HANCY_OFFER.comparePrice,
    shortName: DR_HANCY_OFFER.shortName,
    stock: dbProduct?.stock != null ? Number(dbProduct.stock) : 100,
    imageUrl: dbProduct?.image_url || DR_HANCY_OFFER.fallbackImage,
    inStock: dbProduct ? Number(dbProduct.stock) > 0 : true,
    productUrl: `/product/${slug}`,
  };

  const settings = await getSiteSettings(query).catch(() => ({}));
  const siteName = settings.site_name || 'RakuShopBD';
  const base = getSiteBaseUrl(req, settings);
  const canonical = absoluteUrl(base, '/offer/dr-hancy-melasma');
  const ogImage = absoluteUrl(base, product.imageUrl);
  const description =
    'Japan market-এ available Dr. Hancy Melasma & Dark Spot Whitening Cream — melasma, dark spot ও uneven tone-এর জন্য। RakuShopBD থেকে অর্ডার করুন, দ্রুত ডেলিভারি।';

  const seo = {
    title: `Dr. Hancy Melasma Cream — Special Offer | ${siteName}`,
    description: description.length > 160 ? `${description.slice(0, 157)}…` : description,
    keywords: 'Dr Hancy, melasma cream, dark spot cream, whitening cream, Japan skincare, RakuShopBD',
    robots: 'index, follow',
    canonical,
    ogType: 'product',
    ogSiteName: siteName,
    ogTitle: `Dr. Hancy Melasma & Dark Spot Whitening Cream — ৳${product.price}`,
    ogDescription: description,
    ogUrl: canonical,
    ogImage,
    ogImageAlt: product.name,
    twitterCard: 'summary_large_image',
    jsonLd: JSON.stringify([
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        image: ogImage,
        offers: {
          '@type': 'Offer',
          price: product.price,
          priceCurrency: 'BDT',
          availability: product.inStock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          url: canonical,
        },
      },
    ]),
  };

  const trackingScripts = buildTrackingScripts(settings);
  const contactPhone = String(settings.contact_phone || '+880 1339-411587').trim();
  res.render('offer-dr-hancy-melasma', {
    product,
    seo,
    trackingScripts,
    gallery: DR_HANCY_OFFER.gallery,
    offerEndsAt: DR_HANCY_OFFER.offerEndsAt,
    contactPhone,
    contactTel: contactPhone.replace(/[^\d+]/g, ''),
    deliveryFee: Number(settings.delivery_fee) || 60,
    deliveryFeeOutside: Number(settings.delivery_fee_outside) || 120,
  });
}

app.get('/offer/dr-hancy-melasma', (req, res) => {
  renderDrHancyOffer(req, res).catch((err) => {
    console.error('renderDrHancyOffer', err);
    res.status(500).send('Unable to load offer page');
  });
});

app.get('/admin', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.render('admin');
});

app.use('/api', apiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Storefront SPA — clean URLs (no hash); reload on /blog, /faq, etc. must serve the app shell
const STOREFRONT_SPA_PATH_LIST = [...STOREFRONT_SPA_EXACT_PATHS];
app.get(STOREFRONT_SPA_PATH_LIST, (req, res) => renderStorefront(req, res));
app.get('/product/:ref', (req, res) => renderStorefront(req, res));
app.get('/category/:slug', (req, res) => renderStorefront(req, res));
app.get('/blog/:slug', (req, res) => renderStorefront(req, res));

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api') || req.path.startsWith('/admin')) return next();
  if (path.extname(req.path)) return next();
  if (!isStorefrontSpaPath(req.path)) return next();
  return renderStorefront(req, res);
});

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

async function startServer() {
  if (useMinifiedJs()) {
    try {
      const { minifyAll } = require('./scripts/minify-js');
      const { processed, saved } = await minifyAll();
      if (processed) {
        console.log(`JS minify: ${processed} file(s) updated, saved ${Math.round(saved / 1024)}KB`);
      }
    } catch (err) {
      console.warn('JS minify:', err.message);
    }
  }

  if (useMinifiedCss()) {
    try {
      const { buildHomeCssBundle } = require('./scripts/build-home-css-bundle');
      buildHomeCssBundle();
      const { minifyAll } = require('./scripts/minify-css');
      const { processed, saved } = minifyAll();
      if (processed) {
        console.log(`CSS minify: ${processed} file(s) updated, saved ${Math.round(saved / 1024)}KB`);
      }
    } catch (err) {
      console.warn('CSS minify:', err.message);
    }
  }

  if (redisConfigured()) {
    const ok = await initRedis();
    if (ok) console.log('Redis connected — shared cache enabled');
    else console.warn('Redis configured but unavailable — using in-memory cache only');
  }

  app.listen(PORT, () => {
  const db = usePostgres() ? 'Supabase (PostgreSQL)' : 'MySQL';
  const cache = cacheBackendLabel();
  console.log(`RakuShopBD running — http://localhost:${PORT} [${db}, cache: ${cache}]`);
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
  ensureAdminRoleColumn().catch((err) => console.warn('admins.role column:', err.message));
  ensureProductSyntheticReviewsColumn().catch((err) =>
    console.warn('product allow_synthetic_reviews column:', err.message)
  );
  ensureProductReviewAvatarColumn().catch((err) =>
    console.warn('product_reviews reviewer_avatar_url column:', err.message)
  );
  ensureHomepageReviewsSeeded()
    .then(() => console.log('homepage reviews seeded in database'))
    .catch((err) => console.warn('homepage reviews seed:', err.message));
  ensureTodaySellingColumn().catch((err) => console.warn('today_selling_slot column:', err.message));
  ensureFooterSettings().catch((err) => console.warn('footer settings:', err.message));
  ensureContactMessagesTable().catch((err) => console.warn('contact messages table:', err.message));
  ensurePhoneSubscribersTable().catch((err) => console.warn('phone subscribers table:', err.message));
  ensureMarketingSettings().catch((err) => console.warn('marketing settings:', err.message));
  ensureRewardPointsColumn().catch((err) => console.warn('reward_points column:', err.message));
  ensureOrderAdminViewColumns().catch((err) => console.warn('orders viewed_by_admin column:', err.message));
  ensureOrderStockCommittedColumn().catch((err) =>
    console.warn('orders stock_committed column:', err.message)
  );
  ensureViewedByAdminColumns('product_reviews').catch((err) =>
    console.warn('product_reviews viewed_by_admin column:', err.message)
  );
  ensureRewardPointEvents().catch((err) => console.warn('reward point events:', err.message));
  ensureCouponFreeDeliveryType()
    .then(() => console.log('coupons free_delivery type ready'))
    .catch((err) => console.warn('coupons free_delivery type:', err.message));
  ensureRewardPointSettings().catch((err) => console.warn('reward point settings:', err.message));
  ensureReviewVideos().catch((err) => console.warn('review videos table:', err.message));
  ensureMessengerChats().catch((err) => console.warn('messenger chats:', err.message));
  ensureFaqsTable().catch((err) => console.warn('faqs table:', err.message));
  ensureBlogPostsTable()
    .then(async () => {
      const { repairPlaceholderBlogSlugs } = require('./lib/blogPosts');
      const result = await repairPlaceholderBlogSlugs(query);
      if (result?.repaired) console.log(`blog slugs repaired: ${result.repaired}`);
    })
    .catch((err) => console.warn('blog_posts table:', err.message));
  ensureBlogSeoColumns().catch((err) => console.warn('blog SEO columns:', err.message));
  ensureSeoSettings().catch((err) => console.warn('SEO settings:', err.message));
  ensureTrackingSettings().catch((err) => console.warn('Tracking settings:', err.message));
  ensureNotifyEmailSettings().catch((err) => console.warn('Notify email settings:', err.message));
  ensureLegalPages().catch((err) => console.warn('Legal pages:', err.message));
  });
}

startServer().catch((err) => {
  console.error('Server start failed:', err);
  process.exit(1);
});
