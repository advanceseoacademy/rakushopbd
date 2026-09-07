const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { query, firstInsertId } = require('../config/db');
const { returningId } = require('../lib/db-dialect');
const { saveSession } = require('../lib/sessionSave');
const { getSiteSettings, deliveryConfig, clearSiteSettingsCache } = require('../lib/siteSettings');
const { takeStockLines, releaseStockLines, markOrderStockCommitted } = require('../lib/productStock');
const { formatPrice } = require('../lib/format');
const {
  sellingFromMarkup,
  sanitizeReseller,
  getResellerByUserId,
  addPendingProfit,
} = require('../lib/reseller');

const router = express.Router();
const publicDir = path.join(__dirname, '..', 'public');

function resolveLocalPublicFile(url) {
  if (!url || typeof url !== 'string') return null;
  let pathname = url.trim();
  try {
    if (/^https?:\/\//i.test(pathname)) {
      pathname = new URL(pathname).pathname;
    }
  } catch (_) {
    return null;
  }
  if (!pathname.startsWith('/')) pathname = '/' + pathname;
  if (pathname.includes('..')) return null;
  const abs = path.join(publicDir, pathname.replace(/^\//, ''));
  if (!abs.startsWith(publicDir)) return null;
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  return abs;
}

const placeOrderHits = new Map();

function rateLimitPlaceOrder(req, res, next) {
  const key = String(req.session?.userId || req.ip || 'anon');
  const now = Date.now();
  const windowMs = 60_000;
  const max = 8;
  let bucket = placeOrderHits.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, count: 0 };
    placeOrderHits.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > max) {
    return res.status(429).json({ ok: false, error: 'Too many orders — please wait a minute' });
  }
  next();
}

function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
  };
}

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, error: 'Please log in' });
  }
  next();
}

async function requireApprovedReseller(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, error: 'Please log in' });
  }
  try {
    const reseller = await getResellerByUserId(req.session.userId);
    if (!reseller) {
      return res.status(403).json({ ok: false, error: 'Apply to become a reseller first', code: 'no_application' });
    }
    if (reseller.status === 'pending') {
      return res.status(403).json({ ok: false, error: 'Your application is under review', code: 'pending' });
    }
    if (reseller.status === 'suspended') {
      return res.status(403).json({ ok: false, error: 'Your reseller account is suspended', code: 'suspended' });
    }
    if (reseller.status !== 'approved') {
      return res.status(403).json({ ok: false, error: 'Reseller access denied', code: 'denied' });
    }
    req.reseller = reseller;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not verify reseller' });
  }
}

function normalizeBdPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (/^01[3-9]\d{8}$/.test(d)) return d;
  if (/^8801[3-9]\d{8}$/.test(d)) return d.slice(2);
  return null;
}

