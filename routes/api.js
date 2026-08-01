const express = require('express');
const { query, getPool } = require('../config/db');
const { formatPrice } = require('../lib/format');
const { getSiteSettings, deliveryConfig } = require('../lib/siteSettings');
const { getStoreBootstrap } = require('../lib/storeBootstrap');
const { getHomeProductSections, getBestSellingProducts, getNewArrivalProducts } = require('../lib/homeProducts');
const { getTodaySellingProducts, getTodaySellingMeta } = require('../lib/todaySelling');
const { getTodayDealsProducts, getTodayDealsMeta } = require('../lib/todayDeals');
const { getRecommendedProducts } = require('../lib/productRecommendations');
const { attachMergedReviewStatsToProducts } = require('../lib/productReviews');
const { stripInternalProductFields, stripInternalProductList } = require('../lib/productPublic');
const { pointsFromCartItems, awardApprovedReviewPoints, getRewardPointConfig } = require('../lib/rewardPoints');
const {
  fireAdminEmail,
  notifyNewOrder,
  notifyContactMessage,
  notifyAppointment,
} = require('../lib/emailNotify');
const { upload } = require('../lib/upload');
const { optimizeAndSaveImage } = require('../lib/imageOptimize');
const { getAdminIdFromRequest } = require('../lib/adminToken');
const { registerAdminAuthApiRouter } = require('../lib/registerAdminAuth');
const { sql: sqlDialect, returningId, likeFragment } = require('../lib/db-dialect');
const { firstInsertId } = require('../config/db');
const { ensureAppointmentsTable } = require('../lib/ensureAppointmentsTable');
const { ensureContactMessagesTable } = require('../lib/ensureContactMessagesTable');
const { ensurePhoneSubscribersTable } = require('../lib/ensurePhoneSubscribersTable');
const { listActiveMessengerChats } = require('../lib/ensureMessengerChats');
const { ensureFaqsTable } = require('../lib/ensureFaqsTable');
const {
  listCategoriesWithCounts,
  resolveCategoryIdsBySlug,
  categoryInClause,
} = require('../lib/categoryHelpers');
const {
  SERVICE_TYPES,
  TIME_SLOTS,
  normalizePhone,
  generateReference,
  appointmentToPublic,
  serviceLabel,
} = require('../lib/appointments');

const router = express.Router();

// Live cPanel: runs before /api/admin router — login returns token even if server.js is old
registerAdminAuthApiRouter(router);

/** Safe DB diagnostic — https://rakushopbd.com/api/db-check */
router.get('/db-check', async (req, res) => {
  const info = {
    ok: false,
    dbHost: process.env.DB_HOST || 'localhost',
    dbName: process.env.DB_NAME || null,
    dbUser: process.env.DB_USER || null,
    hasPassword: Boolean(process.env.DB_PASSWORD),
    nodeEnv: process.env.NODE_ENV || null,
  };
  try {
    await getPool().query('SELECT 1 AS ok');
    info.connected = true;
    try {
      const [row] = await query('SELECT COUNT(*) AS adminCount FROM admins');
      info.adminCount = Number(row.adminCount) || 0;
      const [prow] = await query('SELECT COUNT(*) AS productCount FROM products');
      info.productCount = Number(prow.productCount) || 0;
      info.ok = true;
    } catch (tableErr) {
      info.connected = true;
      info.tableError = tableErr.code || tableErr.message;
      info.hint = 'Import database/rakushopbd-full-import.sql in phpMyAdmin';
    }
    res.json(info);
  } catch (err) {
    info.connected = false;
    info.errorCode = err.code || 'UNKNOWN';
    info.hint =
      err.code === 'ER_ACCESS_DENIED_ERROR'
        ? 'DB_USER or DB_PASSWORD wrong in cPanel Environment Variables'
        : err.code === 'ER_BAD_DB_ERROR'
          ? 'DB_NAME wrong or database does not exist'
          : 'Check MySQL user privileges and env vars, then STOP → START app';
    res.status(503).json(info);
  }
});

function getCart(req) {
  if (!req.session.cart) req.session.cart = [];
  return req.session.cart;
}

function persistCart(req, cart) {
  req.session.cart = Array.isArray(cart) ? cart : [];
  return req.session.cart;
}

/** Product already has a sale/discount — coupons must not stack. */
function isProductDiscounted(p) {
  if (!p) return false;
  const disc = Number(p.discount_percent ?? p.discountPercent) || 0;
  const oldP = Number(p.old_price ?? p.oldPrice) || 0;
  const price = Number(p.price) || 0;
  return disc > 0 || (oldP > 0 && oldP > price);
}

function eligibleCouponSubtotal(cart) {
  return (cart || []).reduce((sum, item) => {
    if (item.couponEligible === false) return sum;
    return sum + Number(item.price) * Number(item.qty || 0);
  }, 0);
}

function cartHasIneligibleCouponItems(cart) {
  return (cart || []).some((item) => item.couponEligible === false);
}

function computeCouponDiscountAmount(coupon, eligibleSubtotal) {
  const eligible = Math.max(0, Number(eligibleSubtotal) || 0);
  if (eligible <= 0) return 0;
  if (coupon.discount_type === 'percent') {
    return (eligible * Number(coupon.discount_value)) / 100;
  }
  return Math.min(Number(coupon.discount_value) || 0, eligible);
}

function clearSessionCoupon(req) {
  delete req.session.couponCode;
  delete req.session.couponId;
  delete req.session.couponDiscount;
}

