const express = require('express');
const { query } = require('../config/db');
const { formatPrice } = require('../lib/format');
const { getSiteSettings, deliveryConfig } = require('../lib/siteSettings');

const router = express.Router();

function getCart(req) {
  if (!req.session.cart) req.session.cart = [];
  return req.session.cart;
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
  const discount = req.session.couponDiscount || 0;
  const totals = await calcTotalsForRequest(req, cart, discount);
  return {
    ...totals,
    couponCode: req.session.couponCode || null,
    subtotalFormatted: formatPrice(totals.subtotal),
    deliveryFormatted: totals.delivery === 0 ? 'Free' : formatPrice(totals.delivery),
    discountFormatted: totals.discount ? formatPrice(totals.discount) : null,
    totalFormatted: formatPrice(totals.total),
  };
}

router.get('/categories', async (req, res) => {
  try {
    const categories = await query(
      `SELECT c.id, c.slug, c.name_bn, c.icon, c.sort_order,
              COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.name_bn ASC`
    );
    res.json({ ok: true, categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load categories' });
  }
});

router.get('/stats', async (req, res) => {
  try {
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
    const banners = await query(
      `SELECT id, title, position, link_url, image_url, bg_gradient FROM banners
       WHERE is_active=1 AND (expires_at IS NULL OR expires_at >= CURDATE())
       ORDER BY sort_order`
    );
    res.json({ ok: true, banners });
  } catch (err) {
    res.json({ ok: true, banners: [] });
  }
});

router.get('/products/:id/reviews', async (req, res) => {
  try {
    const reviews = await query(
      `SELECT customer_name, rating, comment, created_at FROM product_reviews
       WHERE product_id=? AND status='approved' ORDER BY created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({ ok: true, reviews });
  } catch (err) {
    res.json({ ok: true, reviews: [] });
  }
});

router.post('/products/:id/reviews', async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const rating = Math.min(5, Math.max(1, Number(req.body.rating) || 0));
    const comment = (req.body.comment || '').trim();
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

    await query(
      `INSERT INTO product_reviews (product_id, user_id, customer_name, rating, comment, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [productId, userId, customerName, rating, comment || null, status]
    );

    res.json({
      ok: true,
      status,
      message:
        status === 'pending'
          ? 'Thank you! Your review is awaiting approval.'
          : 'Thank you! Your review has been published.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not submit review' });
  }
});

router.post('/coupons/validate', async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    const rows = await query(
      `SELECT * FROM coupons WHERE code=? AND is_active=1
       AND (expires_at IS NULL OR expires_at >= CURDATE())`,
      [code.toUpperCase()]
    );
    if (!rows.length) return res.json({ ok: false, error: 'Invalid coupon' });
    const c = rows[0];
    if (Number(subtotal) < Number(c.min_order)) {
      return res.json({ ok: false, error: `Minimum order ৳${c.min_order}` });
    }
    if (c.usage_limit && c.used_count >= c.usage_limit) {
      return res.json({ ok: false, error: 'Coupon limit reached' });
    }
    let discount =
      c.discount_type === 'percent'
        ? (Number(subtotal) * Number(c.discount_value)) / 100
        : Number(c.discount_value);
    res.json({ ok: true, discount, code: c.code });
  } catch (err) {
    res.json({ ok: false, error: 'Could not validate coupon' });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const rows = await query('SELECT setting_key, setting_value FROM site_settings');
    const settings = {};
    rows.forEach((r) => {
      settings[r.setting_key] = r.setting_value;
    });
    if (settings.maintenance_mode === '1') {
      return res.json({ ok: true, settings, maintenance: true });
    }
    res.json({ ok: true, settings, maintenance: false });
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
    const { category, search, limit } = req.query;
    const isSearch = Boolean(search && String(search).trim());
    let sql = `
      SELECT p.*, c.slug AS category_slug, c.name_bn AS category_name
      FROM products p
      JOIN categories c ON c.id = p.category_id
    `;
    const params = [];
    const where = [];

    if (!isSearch && (!category || category === 'all')) {
      where.push('p.is_featured = 1');
    }
    if (category && category !== 'all') {
      where.push('c.slug = ?');
      params.push(category);
    }
    const excludeId = Number(req.query.exclude);
    if (excludeId) {
      where.push('p.id != ?');
      params.push(excludeId);
    }
    if (isSearch) {
      where.push('p.name_bn LIKE ?');
      params.push(`%${String(search).trim()}%`);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY p.name_bn ASC';
    const lim = Math.min(Math.max(Number(limit) || 0, 0), 20);
    if (lim) sql += ` LIMIT ${lim}`;

    const products = await query(sql, params);
    res.json({ ok: true, products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load products' });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const rows = await query(
      `SELECT p.*, c.slug AS category_slug, c.name_bn AS category_name
       FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Product not found' });
    res.json({ ok: true, product: rows[0] });
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
  res.json({
    ok: true,
    cart,
    count: cart.reduce((s, i) => s + i.qty, 0),
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
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const rows = await query(
      `SELECT * FROM coupons WHERE code=? AND is_active=1
       AND (expires_at IS NULL OR expires_at >= CURDATE())`,
      [String(code || '').toUpperCase()]
    );
    if (!rows.length) return res.json({ ok: false, error: 'Invalid coupon' });
    const c = rows[0];
    if (Number(subtotal) < Number(c.min_order)) {
      return res.json({ ok: false, error: `Minimum order ৳${c.min_order}` });
    }
    if (c.usage_limit && c.used_count >= c.usage_limit) {
      return res.json({ ok: false, error: 'Coupon limit reached' });
    }
    const discount =
      c.discount_type === 'percent'
        ? (Number(subtotal) * Number(c.discount_value)) / 100
        : Number(c.discount_value);
    req.session.couponCode = c.code;
    req.session.couponId = c.id;
    req.session.couponDiscount = discount;
    res.json({ ok: true, discount, code: c.code, totals: await cartTotalsResponse(cart, req) });
  } catch (err) {
    res.json({ ok: false, error: 'Could not apply coupon' });
  }
});

router.delete('/cart/coupon', async (req, res) => {
  delete req.session.couponCode;
  delete req.session.couponId;
  delete req.session.couponDiscount;
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
    const cart = getCart(req);
    const existing = cart.find((i) => i.productId === p.id);
    const addQty = Math.max(1, Math.min(99, Number(qty) || 1));

    if (existing) {
      existing.qty = Math.min(99, existing.qty + addQty);
    } else {
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
      });
    }

    res.json({
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
  res.json({ ok: true, cart, totals: await cartTotalsResponse(cart, req) });
});

router.delete('/cart/:productId', async (req, res) => {
  const cart = getCart(req);
  req.session.cart = cart.filter((i) => i.productId !== Number(req.params.productId));
  res.json({ ok: true, cart: req.session.cart, totals: await cartTotalsResponse(req.session.cart, req) });
});

router.post('/orders', async (req, res) => {
  try {
    const cart = getCart(req);
    if (!cart.length) return res.status(400).json({ ok: false, error: 'Cart is empty' });

    const { name, phone, address, paymentMethod, notes, email, district, postalCode } = req.body;

    if (!name || !phone || !address || !paymentMethod) {
      return res.status(400).json({ ok: false, error: 'Please enter name, phone and address' });
    }

    const orderDistrict = (district && String(district).trim()) || '—';
    const discount = req.session.couponDiscount || 0;
    const { subtotal, delivery, total } = await calcTotalsForRequest(req, cart, discount);
    const orderNumber = `RKS-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`;
    const couponNote = req.session.couponCode ? `Coupon: ${req.session.couponCode} (-৳${discount})` : '';
    const orderNotes = [notes, couponNote].filter(Boolean).join(' | ') || null;

    const userId = req.session.userId || null;

    const orderResult = await query(
      `INSERT INTO orders (user_id, order_number, customer_name, customer_phone, customer_email,
        address_line, district, postal_code, payment_method, subtotal, delivery_fee, total, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

    const orderId = orderResult.insertId;
    if (req.session.couponId) {
      await query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [req.session.couponId]);
      delete req.session.couponCode;
      delete req.session.couponId;
      delete req.session.couponDiscount;
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
    res.json({
      ok: true,
      orderNumber,
      subtotal,
      delivery,
      total,
      totalFormatted: formatPrice(total),
      subtotalFormatted: formatPrice(subtotal),
      deliveryFormatted: delivery === 0 ? 'Free' : formatPrice(delivery),
      items: orderItems,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not place order' });
  }
});

module.exports = router;