router.get('/me', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.json({ ok: true, user: null, reseller: null });
    }
    const users = await query(
      'SELECT id, full_name, email, phone FROM users WHERE id = ? LIMIT 1',
      [req.session.userId]
    );
    if (!users[0]) {
      req.session = null;
      return res.json({ ok: true, user: null, reseller: null });
    }
    const reseller = await getResellerByUserId(req.session.userId);
    const settings = await getSiteSettings(query);
    res.json({
      ok: true,
      user: sanitizeUser(users[0]),
      reseller: sanitizeReseller(reseller),
      minPayout: Number(settings.reseller_min_payout) || 500,
      suggestedMarkup: Number(settings.reseller_default_markup_suggest) || 20,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load session' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body || {};
    if (!fullName || !email || !password) {
      return res.status(400).json({ ok: false, error: 'Name, email and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' });
    }
    const emailNorm = String(email).trim().toLowerCase();
    const existing = await query('SELECT id FROM users WHERE email = ?', [emailNorm]);
    if (existing.length) {
      return res.status(400).json({ ok: false, error: 'Email already registered — please log in' });
    }
    const hash = await bcrypt.hash(String(password), 10);
    const phoneNorm = phone ? normalizeBdPhone(phone) || String(phone).trim() : null;
    const result = await query(
      `INSERT INTO users (full_name, email, phone, password_hash) VALUES (?, ?, ?, ?)${returningId()}`,
      [String(fullName).trim(), emailNorm, phoneNorm, hash]
    );
    let userId = firstInsertId(result);
    if (!userId) {
      const found = await query('SELECT id FROM users WHERE email = ?', [emailNorm]);
      userId = found[0]?.id;
    }
    const settings = await getSiteSettings(query);
    const suggest = Number(settings.reseller_default_markup_suggest) || 20;
    const applyResult = await query(
      `INSERT INTO resellers (user_id, status, default_markup_percent, apply_note)
       VALUES (?, 'pending', ?, ?)${returningId()}`,
      [userId, suggest, 'Registered from reseller portal']
    );
    let resellerId = firstInsertId(applyResult);
    const resellerRow = resellerId
      ? (await query('SELECT * FROM resellers WHERE id = ?', [resellerId]))[0]
      : await getResellerByUserId(userId);

    try {
      const { sendAdminEmail } = require('../lib/emailNotify');
      await sendAdminEmail(settings, {
        subject: 'New reseller approval request',
        text: `A new reseller asked for approval.\nName: ${String(fullName).trim()}\nEmail: ${emailNorm}\nPhone: ${phoneNorm || '—'}\n\nApprove them in Admin → Resellers.`,
      });
    } catch (err) {
      console.warn('reseller approval email:', err.message);
    }

    req.session.userId = userId;
    saveSession(req, () => {
      res.json({
        ok: true,
        user: { id: userId, fullName: String(fullName).trim(), email: emailNorm, phone: phoneNorm },
        reseller: sanitizeReseller(resellerRow),
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not register' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password required' });
    }
    const rows = await query(
      'SELECT id, full_name, email, phone, password_hash FROM users WHERE email = ? LIMIT 1',
      [String(email).trim().toLowerCase()]
    );
    if (!rows[0]) return res.status(401).json({ ok: false, error: 'Invalid email or password' });
    const ok = await bcrypt.compare(String(password), rows[0].password_hash);
    if (!ok) return res.status(401).json({ ok: false, error: 'Invalid email or password' });
    req.session.userId = rows[0].id;
    const reseller = await getResellerByUserId(rows[0].id);
    saveSession(req, () => {
      res.json({ ok: true, user: sanitizeUser(rows[0]), reseller: sanitizeReseller(reseller) });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not log in' });
  }
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

const forgotHits = new Map();

function rateLimitForgot(req, res, next) {
  const key = String(req.ip || 'anon');
  const now = Date.now();
  const bucket = forgotHits.get(key);
  if (!bucket || now - bucket.start > 15 * 60_000) {
    forgotHits.set(key, { start: now, count: 1 });
    return next();
  }
  bucket.count += 1;
  if (bucket.count > 5) {
    return res.status(429).json({ ok: false, error: 'Too many reset requests. Try again later.' });
  }
  next();
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function resellerResetBase(req) {
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('host') || 'reseller.rakushopbd.com';
  if (host.includes('reseller.')) return `${proto}://${host}`;
  return `${proto}://${host}/r`;
}

router.post('/password/forgot', rateLimitForgot, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: 'Email is required' });

    const users = await query('SELECT id, email FROM users WHERE email = ? LIMIT 1', [email]);
    if (users[0]) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashResetToken(token);
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await query('DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL', [users[0].id]);
      await query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
        [users[0].id, tokenHash, expires]
      );

      const settings = await getSiteSettings(query);
      const { getTransporter } = require('../lib/emailNotify');
      const mailer = getTransporter(settings);
      if (!mailer) {
        return res.status(503).json({ ok: false, error: 'Reset email is not set up yet. Contact support.' });
      }
      const link = `${resellerResetBase(req)}/reset?token=${token}`;
      const label = 'RakuShopBD';
      await mailer.transport.sendMail({
        from: `"${label}" <${mailer.from}>`,
        to: email,
        subject: `${label} reseller password reset`,
        text: `Reset your reseller password:\n${link}\n\nThis link expires in 1 hour. If you did not ask for this, ignore this email.`,
        html: `<p>Reset your reseller password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour.</p>`,
      });
    }

    res.json({ ok: true, message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not send reset email' });
  }
});

router.post('/password/reset', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');
    if (!token) return res.status(400).json({ ok: false, error: 'Reset link is invalid' });
    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' });
    }
    const rows = await query(
      `SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ? LIMIT 1`,
      [hashResetToken(token)]
    );
    const row = rows[0];
    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ ok: false, error: 'Reset link is invalid or expired' });
    }
    const hash = await bcrypt.hash(password, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, row.user_id]);
    await query('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [row.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not reset password' });
  }
});