async function refreshCartCouponEligibility(cart) {
  if (!Array.isArray(cart) || !cart.length) return cart;
  const ids = [...new Set(cart.map((item) => Number(item.productId)).filter(Boolean))];
  if (!ids.length) return cart;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await query(
    `SELECT id, price, old_price, discount_percent FROM products WHERE id IN (${placeholders})`,
    ids
  );
  const byId = new Map(rows.map((row) => [Number(row.id), row]));
  for (const item of cart) {
    const product = byId.get(Number(item.productId));
    if (product) {
      item.couponEligible = !isProductDiscounted(product);
      item.discountPercent = Number(product.discount_percent) || 0;
      item.oldPrice = product.old_price != null ? Number(product.old_price) : null;
    } else if (typeof item.couponEligible !== 'boolean') {
      item.couponEligible = true;
    }
  }
  return cart;
}

async function loadActiveCoupon(codeOrId, byId = false) {
  if (byId) {
    const rows = await query(
      `SELECT * FROM coupons WHERE id=? AND is_active=1 AND ${sqlDialect.curDateOrLater()}`,
      [codeOrId]
    );
    return rows[0] || null;
  }
  const rows = await query(
    `SELECT * FROM coupons WHERE code=? AND is_active=1 AND ${sqlDialect.curDateOrLater()}`,
    [String(codeOrId || '').trim().toUpperCase()]
  );
  return rows[0] || null;
}

/** Recompute or clear session coupon from eligible (non-sale) cart lines. */
async function recomputeSessionCoupon(req, cart) {
  const code = req.session.couponCode;
  const couponId = req.session.couponId;
  if (!code && !couponId) return;

  await refreshCartCouponEligibility(cart);
  persistCart(req, cart);

  const eligible = eligibleCouponSubtotal(cart);
  if (eligible <= 0) {
    clearSessionCoupon(req);
    return;
  }

  const coupon = couponId
    ? await loadActiveCoupon(couponId, true)
    : await loadActiveCoupon(code, false);
  if (!coupon) {
    clearSessionCoupon(req);
    return;
  }
  if (Number(eligible) < Number(coupon.min_order)) {
    clearSessionCoupon(req);
    return;
  }
  if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
    clearSessionCoupon(req);
    return;
  }

  req.session.couponCode = coupon.code;
  req.session.couponId = coupon.id;
  req.session.couponDiscount = computeCouponDiscountAmount(coupon, eligible);
}

function sendNoStoreJson(res, payload) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json(payload);
}

function getWishlist(req) {
  if (!req.session.wishlist) req.session.wishlist = [];
  return req.session.wishlist;
}

function wishlistPayload(list) {
  return {
    wishlist: list,
    count: list.length,
    ids: list.map((i) => i.productId),
  };
}

function productToWishlistItem(p) {
  return {
    productId: p.id,
    name: p.name_bn,
    category: p.category_name,
    categorySlug: p.category_slug,
    price: Number(p.price),
    icon: p.icon,
    iconColor: p.icon_color,
    bgColor: p.bg_color,
    imageUrl: p.image_url || null,
  };
}

function calcTotalsWithSettings(cart, settings, district, discount = 0) {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  if (!cart.length) return { subtotal: 0, delivery: 0, discount: 0, total: 0 };
  const { freeMin, fee } = deliveryConfig(settings, district);
  const delivery = subtotal >= freeMin ? 0 : fee;
  const disc = Math.min(Number(discount) || 0, subtotal + delivery);
  return { subtotal, delivery, discount: disc, total: Math.max(0, subtotal + delivery - disc), freeMin };
}

async function calcTotalsForRequest(req, cart, discount = 0) {
  const settings = await getSiteSettings(query);
  const district = req.session.checkoutDistrict || null;
  return calcTotalsWithSettings(cart, settings, district, discount);
}

async function cartTotalsResponse(cart, req) {
  if (req.session.couponCode || req.session.couponId) {
    await recomputeSessionCoupon(req, cart);
  }
  const discount = req.session.couponDiscount || 0;
  const totals = await calcTotalsForRequest(req, cart, discount);
  const eligible = eligibleCouponSubtotal(cart);
  const ineligible = cartHasIneligibleCouponItems(cart);
  const couponCode = req.session.couponCode || null;
  return {
    ...totals,
    couponCode,
    couponEligibleSubtotal: eligible,
    couponNote:
      couponCode && ineligible ? 'Applied only to non-discounted items' : null,
    subtotalFormatted: formatPrice(totals.subtotal),
    deliveryFormatted: totals.delivery === 0 ? 'Free' : formatPrice(totals.delivery),
    discountFormatted: totals.discount ? formatPrice(totals.discount) : null,
    totalFormatted: formatPrice(totals.total),
  };
}

router.get('/categories', async (req, res) => {
  try {
    cachePublic(res, 120);
    const categories = await listCategoriesWithCounts(query);
    res.json({ ok: true, categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load categories' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    cachePublic(res, 120);
    const [pc] = await query('SELECT COUNT(*) AS n FROM products');
    const [oc] = await query('SELECT COUNT(*) AS n FROM orders');
    const [ar] = await query('SELECT ROUND(AVG(rating), 1) AS avg_rating FROM products');
    res.json({
      ok: true,
      stats: {
        productCount: Number(pc.n) || 0,
        orderCount: Number(oc.n) || 0,
        avgRating: Number(ar.avg_rating) || 4.8,
        districts: 64,
      },
    });
  } catch (err) {
    res.json({
      ok: true,
      stats: { productCount: 0, orderCount: 0, avgRating: 4.8, districts: 64 },
    });
  }
});

router.get('/banners', async (req, res) => {
  try {
    cachePublic(res, 120);
    const banners = await query(
      `SELECT id, title, position, link_url, image_url, bg_gradient FROM banners
       WHERE is_active=1 AND ${sqlDialect.curDateOrLater()}
       ORDER BY sort_order`
    );
    res.json({ ok: true, banners });
  } catch (err) {
    res.json({ ok: true, banners: [] });
  }
});

router.get('/messenger-chats', async (req, res) => {
  try {
    const chats = await listActiveMessengerChats();
    cachePublic(res, 120);
    res.json({ ok: true, chats });
  } catch (err) {
    res.json({ ok: true, chats: [] });
  }
});

router.get('/products/:id/reviews', async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (!productId) return res.json({ ok: true, reviews: [], count: 0, avgRating: 0 });
    const { getProductReviewsPayload } = require('../lib/productReviews');
    const payload = await getProductReviewsPayload(query, productId);
    cachePublic(res, 60);
    res.json({ ok: true, ...payload });
  } catch (err) {
    res.json({ ok: true, reviews: [], count: 0, avgRating: 0 });
  }
});

