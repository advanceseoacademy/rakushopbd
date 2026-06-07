const { getBestSellingProducts } = require('./homeProducts');

const REASON_LABELS = {
  cart: 'Based on items in your cart',
  wishlist: 'Inspired by your wishlist',
  orders: 'Based on your past orders',
  browsing: 'Based on products you viewed',
  categories: 'From categories you browsed',
  popular: 'Trending picks — browse more for personal recommendations',
};

function getCart(req) {
  if (!req.session.cart) req.session.cart = [];
  return req.session.cart;
}

function getWishlist(req) {
  if (!req.session.wishlist) req.session.wishlist = [];
  return req.session.wishlist;
}

function addCategoryScore(map, slug, points) {
  if (!slug) return;
  map.set(slug, (map.get(slug) || 0) + points);
}

function detectReason(signals) {
  if (signals.cartCount) return 'cart';
  if (signals.wishlistCount) return 'wishlist';
  if (signals.orderCount) return 'orders';
  if (signals.recentProductCount) return 'browsing';
  if (signals.recentCategoryCount) return 'categories';
  return 'popular';
}

async function getRecommendedProducts(dbQuery, req, options = {}) {
  const limit = Math.min(24, Math.max(4, Number(options.limit) || 12));
  const recentProductIds = (options.recentProductIds || [])
    .map((id) => Number(id))
    .filter(Boolean)
    .slice(0, 20);
  const recentCategorySlugs = (options.recentCategorySlugs || [])
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .slice(0, 8);

  const cart = getCart(req);
  const wishlist = getWishlist(req);
  const excludeIds = new Set();
  const categoryScores = new Map();

  cart.forEach((item) => {
    excludeIds.add(Number(item.productId));
    addCategoryScore(categoryScores, item.categorySlug, 6);
  });

  wishlist.forEach((item) => {
    excludeIds.add(Number(item.productId));
    addCategoryScore(categoryScores, item.categorySlug, 5);
  });

  recentCategorySlugs.forEach((slug, idx) => {
    addCategoryScore(categoryScores, slug, 4 + Math.max(0, 3 - idx));
  });

  let orderCount = 0;
  if (req.session?.userId) {
    try {
      const orderItems = await dbQuery(
        `SELECT oi.product_id, c.slug AS category_slug
         FROM order_items oi
         INNER JOIN orders o ON o.id = oi.order_id
         INNER JOIN products p ON p.id = oi.product_id
         INNER JOIN categories c ON c.id = p.category_id
         WHERE o.user_id = ? AND o.status != 'cancelled'
         ORDER BY o.created_at DESC
         LIMIT 40`,
        [req.session.userId]
      );
      orderCount = orderItems.length;
      orderItems.forEach((row, idx) => {
        excludeIds.add(Number(row.product_id ?? row.productId));
        addCategoryScore(categoryScores, row.category_slug ?? row.categorySlug, 7 - Math.min(idx, 4));
      });
    } catch (_) {}
  }

  if (recentProductIds.length) {
    try {
      const placeholders = recentProductIds.map(() => '?').join(',');
      const rows = await dbQuery(
        `SELECT p.id, c.slug AS category_slug
         FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE p.id IN (${placeholders})`,
        recentProductIds
      );
      const rank = new Map(recentProductIds.map((id, i) => [id, i]));
      rows.forEach((row) => {
        const id = Number(row.id);
        excludeIds.add(id);
        const pos = rank.get(id) ?? 0;
        addCategoryScore(categoryScores, row.category_slug ?? row.categorySlug, 5 - Math.min(pos, 3));
      });
    } catch (_) {}
  }

  const signals = {
    cartCount: cart.length,
    wishlistCount: wishlist.length,
    orderCount,
    recentProductCount: recentProductIds.length,
    recentCategoryCount: recentCategorySlugs.length,
  };
  const reason = detectReason(signals);
  const topCategories = [...categoryScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([slug]) => slug);

  let products = [];
  const excludeList = [...excludeIds].filter(Boolean);

  if (topCategories.length) {
    const catPh = topCategories.map(() => '?').join(',');
    let sql = `
      SELECT p.*, c.slug AS category_slug, c.name_bn AS category_name
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE c.slug IN (${catPh}) AND p.stock > 0`;
    const params = [...topCategories];
    if (excludeList.length) {
      sql += ` AND p.id NOT IN (${excludeList.map(() => '?').join(',')})`;
      params.push(...excludeList);
    }
    sql += ` ORDER BY p.is_featured DESC, p.rating DESC, p.review_count DESC, p.id DESC LIMIT ?`;
    params.push(limit * 2);
    products = await dbQuery(sql, params);
  }

  if (products.length < limit) {
    const best = await getBestSellingProducts(dbQuery, limit * 3);
    const seen = new Set(products.map((p) => p.id));
    for (const p of best) {
      const id = Number(p.id);
      if (!id || seen.has(id) || excludeIds.has(id)) continue;
      products.push(p);
      seen.add(id);
      if (products.length >= limit) break;
    }
  }

  return {
    products: products.slice(0, limit),
    reason,
    reasonLabel: REASON_LABELS[reason] || REASON_LABELS.popular,
    personalized: reason !== 'popular',
    topCategories,
  };
}

module.exports = { getRecommendedProducts, REASON_LABELS };