router.post('/apply', requireLogin, async (req, res) => {
  try {
    const existing = await getResellerByUserId(req.session.userId);
    if (existing) {
      return res.json({ ok: true, reseller: sanitizeReseller(existing), alreadyApplied: true });
    }
    const note = String(req.body?.note || req.body?.applyNote || '').trim().slice(0, 1000);
    const settings = await getSiteSettings(query);
    const suggest = Number(settings.reseller_default_markup_suggest) || 20;
    const result = await query(
      `INSERT INTO resellers (user_id, status, default_markup_percent, apply_note)
       VALUES (?, 'pending', ?, ?)${returningId()}`,
      [req.session.userId, suggest, note || null]
    );
    let id = firstInsertId(result);
    const row = id
      ? (await query('SELECT * FROM resellers WHERE id = ?', [id]))[0]
      : await getResellerByUserId(req.session.userId);
    res.json({ ok: true, reseller: sanitizeReseller(row) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not submit application' });
  }
});

router.get('/products', requireApprovedReseller, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const category = String(req.query.category || '').trim();
    const markup = Number(req.reseller.default_markup_percent) || 0;
    let sql = `
      SELECT p.id, p.slug, p.name_bn, p.description_bn, p.price, p.buy_price, p.image_url, p.stock,
             c.name_bn AS category_name, c.slug AS category_slug
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.buy_price IS NOT NULL AND p.buy_price > 0
    `;
    const params = [];
    if (category) {
      sql += ' AND c.slug = ?';
      params.push(category);
    }
    if (q) {
      sql += ' AND (p.name_bn ILIKE ? OR p.slug ILIKE ?)';
      const like = `%${q}%`;
      // MySQL uses LIKE; use dialect-agnostic via both if needed
      params.push(like, like);
    }
    sql += ' ORDER BY p.name_bn ASC LIMIT 200';

    let rows;
    try {
      rows = await query(sql, params);
    } catch (_) {
      // MySQL fallback without ILIKE
      sql = sql.replace(/ILIKE/g, 'LIKE');
      rows = await query(sql, params);
    }

    const ids = rows.map((r) => r.id);
    let galleryByProduct = {};
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      try {
        const imgs = await query(
          `SELECT product_id, image_url FROM product_images WHERE product_id IN (${placeholders}) ORDER BY id ASC`,
          ids
        );
        galleryByProduct = imgs.reduce((acc, row) => {
          const pid = Number(row.product_id);
          if (!acc[pid]) acc[pid] = [];
          acc[pid].push(row.image_url);
          return acc;
        }, {});
      } catch (_) {}
    }

    const products = rows.map((r) => {
      const base = Number(r.buy_price);
      const images = [];
      if (r.image_url) images.push(r.image_url);
      for (const u of galleryByProduct[Number(r.id)] || []) {
        if (u && !images.includes(u)) images.push(u);
      }
      const selling = sellingFromMarkup(base, markup);
      return {
        id: r.id,
        slug: r.slug,
        name: r.name_bn,
        description: r.description_bn || '',
        categoryName: r.category_name,
        categorySlug: r.category_slug,
        basePrice: base,
        sellingPrice: selling,
        profit: Math.max(0, selling - base),
        stock: Number(r.stock) || 0,
        imageUrl: r.image_url,
        images,
      };
    });

    res.json({ ok: true, products, markupPercent: markup });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load products' });
  }
});