router.post('/reviews/upload-image', async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ ok: false, error: 'Please log in to upload a review photo' });
  }
  upload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ ok: false, error: err.message || 'Invalid image upload' });
    }
    try {
      if (!req.file) return res.status(400).json({ ok: false, error: 'No image uploaded' });
      const saved = await optimizeAndSaveImage(req.file);
      res.json({ ok: true, url: saved.url });
    } catch (uploadErr) {
      console.error('review upload', uploadErr);
      res.status(500).json({ ok: false, error: 'Could not upload image' });
    }
  });
});

router.post('/products/:id/reviews', async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const rating = Math.min(5, Math.max(1, Number(req.body.rating) || 0));
    const comment = (req.body.comment || '').trim();
    const imageUrl = String(req.body.imageUrl || '').trim() || null;
    const avatarUrl = String(req.body.avatarUrl || '').trim() || null;
    let customerName = (req.body.customerName || '').trim();
    let userId = null;

    if (!rating) return res.status(400).json({ ok: false, error: 'Rating is required' });

    const products = await query('SELECT id FROM products WHERE id = ?', [productId]);
    if (!products.length) return res.status(404).json({ ok: false, error: 'Product not found' });

    if (req.session.userId) {
      const users = await query('SELECT full_name FROM users WHERE id = ?', [req.session.userId]);
      if (users.length) {
        customerName = users[0].full_name;
        userId = req.session.userId;
      }
    }
    if (!customerName) return res.status(400).json({ ok: false, error: 'Name is required' });

    const settings = await getSiteSettings(query);
    const status = settings.feature_review_approval === '1' ? 'pending' : 'approved';

    const result = await query(
      `INSERT INTO product_reviews (product_id, user_id, customer_name, rating, comment, image_url, reviewer_avatar_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, userId, customerName, rating, comment || null, imageUrl, avatarUrl, status]
    );

    const reviewId = firstInsertId(result);
    let pointsAwarded = 0;

    if (status === 'approved') {
      const { syncProductReviewStats } = require('../lib/productReviews');
      await syncProductReviewStats(query, productId);
      if (reviewId && userId) {
        const award = await awardApprovedReviewPoints(query, { id: reviewId, user_id: userId, image_url: imageUrl });
        pointsAwarded = award.awarded || 0;
      }
    }

    let publishedMsg = 'Thank you! Your review has been published.';
    if (status === 'approved' && userId && pointsAwarded > 0) {
      publishedMsg = `Thank you! Your review has been published. You earned ${pointsAwarded} reward points.`;
    }

    res.json({
      ok: true,
      status,
      pointsAwarded,
      message:
        status === 'pending'
          ? 'Thank you! Your review is awaiting approval. Points will be added after approval.'
          : publishedMsg,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not submit review' });
  }
});

router.post('/coupons/validate', async (req, res) => {
  try {
    const { code } = req.body;
    const normalizedCode = String(code || '')
      .trim()
      .toUpperCase();
    if (!normalizedCode) {
      return res.status(400).json({ ok: false, error: 'Coupon code is required' });
    }
    const cart = getCart(req);
    await refreshCartCouponEligibility(cart);
    persistCart(req, cart);
    const eligible = eligibleCouponSubtotal(cart);
    const c = await loadActiveCoupon(normalizedCode, false);
    if (!c) return res.json({ ok: false, error: 'Invalid coupon' });
    if (eligible <= 0) {
      return res.json({
        ok: false,
        error: 'This coupon cannot be used on already discounted products',
      });
    }
    if (Number(eligible) < Number(c.min_order)) {
      return res.json({ ok: false, error: `Minimum order ৳${c.min_order} on non-discounted items` });
    }
    if (c.usage_limit && c.used_count >= c.usage_limit) {
      return res.json({ ok: false, error: 'Coupon limit reached' });
    }
    const discount = computeCouponDiscountAmount(c, eligible);
    res.json({
      ok: true,
      discount,
      code: c.code,
      eligibleSubtotal: eligible,
      note: cartHasIneligibleCouponItems(cart)
        ? 'Applied only to non-discounted items'
        : null,
    });
  } catch (err) {
    res.json({ ok: false, error: 'Could not validate coupon' });
  }
});

function cachePublic(res, seconds) {
  if (process.env.NODE_ENV === 'production') {
    res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=60`);
  }
}

router.get('/reviews/home', async (req, res) => {
  try {
    const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 25));
    const { getHomepageReviews } = require('../lib/productReviews');
    const reviews = await getHomepageReviews(query, limit);
    cachePublic(res, 120);
    res.json({ ok: true, reviews });
  } catch (err) {
    console.error('reviews/home', err);
    res.json({ ok: true, reviews: [] });
  }
});

async function publicProductList(products, pool) {
  const list = stripInternalProductList(products);
  return attachMergedReviewStatsToProducts(query, list, pool ? { pool } : undefined);
}

router.get('/products/home-sections', async (req, res) => {
  try {
    const limit = Math.min(48, Math.max(4, Number(req.query.limit) || 24));
    const { bestSelling, newArrivals } = await getHomeProductSections(query, limit);
    const { getReviewProductPool } = require('../lib/productReviews');
    const pool = await getReviewProductPool(query);
    const [bestMerged, newMerged] = await Promise.all([
      publicProductList(bestSelling, pool),
      publicProductList(newArrivals, pool),
    ]);
    cachePublic(res, 300);
    res.json({
      ok: true,
      bestSelling: bestMerged,
      newArrivals: newMerged,
    });
  } catch (err) {
    console.error('home-sections', err);
    res.status(500).json({ ok: false, error: 'Could not load products' });
  }
});