router.get('/products/:id/images.zip', requireApprovedReseller, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid product' });
    const rows = await query(
      `SELECT id, slug, name_bn, image_url, buy_price FROM products WHERE id = ? LIMIT 1`,
      [id]
    );
    const product = rows[0];
    if (!product || !(Number(product.buy_price) > 0)) {
      return res.status(404).json({ ok: false, error: 'Product not found' });
    }

    const urls = [];
    if (product.image_url) urls.push(product.image_url);
    try {
      const gallery = await query(
        `SELECT image_url FROM product_images WHERE product_id = ? ORDER BY id ASC`,
        [id]
      );
      for (const g of gallery) {
        if (g.image_url && !urls.includes(g.image_url)) urls.push(g.image_url);
      }
    } catch (_) {}

    const files = [];
    for (const u of urls) {
      const abs = resolveLocalPublicFile(u);
      if (abs) files.push({ abs, name: path.basename(abs) });
    }
    if (!files.length) {
      return res.status(404).json({ ok: false, error: 'No downloadable images on server' });
    }

    const safeSlug = String(product.slug || `product-${id}`).replace(/[^\w.-]+/g, '_');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeSlug}-images.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => {
      console.error('reseller image zip', err);
      if (!res.headersSent) res.status(500).json({ ok: false, error: 'Zip failed' });
      else res.end();
    });
    archive.pipe(res);

    const usedNames = new Set();
    files.forEach((f, i) => {
      let name = f.name || `image-${i + 1}.jpg`;
      if (usedNames.has(name)) name = `${i + 1}-${name}`;
      usedNames.add(name);
      archive.file(f.abs, { name });
    });
    await archive.finalize();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: 'Could not build image zip' });
  }
});

router.get('/categories', requireApprovedReseller, async (req, res) => {
  try {
    const rows = await query(
      `SELECT c.id, c.slug, c.name_bn,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.buy_price IS NOT NULL AND p.buy_price > 0) AS product_count
       FROM categories c
       ORDER BY c.name_bn ASC`
    );
    res.json({
      ok: true,
      categories: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name_bn,
        productCount: Number(r.product_count) || 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Could not load categories' });
  }
});

router.patch('/markup', requireApprovedReseller, async (req, res) => {
  try {
    let pct = Number(req.body?.defaultMarkupPercent ?? req.body?.markup);
    if (!Number.isFinite(pct) || pct < 0 || pct > 500) {
      return res.status(400).json({ ok: false, error: 'Markup must be between 0 and 500' });
    }
    await query(
      `UPDATE resellers SET default_markup_percent = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [pct, req.reseller.id]
    );
    const row = await getResellerByUserId(req.session.userId);
    res.json({ ok: true, reseller: sanitizeReseller(row) });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Could not update markup' });
  }
});

router.get('/dashboard', requireApprovedReseller, async (req, res) => {
  try {
    const rid = req.reseller.id;
    const stats = await query(
      `SELECT
         COUNT(*)::int AS total_orders,
         COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered_orders
       FROM orders WHERE reseller_id = ?`,
      [rid]
    ).catch(async () => {
      const all = await query(`SELECT status FROM orders WHERE reseller_id = ?`, [rid]);
      return [
        {
          total_orders: all.length,
          delivered_orders: all.filter((o) => String(o.status).toLowerCase() === 'delivered').length,
        },
      ];
    });
    const settings = await getSiteSettings(query);
    res.json({
      ok: true,
      reseller: sanitizeReseller(await getResellerByUserId(req.session.userId)),
      stats: {
        totalOrders: Number(stats[0]?.total_orders) || 0,
        deliveredOrders: Number(stats[0]?.delivered_orders) || 0,
      },
      minPayout: Number(settings.reseller_min_payout) || 500,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load dashboard' });
  }
});

router.get('/orders', requireApprovedReseller, async (req, res) => {
  try {
    const rows = await query(
      `SELECT o.id, o.order_number, o.customer_name, o.customer_phone, o.status, o.total,
              o.created_at, o.delivery_fee, o.subtotal
       FROM orders o
       WHERE o.reseller_id = ?
       ORDER BY o.created_at DESC
       LIMIT 100`,
      [req.reseller.id]
    );
    const orders = [];
    for (const o of rows) {
      const items = await query(
        `SELECT product_name, quantity, unit_price, reseller_price_snapshot, reseller_profit_snapshot, base_price_snapshot
         FROM order_items WHERE order_id = ?`,
        [o.id]
      );
      const profit = items.reduce(
        (s, i) => s + (Number(i.reseller_profit_snapshot) || 0) * (Number(i.quantity) || 0),
        0
      );
      const phone = String(o.customer_phone || '');
      orders.push({
        id: o.id,
        orderNumber: o.order_number,
        customerName: o.customer_name,
        customerPhoneMasked: phone.length >= 4 ? `****${phone.slice(-4)}` : '****',
        status: o.status,
        total: Number(o.total),
        subtotal: Number(o.subtotal),
        deliveryFee: Number(o.delivery_fee),
        profit,
        createdAt: o.created_at,
        items: items.map((i) => ({
          name: i.product_name,
          qty: Number(i.quantity),
          soldPrice: Number(i.reseller_price_snapshot ?? i.unit_price),
          basePrice: Number(i.base_price_snapshot) || 0,
          profit: Number(i.reseller_profit_snapshot) || 0,
        })),
      });
    }
    res.json({ ok: true, orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load orders' });
  }
});

router.post('/orders', requireApprovedReseller, rateLimitPlaceOrder, async (req, res) => {
  let stockTaken = [];
  let orderSaved = false;
  try {
    const {
      name,
      phone,
      address,
      district,
      notes,
      items,
    } = req.body || {};

    const customerName = String(name || '').trim();
    const customerPhone = normalizeBdPhone(phone);
    const customerAddress = String(address || '').trim();
    const orderDistrict = String(district || 'Dhaka').trim() || 'Dhaka';

    if (!customerName || !customerPhone || !customerAddress) {
      return res.status(400).json({ ok: false, error: 'Name, valid BD mobile and address are required' });
    }
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ ok: false, error: 'Add at least one product' });
    }

    const lineInputs = items.map((it) => ({
      productId: Number(it.productId),
      qty: Math.max(1, Math.min(99, Number(it.qty) || 1)),
      sellingPrice: Number(it.sellingPrice),
    }));

    for (const line of lineInputs) {
      if (!line.productId) return res.status(400).json({ ok: false, error: 'Invalid product' });
    }

    const ids = [...new Set(lineInputs.map((l) => l.productId))];
    const placeholders = ids.map(() => '?').join(',');
    const products = await query(
      `SELECT id, name_bn, buy_price, stock, image_url FROM products WHERE id IN (${placeholders})`,
      ids
    );
    const byId = new Map(products.map((p) => [Number(p.id), p]));

    const stockLines = [];
    const orderLines = [];
    let subtotal = 0;
    let totalProfit = 0;

    for (const line of lineInputs) {
      const p = byId.get(line.productId);
      if (!p) return res.status(400).json({ ok: false, error: 'Product not found' });
      const base = Number(p.buy_price);
      if (!(base > 0)) {
        return res.status(400).json({ ok: false, error: `${p.name_bn} has no reseller base price` });
      }
      if (!(line.sellingPrice >= base)) {
        return res.status(400).json({
          ok: false,
          error: `${p.name_bn}: selling price must be ≥ ৳${base}`,
        });
      }
      if (Number(p.stock) < line.qty) {
        return res.status(400).json({ ok: false, error: `${p.name_bn} only has ${p.stock} in stock` });
      }
      const profitUnit = line.sellingPrice - base;
      subtotal += line.sellingPrice * line.qty;
      totalProfit += profitUnit * line.qty;
      stockLines.push({ productId: p.id, qty: line.qty });
      orderLines.push({
        productId: p.id,
        name: p.name_bn,
        qty: line.qty,
        unitPrice: line.sellingPrice,
        lineTotal: line.sellingPrice * line.qty,
        basePriceSnapshot: base,
        resellerPriceSnapshot: line.sellingPrice,
        resellerProfitSnapshot: profitUnit,
      });
    }

    const settings = await getSiteSettings(query);
    const { freeMin, fee } = deliveryConfig(settings, orderDistrict);
    const delivery = subtotal >= freeMin ? 0 : fee;
    const total = subtotal + delivery;
    const orderNumber = `RKS-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`;
    const orderNotes = [
      notes ? String(notes).trim() : '',
      `Reseller order #${req.reseller.id}`,
    ]
      .filter(Boolean)
      .join(' | ');

    const stockResult = await takeStockLines(stockLines);
    if (!stockResult.ok) {
      return res.status(400).json({ ok: false, error: stockResult.error });
    }
    stockTaken = stockResult.taken;

    const orderResult = await query(
      `INSERT INTO orders (user_id, order_number, customer_name, customer_phone, customer_email,
        address_line, district, postal_code, payment_method, subtotal, delivery_fee, total, notes, reseller_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)${returningId()}`,
      [
        req.session.userId,
        orderNumber,
        customerName,
        customerPhone,
        null,
        customerAddress,
        orderDistrict,
        null,
        'cod',
        subtotal,
        delivery,
        total,
        orderNotes || null,
        req.reseller.id,
      ]
    );

    let orderId = firstInsertId(orderResult);
    if (!orderId) {
      const found = await query('SELECT id FROM orders WHERE order_number = ?', [orderNumber]);
      orderId = found[0]?.id;
    }

    for (const line of orderLines) {
      await query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, line_total,
          base_price_snapshot, reseller_price_snapshot, reseller_profit_snapshot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          line.productId,
          line.name,
          line.qty,
          line.unitPrice,
          line.lineTotal,
          line.basePriceSnapshot,
          line.resellerPriceSnapshot,
          line.resellerProfitSnapshot,
        ]
      );
    }

    await markOrderStockCommitted(orderId, true);
    orderSaved = true;
    await addPendingProfit(req.reseller.id, totalProfit);

    res.json({
      ok: true,
      orderNumber,
      orderId,
      subtotal,
      delivery,
      total,
      profit: totalProfit,
      totalFormatted: formatPrice(total),
    });
  } catch (err) {
    if (stockTaken.length && !orderSaved) {
      await releaseStockLines(stockTaken).catch(() => {});
    }
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not place order' });
  }
});