router.get('/products/review-pool', async (req, res) => {
  try {
    const { getReviewProductPool } = require('../lib/productReviews');
    const products = await getReviewProductPool(query);
    const eligible = products.filter((p) => p.allow_synthetic_reviews !== 0 && p.allow_synthetic_reviews !== '0');
    cachePublic(res, 300);
    res.json({ ok: true, products: eligible.length ? eligible : products });
  } catch (err) {
    console.error('review-pool', err);
    res.status(500).json({ ok: false, error: 'Could not load review products' });
  }
});

router.get('/today-selling', async (req, res) => {
  try {
    cachePublic(res, 120);
    const settings = await getSiteSettings(query);
    const products = await getTodaySellingProducts(query, settings);
    res.json({
      ok: true,
      meta: getTodaySellingMeta(settings),
      products: await publicProductList(products),
    });
  } catch (err) {
    console.error('today-selling', err);
    res.json({ ok: true, meta: { enabled: true, title: 'Today Selling' }, products: [] });
  }
});

router.get('/today-deals', async (req, res) => {
  try {
    cachePublic(res, 120);
    const settings = await getSiteSettings(query);
    const products = await getTodayDealsProducts(query, settings);
    res.json({
      ok: true,
      meta: getTodayDealsMeta(settings),
      products: await publicProductList(products),
    });
  } catch (err) {
    console.error('today-deals', err);
    res.json({ ok: true, meta: { enabled: false, title: 'Today Deals', endsAt: null }, products: [] });
  }
});

router.get('/collections/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const limit = Math.min(200, Math.max(8, Number(req.query.limit) || 100));
    let products = [];

    if (slug === 'best-selling') {
      products = await getBestSellingProducts(query, limit);
    } else if (slug === 'new-arrivals') {
      products = await getNewArrivalProducts(query, limit);
    } else {
      return res.status(404).json({ ok: false, error: 'Unknown collection' });
    }

    cachePublic(res, 60);
    res.json({ ok: true, products: await publicProductList(products) });
  } catch (err) {
    console.error('collections', err);
    res.status(500).json({ ok: false, error: 'Could not load collection' });
  }
});

router.get('/bootstrap', async (req, res) => {
  try {
    const data = await getStoreBootstrap(req);
    cachePublic(res, 300);
    res.json(data);
  } catch (err) {
    console.error('bootstrap', err);
    res.status(500).json({ ok: false, error: 'Could not load store data' });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const settings = await getSiteSettings(query);
    cachePublic(res, 300);
    const maintenance = settings.maintenance_mode === '1' && !getAdminIdFromRequest(req);
    res.json({ ok: true, settings, maintenance });
  } catch (err) {
    res.json({
      ok: true,
      settings: {
        site_name: 'RakuShopBD',
        announcement_text: 'Special offer: 10% off on orders over ৳1000 — Code: RakuShopBD10',
        free_delivery_min: '500',
        delivery_fee: '60',
      },
      maintenance: false,
    });
  }
});