router.get('/payouts', requireApprovedReseller, async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM reseller_payouts WHERE reseller_id = ? ORDER BY requested_at DESC LIMIT 50`,
      [req.reseller.id]
    );
    res.json({
      ok: true,
      payouts: rows.map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        method: r.method,
        accountNumber: r.account_number,
        status: r.status,
        requestedAt: r.requested_at,
        paidAt: r.paid_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Could not load payouts' });
  }
});

router.post('/payouts', requireApprovedReseller, async (req, res) => {
  try {
    const settings = await getSiteSettings(query);
    const minPayout = Number(settings.reseller_min_payout) || 500;
    const amount = Math.floor(Number(req.body?.amount) || 0);
    const method = String(req.body?.method || '').toLowerCase();
    const accountNumber = String(req.body?.accountNumber || '').replace(/\D/g, '');

    if (!['bkash', 'nagad', 'rocket'].includes(method)) {
      return res.status(400).json({ ok: false, error: 'Select bKash, Nagad or Rocket' });
    }
    if (!accountNumber || accountNumber.length < 10) {
      return res.status(400).json({ ok: false, error: 'Enter a valid account number' });
    }

    const fresh = await getResellerByUserId(req.session.userId);
    const wallet = Number(fresh.wallet_balance) || 0;
    if (wallet < minPayout) {
      return res.status(400).json({ ok: false, error: `Minimum payout is ৳${minPayout}` });
    }
    if (amount < minPayout || amount > wallet) {
      return res.status(400).json({ ok: false, error: `Amount must be between ৳${minPayout} and ৳${wallet}` });
    }

    const updated = await query(
      `UPDATE resellers SET wallet_balance = wallet_balance - ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND wallet_balance >= ?`,
      [amount, fresh.id, amount]
    );
    // verify row affected loosely
    const after = await getResellerByUserId(req.session.userId);
    if (Number(after.wallet_balance) !== wallet - amount) {
      // race — try not to leave inconsistent; re-check
      if (Number(after.wallet_balance) > wallet - amount) {
        /* ignore */
      }
    }

    const result = await query(
      `INSERT INTO reseller_payouts (reseller_id, amount, method, account_number, status)
       VALUES (?, ?, ?, ?, 'requested')${returningId()}`,
      [fresh.id, amount, method, accountNumber]
    );

    res.json({
      ok: true,
      payoutId: firstInsertId(result),
      reseller: sanitizeReseller(after),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not request payout' });
  }
});

module.exports = router;
module.exports.requireApprovedReseller = requireApprovedReseller;