router.get('/products', async (req, res) => {
  try {
    const { category, search, limit, sort } = req.query;
    const sortMode = String(sort || '').trim();
    const listLimit = Math.min(200, Math.max(8, Number(limit) || 100));

    if (sortMode === 'best-selling') {
      const products = await publicProductList(await getBestSellingProducts(query, listLimit));
      cachePublic(res, 60);
      return res.json({ ok: true, products });
    }
    if (sortMode === 'new-arrivals') {
      const products = await publicProductList(await getNewArrivalProducts(query, listLimit));
      cachePublic(res, 60);
      return res.json({ ok: true, products });
    }

    const isSearch = Boolean(search && String(search).trim());
    let sql = `
      SELECT p.*, c.slug AS category_slug, c.name_bn AS category_name
      FROM products p
      JOIN categories c ON c.id = p.category_id
    `;
    const params = [];
    const where = [];

    const categorySlug = category ? String(category).trim() : '';
    const isAllProductsBrowse = categorySlug === 'all';

    if (!isSearch && !categorySlug) {
      where.push('p.is_featured = 1');
    }
    if (categorySlug && !isAllProductsBrowse) {
      const catIds = await resolveCategoryIdsBySlug(query, category);
      if (catIds.length) {
        const { clause, params: catParams } = categoryInClause(catIds);
        where.push(clause);
        params.push(...catParams);
      } else {
        where.push('1=0');
      }
    }
    const excludeId = Number(req.query.exclude);
    if (excludeId) {
      where.push('p.id != ?');
      params.push(excludeId);
    }
    if (isSearch) {
      const raw = String(search).trim();
      const tokens = raw
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 8);

      // Every search word must appear in the product title (name_bn).
      if (tokens.length) {
        const tokenClauses = tokens.map(() => `${likeFragment('p.name_bn')}`);
        where.push(`(${tokenClauses.join(' AND ')})`);
        tokens.forEach((tok) => {
          params.push(`%${tok}%`);
        });
      }
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY p.name_bn ASC';
    const isHomeFeatured = !isSearch && !categorySlug && !excludeId;
    const maxCap = isAllProductsBrowse ? 200 : 48;
    const lim = Math.min(
      Math.max(Number(limit) || (isHomeFeatured ? 24 : 0), 0),
      maxCap
    );
    if (lim) sql += ` LIMIT ${lim}`;

    const products = await publicProductList(await query(sql, params));
    cachePublic(res, 60);
    res.json({ ok: true, products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load products' });
  }
});

router.get('/products/recommended', async (req, res) => {
  try {
    const recentProductIds = String(req.query.recent || '')
      .split(',')
      .map((id) => Number(id))
      .filter(Boolean);
    const recentCategorySlugs = String(req.query.categories || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const limit = Math.min(24, Math.max(4, Number(req.query.limit) || 12));
    const data = await getRecommendedProducts(query, req, {
      recentProductIds,
      recentCategorySlugs,
      limit,
    });
    res.set('Cache-Control', 'private, no-store');
    res.json({ ok: true, ...data, products: await publicProductList(data.products) });
  } catch (err) {
    console.error('products/recommended', err);
    res.status(500).json({ ok: false, error: 'Could not load recommendations' });
  }
});

router.get('/products/:ref', async (req, res) => {
  try {
    const ref = String(req.params.ref || '').trim();
    const reserved = new Set(['recommended', 'home-sections', 'review-pool']);
    if (reserved.has(ref.toLowerCase())) {
      return res.status(404).json({ ok: false, error: 'Use /api/products/recommended' });
    }
    const byId = /^\d+$/.test(ref);
    const rows = await query(
      `SELECT p.*, c.slug AS category_slug, c.name_bn AS category_name
       FROM products p JOIN categories c ON c.id = p.category_id
       WHERE ${byId ? 'p.id = ?' : 'p.slug = ?'} LIMIT 1`,
      [byId ? Number(ref) : ref]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Product not found' });
    const { attachGalleryToProduct } = require('../lib/productImages');
    let product = stripInternalProductFields(await attachGalleryToProduct(rows[0]));
    try {
      const { getProductReviewsPayload } = require('../lib/productReviews');
      const { count, avgRating } = await getProductReviewsPayload(query, product.id);
      if (count > 0) {
        product.review_count = count;
        product.rating = avgRating || product.rating;
      }
    } catch (_) {}
    cachePublic(res, 120);
    res.json({ ok: true, product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

router.get('/wishlist', (req, res) => {
  const list = getWishlist(req);
  res.json({ ok: true, ...wishlistPayload(list) });
});

router.post('/wishlist/toggle', async (req, res) => {
  try {
    const productId = Number(req.body.productId);
    if (!productId) return res.status(400).json({ ok: false, error: 'Invalid product' });

    const rows = await query(
      `SELECT p.*, c.name_bn AS category_name, c.slug AS category_slug
       FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
      [productId]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Product not found' });

    const list = getWishlist(req);
    const idx = list.findIndex((i) => i.productId === productId);
    let added;

    if (idx >= 0) {
      list.splice(idx, 1);
      added = false;
    } else {
      list.push(productToWishlistItem(rows[0]));
      added = true;
    }

    res.json({ ok: true, added, ...wishlistPayload(list) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not update wishlist' });
  }
});

router.get('/cart', async (req, res) => {
  const cart = getCart(req);
  sendNoStoreJson(res, {
    ok: true,
    cart,
    count: cart.reduce((s, i) => s + i.qty, 0),
    checkoutDistrict: req.session.checkoutDistrict || null,
    totals: await cartTotalsResponse(cart, req),
  });
});

router.post('/cart/district', async (req, res) => {
  const district = (req.body.district || '').trim();
  req.session.checkoutDistrict = district || null;
  const cart = getCart(req);
  res.json({ ok: true, totals: await cartTotalsResponse(cart, req) });
});

router.post('/cart/coupon', async (req, res) => {
  try {
    const cart = getCart(req);
    if (!cart.length) return res.status(400).json({ ok: false, error: 'Cart is empty' });
    const { code } = req.body;
    await refreshCartCouponEligibility(cart);
    persistCart(req, cart);
    const eligible = eligibleCouponSubtotal(cart);
    const c = await loadActiveCoupon(code, false);
    if (!c) return res.json({ ok: false, error: 'Invalid coupon' });
    if (eligible <= 0) {
      return res.json({
        ok: false,
        error: 'This coupon cannot be used on already discounted products',
      });
    }
    if (Number(eligible) < Number(c.min_order)) {
      return res.json({
        ok: false,
        error: `Minimum order ৳${c.min_order} on non-discounted items`,
      });
    }
    if (c.usage_limit && c.used_count >= c.usage_limit) {
      return res.json({ ok: false, error: 'Coupon limit reached' });
    }
    const discount = computeCouponDiscountAmount(c, eligible);
    req.session.couponCode = c.code;
    req.session.couponId = c.id;
    req.session.couponDiscount = discount;
    const totals = await cartTotalsResponse(cart, req);
    res.json({
      ok: true,
      discount: totals.discount,
      code: c.code,
      totals,
      note: totals.couponNote,
    });
  } catch (err) {
    res.json({ ok: false, error: 'Could not apply coupon' });
  }
});

router.delete('/cart/coupon', async (req, res) => {
  clearSessionCoupon(req);
  const cart = getCart(req);
  res.json({ ok: true, totals: await cartTotalsResponse(cart, req) });
});

router.post('/cart/add', async (req, res) => {
  try {
    const { productId, qty = 1 } = req.body;
    const rows = await query(
      `SELECT p.*, c.name_bn AS category_name, c.slug AS category_slug
       FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
      [productId]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Product not found' });

    const p = rows[0];
    if (Number(p.stock) <= 0) {
      return res.status(400).json({ ok: false, error: 'This product is out of stock. Please pre-order instead.' });
    }
    const cart = getCart(req);
    const existing = cart.find((i) => i.productId === p.id);
    const addQty = Math.max(
      1,
      Math.min(
        Math.max(1, Math.min(99, Number(p.stock) || 99)),
        Math.max(1, Math.min(99, Number(qty) || 1))
      )
    );

    if (existing) {
      return res.json({
        ok: false,
        alreadyInCart: true,
        error: 'This product is already in your cart',
        cart,
        count: cart.reduce((s, i) => s + i.qty, 0),
        totals: await cartTotalsResponse(cart, req),
      });
    }

    cart.push({
        productId: p.id,
        name: p.name_bn,
        category: p.category_name,
        categorySlug: p.category_slug,
        price: Number(p.price),
        qty: addQty,
        icon: p.icon,
        iconColor: p.icon_color,
        bgColor: p.bg_color,
        imageUrl: p.image_url || null,
        couponEligible: !isProductDiscounted(p),
        discountPercent: Number(p.discount_percent) || 0,
        oldPrice: p.old_price != null ? Number(p.old_price) : null,
      });

    persistCart(req, cart);

    sendNoStoreJson(res, {
      ok: true,
      cart,
      count: cart.reduce((s, i) => s + i.qty, 0),
      totals: await cartTotalsResponse(cart, req),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not add to cart' });
  }
});

router.patch('/cart/:productId', async (req, res) => {
  const cart = getCart(req);
  const item = cart.find((i) => i.productId === Number(req.params.productId));
  if (!item) return res.status(404).json({ ok: false, error: 'Item not found' });

  const qty = Math.max(1, Math.min(99, Number(req.body.qty) || 1));
  item.qty = qty;
  persistCart(req, cart);
  sendNoStoreJson(res, {
    ok: true,
    cart,
    count: cart.reduce((s, i) => s + i.qty, 0),
    totals: await cartTotalsResponse(cart, req),
  });
});

router.delete('/cart/:productId', async (req, res) => {
  const cart = getCart(req);
  const next = cart.filter((i) => i.productId !== Number(req.params.productId));
  persistCart(req, next);
  sendNoStoreJson(res, {
    ok: true,
    cart: req.session.cart,
    count: req.session.cart.reduce((s, i) => s + i.qty, 0),
    totals: await cartTotalsResponse(req.session.cart, req),
  });
});

router.post('/orders', async (req, res) => {
  try {
    const cart = getCart(req);
    if (!cart.length) return res.status(400).json({ ok: false, error: 'Cart is empty' });

    const { name, phone, address, paymentMethod, notes, email, district, postalCode } = req.body;

    if (!name || !phone || !address || !paymentMethod) {
      return res.status(400).json({ ok: false, error: 'Please enter name, phone and address' });
    }

    const productIds = [...new Set(cart.map((item) => Number(item.productId)).filter(Boolean))];
    if (productIds.length) {
      const placeholders = productIds.map(() => '?').join(',');
      const stockRows = await query(
        `SELECT id, name_bn, stock FROM products WHERE id IN (${placeholders})`,
        productIds
      );
      const stockById = new Map(stockRows.map((row) => [Number(row.id), Number(row.stock) || 0]));
      for (const item of cart) {
        const stock = stockById.get(Number(item.productId));
        if (stock === undefined) {
          return res.status(400).json({
            ok: false,
            error: `${item.name} is no longer available.`,
          });
        }
        if (stock <= 0) {
          return res.status(400).json({
            ok: false,
            error: `${item.name} is out of stock.`,
          });
        }
        if (Number(item.qty) > stock) {
          return res.status(400).json({
            ok: false,
            error: `${item.name} only has ${stock} left in stock.`,
          });
        }
      }
    }

    const orderDistrict = (district && String(district).trim()) || '—';
    await recomputeSessionCoupon(req, cart);
    const discount = req.session.couponDiscount || 0;
    const { subtotal, delivery, total } = await calcTotalsForRequest(req, cart, discount);
    const orderNumber = `RKS-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`;
    const couponNote = req.session.couponCode ? `Coupon: ${req.session.couponCode} (-৳${discount})` : '';
    const orderNotes = [notes, couponNote].filter(Boolean).join(' | ') || null;

    const userId = req.session.userId || null;

    const orderResult = await query(
      `INSERT INTO orders (user_id, order_number, customer_name, customer_phone, customer_email,
        address_line, district, postal_code, payment_method, subtotal, delivery_fee, total, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)${returningId()}`,
      [
        userId,
        orderNumber,
        name,
        phone,
        email || null,
        address,
        orderDistrict,
        postalCode || null,
        paymentMethod,
        subtotal,
        delivery,
        total,
        orderNotes,
      ]
    );

    let orderId = firstInsertId(orderResult);
    if (!orderId) {
      const found = await query('SELECT id FROM orders WHERE order_number = ?', [orderNumber]);
      orderId = found[0]?.id;
    }
    if (req.session.couponId) {
      await query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [req.session.couponId]);
      clearSessionCoupon(req);
    }
    for (const item of cart) {
      await query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.productId, item.name, item.qty, item.price, item.price * item.qty]
      );
    }

    const orderItems = cart.map((item) => ({
      productId: item.productId,
      name: item.name,
      qty: item.qty,
      price: item.price,
      lineTotal: item.price * item.qty,
      icon: item.icon,
      iconColor: item.iconColor,
      bgColor: item.bgColor,
    }));

    req.session.cart = [];
    req.session.checkoutDistrict = null;
    const pointCfg = userId ? await getRewardPointConfig(query) : null;

    await fireAdminEmail(query, notifyNewOrder, {
      orderNumber,
      customerName: name,
      customerPhone: phone,
      customerEmail: email || null,
      address,
      district: orderDistrict,
      paymentMethod,
      subtotal,
      delivery,
      discount,
      total,
      notes: orderNotes,
      items: orderItems,
    });

    res.json({
      ok: true,
      cartCleared: true,
      orderNumber,
      subtotal,
      delivery,
      total,
      totalFormatted: formatPrice(total),
      subtotalFormatted: formatPrice(subtotal),
      deliveryFormatted: delivery === 0 ? 'Free' : formatPrice(delivery),
      items: orderItems,
      pointsPending:
        userId && pointCfg?.enabled ? pointsFromCartItems(cart, pointCfg) : 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not place order' });
  }
});

// Public order tracking by Order ID (order_number)
// Example: GET /api/orders/track?orderNumber=RKS-2026-12345678
router.get('/orders/track', async (req, res) => {
  try {
    const orderNumberRaw = String(req.query.orderNumber || '').trim();
    if (!orderNumberRaw) {
      return res.status(400).json({ ok: false, error: 'Order ID is required' });
    }
    const orderNumber = orderNumberRaw.toUpperCase();

    const rows = await query(
      `SELECT id, order_number, customer_name, district, status, payment_method, total, created_at
       FROM orders WHERE order_number = ? LIMIT 1`,
      [orderNumber]
    );
    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }
    const o = rows[0];
    const items = await query(
      `SELECT product_name, quantity, unit_price, line_total
       FROM order_items WHERE order_id = ? ORDER BY id ASC`,
      [o.id]
    );

    cachePublic(res, 30);
    res.json({
      ok: true,
      order: {
        orderNumber: o.order_number,
        customerName: o.customer_name,
        district: o.district,
        status: o.status,
        paymentMethod: o.payment_method,
        total: Number(o.total) || 0,
        totalFormatted: formatPrice(o.total),
        createdAt: o.created_at,
        items,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not track order' });
  }
});

router.get('/appointments/meta', async (req, res) => {
  try {
    await ensureAppointmentsTable();
    res.json({ ok: true, serviceTypes: SERVICE_TYPES, timeSlots: TIME_SLOTS });
  } catch (err) {
    console.error('appointments/meta', err);
    res.status(500).json({ ok: false, error: 'Could not load appointment options' });
  }
});

router.post('/appointments', async (req, res) => {
  try {
    await ensureAppointmentsTable();
    const { name, phone, email, date, time, serviceType, notes } = req.body || {};
    const customerName = String(name || '').trim();
    const customerPhone = normalizePhone(phone);
    const appointmentDate = String(date || '').trim();
    const appointmentTime = String(time || '').trim();
    const service = String(serviceType || 'consultation').trim();

    if (customerName.length < 2) {
      return res.status(400).json({ ok: false, error: 'Please enter your name' });
    }
    if (!/^01[3-9]\d{8}$/.test(customerPhone)) {
      return res.status(400).json({ ok: false, error: 'Enter a valid Bangladesh mobile number (01XXXXXXXXX)' });
    }
    if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
      return res.status(400).json({ ok: false, error: 'Please select a valid date' });
    }
    if (!TIME_SLOTS.includes(appointmentTime)) {
      return res.status(400).json({ ok: false, error: 'Please select a time slot' });
    }
    if (!SERVICE_TYPES.some((s) => s.value === service)) {
      return res.status(400).json({ ok: false, error: 'Please select a service type' });
    }

    const chosen = new Date(appointmentDate + 'T12:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minDay = new Date(today);
    minDay.setDate(minDay.getDate() + 1);
    const maxDay = new Date(today);
    maxDay.setDate(maxDay.getDate() + 30);
    if (chosen < minDay || chosen > maxDay) {
      return res.status(400).json({ ok: false, error: 'Choose a date between tomorrow and 30 days ahead' });
    }

    const dayOfWeek = chosen.getDay();
    if (dayOfWeek === 5) {
      return res.status(400).json({ ok: false, error: 'Appointments are not available on Fridays' });
    }

    const dup = await query(
      `SELECT id FROM appointments
       WHERE appointment_date = ? AND appointment_time = ?
         AND status NOT IN ('cancelled') LIMIT 1`,
      [appointmentDate, appointmentTime]
    );
    if (dup.length) {
      return res.status(409).json({
        ok: false,
        error: 'This date and time slot is already booked. Please choose another slot.',
      });
    }

    const referenceNumber = generateReference();
    const result = await query(
      `INSERT INTO appointments (
         reference_number, customer_name, customer_phone, customer_email,
         appointment_date, appointment_time, service_type, notes, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')${returningId()}`,
      [
        referenceNumber,
        customerName,
        customerPhone,
        email ? String(email).trim().slice(0, 120) : null,
        appointmentDate,
        appointmentTime,
        service,
        notes ? String(notes).trim().slice(0, 500) : null,
      ]
    );

    await fireAdminEmail(query, notifyAppointment, {
      referenceNumber,
      customerName,
      customerPhone,
      customerEmail: email ? String(email).trim().slice(0, 120) : null,
      appointmentDate,
      appointmentTime,
      serviceType: service,
      serviceLabel: serviceLabel(service),
      notes: notes ? String(notes).trim().slice(0, 500) : null,
    });

    res.json({
      ok: true,
      referenceNumber,
      message: 'Your appointment has been booked. We will confirm by phone or SMS.',
      appointment: {
        referenceNumber,
        customerName,
        customerPhone,
        appointmentDate,
        appointmentTime,
        serviceType: service,
        serviceLabel: serviceLabel(service),
        status: 'pending',
      },
    });
  } catch (err) {
    console.error('appointments POST', err);
    res.status(500).json({ ok: false, error: 'Could not book appointment. Please try again.' });
  }
});

router.get('/appointments/lookup', async (req, res) => {
  try {
    await ensureAppointmentsTable();
    const ref = String(req.query.ref || req.query.reference || '').trim();
    const phone = normalizePhone(req.query.phone);
    if (!ref || !phone) {
      return res.status(400).json({ ok: false, error: 'Enter reference number and phone' });
    }
    const rows = await query(
      `SELECT * FROM appointments WHERE reference_number = ? AND customer_phone = ? LIMIT 1`,
      [ref, phone]
    );
    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'No appointment found with these details' });
    }
    const a = appointmentToPublic(rows[0]);
    a.serviceLabel = serviceLabel(a.serviceType);
    res.json({ ok: true, appointment: a });
  } catch (err) {
    console.error('appointments lookup', err);
    res.status(500).json({ ok: false, error: 'Could not look up appointment' });
  }
});

router.get('/faqs', async (req, res) => {
  try {
    await ensureFaqsTable();
    const { faqToPublic } = require('../lib/faqs');
    const rows = await query(
      'SELECT id, question, answer, sort_order FROM faqs WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    );
    cachePublic(res, 120);
    res.json({ ok: true, faqs: rows.map(faqToPublic) });
  } catch (err) {
    console.error('faqs GET', err);
    res.status(500).json({ ok: false, error: 'Could not load FAQs' });
  }
});

router.get('/blog/posts', async (req, res) => {
  try {
    const { ensureBlogPostsTable } = require('../lib/ensureBlogPostsTable');
    const { ensureBlogSeoColumns } = require('../lib/ensureBlogSeoColumns');
    const { blogPostToPublic } = require('../lib/blogPosts');
    await ensureBlogPostsTable();
    await ensureBlogSeoColumns();
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * limit;
    const countRows = await query("SELECT COUNT(*) AS total FROM blog_posts WHERE status = 'published'");
    const total = Number(countRows[0]?.total ?? Object.values(countRows[0] || {})[0]) || 0;
    const rows = await query(
      `SELECT id, title, slug, excerpt, featured_image_url, image_alt, seo_title, seo_description, status, published_at, created_at, updated_at
       FROM blog_posts WHERE status = 'published'
       ORDER BY published_at DESC, id DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    cachePublic(res, 60);
    res.json({
      ok: true,
      posts: rows.map((row) => blogPostToPublic(row, { includeContent: false })),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    console.error('blog posts GET', err);
    res.status(500).json({ ok: false, error: 'Could not load blog posts' });
  }
});

router.get('/blog/posts/:slug', async (req, res) => {
  try {
    const { ensureBlogPostsTable } = require('../lib/ensureBlogPostsTable');
    const { ensureBlogSeoColumns } = require('../lib/ensureBlogSeoColumns');
    const { blogPostToPublic } = require('../lib/blogPosts');
    await ensureBlogPostsTable();
    await ensureBlogSeoColumns();
    const slug = String(req.params.slug || '').trim();
    if (!slug) return res.status(400).json({ ok: false, error: 'Invalid slug' });
    const rows = await query(
      `SELECT * FROM blog_posts WHERE slug = ? AND status = 'published' LIMIT 1`,
      [slug]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Post not found' });
    cachePublic(res, 120);
    res.json({ ok: true, post: blogPostToPublic(rows[0]) });
  } catch (err) {
    console.error('blog post GET', err);
    res.status(500).json({ ok: false, error: 'Could not load blog post' });
  }
});

router.get('/legal-pages/:slug', async (req, res) => {
  try {
    const { getLegalPageFromSettings, LEGAL_SLUGS } = require('../lib/legalPages');
    const slug = String(req.params.slug || '').trim();
    if (!LEGAL_SLUGS.includes(slug)) {
      return res.status(404).json({ ok: false, error: 'Page not found' });
    }
    const { getSiteSettings } = require('../lib/siteSettings');
    const settings = await getSiteSettings(query);
    const page = getLegalPageFromSettings(slug, settings);
    cachePublic(res, 300);
    res.json({ ok: true, page });
  } catch (err) {
    console.error('legal-pages GET', err);
    res.status(500).json({ ok: false, error: 'Could not load page' });
  }
});

router.post('/contact', async (req, res) => {
  try {
    await ensureContactMessagesTable();
    const customerName = String(req.body.name || '').trim().slice(0, 120);
    const customerPhone = String(req.body.phone || '').replace(/\s/g, '').slice(0, 30);
    const email = req.body.email ? String(req.body.email).trim().slice(0, 120) : null;
    const subject = String(req.body.subject || '').trim().slice(0, 160);
    const message = String(req.body.message || '').trim().slice(0, 2000);

    if (!customerName) {
      return res.status(400).json({ ok: false, error: 'Please enter your name' });
    }
    if (!/^01[3-9]\d{8}$/.test(customerPhone)) {
      return res.status(400).json({ ok: false, error: 'Enter a valid Bangladesh mobile number (01XXXXXXXXX)' });
    }
    if (!subject) {
      return res.status(400).json({ ok: false, error: 'Please select a subject' });
    }
    if (message.length < 10) {
      return res.status(400).json({ ok: false, error: 'Please write a message (at least 10 characters)' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'Enter a valid email address' });
    }

    await query(
      `INSERT INTO contact_messages (
         customer_name, customer_phone, customer_email, subject, message, status
       ) VALUES (?, ?, ?, ?, ?, 'new')${returningId()}`,
      [customerName, customerPhone, email, subject, message]
    );

    await fireAdminEmail(query, notifyContactMessage, {
      customerName,
      customerPhone,
      customerEmail: email,
      subject,
      message,
    });

    res.json({
      ok: true,
      message: 'Thank you! Your message has been sent. We will contact you soon.',
    });
  } catch (err) {
    console.error('contact POST', err);
    res.status(500).json({ ok: false, error: 'Could not send message. Please try again.' });
  }
});

router.post('/marketing/subscribe', async (req, res) => {
  try {
    await ensurePhoneSubscribersTable();
    const customerPhone = String(req.body.phone || '').replace(/\s/g, '').slice(0, 30);
    if (!/^01[3-9]\d{8}$/.test(customerPhone)) {
      return res.status(400).json({ ok: false, error: 'Enter a valid Bangladesh mobile number (01XXXXXXXXX)' });
    }

    const existing = await query(
      'SELECT id FROM phone_subscribers WHERE customer_phone = ? LIMIT 1',
      [customerPhone]
    );
    if (existing.length) {
      return res.json({
        ok: true,
        alreadySubscribed: true,
        message: 'You are already subscribed. Thank you!',
      });
    }

    await query(
      `INSERT INTO phone_subscribers (customer_phone, source, status) VALUES (?, 'marketing', 'new')${returningId()}`,
      [customerPhone]
    );

    res.json({
      ok: true,
      message: 'Thank you! We will send you updates and surprise offers soon.',
    });
  } catch (err) {
    console.error('marketing subscribe POST', err);
    res.status(500).json({ ok: false, error: 'Could not subscribe. Please try again.' });
  }
});

module.exports = router;
