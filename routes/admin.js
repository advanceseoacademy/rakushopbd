const express = require('express');
const { brandLight, brandPale } = require('../lib/brandColors');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { formatPrice } = require('../lib/format');
const { slugify } = require('../lib/slugify');
const { normalizeStoreUrl } = require('../lib/normalizeStoreUrl');
const { clearSiteSettingsCache } = require('../lib/siteSettings');
const { normalizeSiteBaseUrl } = require('../lib/seo');
const { clearStoreBootstrapCache } = require('../lib/storeBootstrap');
const { setUserRewardPoints, listUserRewardPointHistory, describeRewardPointEvent } = require('../lib/rewardPoints');
const { sendAdminEmail, loadNotifySettings } = require('../lib/emailNotify');
const { sanitizeSmtpForAdminResponse } = require('../lib/smtpSettings');
const { requireAdmin, requireSuperAdmin } = require('../middleware/requireAdmin');
const { sql: sqlDialect, upsertSiteSettingSql, returningId } = require('../lib/db-dialect');
const { firstInsertId } = require('../config/db');
const { saveSession } = require('../lib/sessionSave');
const { signAdminToken, getAdminIdFromRequest, setAdminAuthCookie, clearAdminAuthCookie } = require('../lib/adminToken');
const { attachGalleryToProduct, syncProductGallery } = require('../lib/productImages');
const { ensureProductImagesTable } = require('../lib/ensureProductImagesTable');
const { ensureProductSyntheticReviewsColumn } = require('../lib/ensureProductSyntheticReviewsColumn');
const {
  listCategoriesWithCounts,
  resolveCategoryIdsBySlug,
  categoryInClause,
  normalizeCategoryId,
} = require('../lib/categoryHelpers');
const { setProductTodaySellingSlot, setTodaySellingProducts, normalizeSlot } = require('../lib/todaySellingSlots');
const { awardOrderPointsOnDelivery } = require('../lib/rewardPoints');
const { formatAdminPublic, ROLES, normalizeAdminRole } = require('../lib/adminRoles');

const router = express.Router();

function statusBadge(status) {
  const map = {
    pending: 'amber',
    confirmed: 'blue',
    shipped: 'blue',
    delivered: 'green',
    cancelled: 'red',
  };
  return map[status] || 'gray';
}

/** Sync per-product discount % with optional old price for storefront badges. */
function parseBuyPrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizeProductDiscount(price, oldPrice, discountPercent) {
  const p = Number(price);
  const fieldProvided = discountPercent !== undefined && discountPercent !== null && discountPercent !== '';
  let pct = fieldProvided ? Math.round(Number(discountPercent)) : null;

  if (!fieldProvided || pct == null || !Number.isFinite(pct) || pct <= 0 || pct >= 100) {
    return { oldPrice: null, discountPercent: null };
  }

  let old = oldPrice != null && oldPrice !== '' ? Number(oldPrice) : null;
  if (old != null && (!Number.isFinite(old) || old <= 0)) old = null;

  if (p > 0 && !old) {
    old = Math.round(p / (1 - pct / 100));
  } else if (old && p > 0 && old <= p) {
    old = null;
  }

  return {
    oldPrice: old || null,
    discountPercent: pct,
  };
}

/** Safe COUNT / scalar from first row (Postgres camelCase aliases). */
async function scalarCount(sql, params = []) {
  const rows = await query(sql, params);
  if (!rows?.length) return 0;
  const row = rows[0];
  const val = Object.values(row)[0];
  return Number(val) || 0;
}

function rowVal(row, ...keys) {
  for (const k of keys) {
    if (row && row[k] != null) return row[k];
  }
  return null;
}

async function getSettingsMap() {
  const rows = await query('SELECT setting_key, setting_value FROM site_settings');
  const map = {};
  rows.forEach((r) => {
    map[r.setting_key] = r.setting_value;
  });
  return map;
}

// ——— Auth ———
router.get('/ping', async (req, res) => {
  try {
    const [row] = await query('SELECT COUNT(*) AS adminCount FROM admins');
    res.json({ ok: true, adminCount: Number(row.adminCount) || 0, apiVersion: 2 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Database error' });
  }
});

/** Live server check: if this returns apiVersion 2, Git Pull succeeded */
router.get('/version', (req, res) => {
  res.json({ ok: true, apiVersion: 2, hasAuthToken: true });
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Username and password required' });
    }
    const rows = await query(
      'SELECT id, username, email, full_name, password_hash, role FROM admins WHERE username = ? OR email = ? LIMIT 1',
      [username.trim(), username.trim()]
    );
    if (!rows.length) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

    req.session.adminId = admin.id;
    const token = signAdminToken(admin.id);
    setAdminAuthCookie(res, admin.id);
    const payload = {
      ok: true,
      token,
      admin: formatAdminPublic(admin),
    };
    saveSession(req, (saveErr) => {
      if (saveErr) console.error('Session save warning:', saveErr.message);
      res.json(payload);
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  req.session = null;
  clearAdminAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  const adminId = getAdminIdFromRequest(req);
  if (!adminId) return res.json({ ok: true, admin: null });
  const rows = await query(
    'SELECT id, username, email, full_name, role FROM admins WHERE id = ?',
    [adminId]
  );
  if (!rows.length) {
    req.session = null;
    return res.json({ ok: true, admin: null });
  }
  const a = rows[0];
  setAdminAuthCookie(res, a.id);
  res.json({
    ok: true,
    admin: formatAdminPublic(a),
  });
});

// ——— Team / admin accounts (super admin only) ———
router.get('/admins', requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, username, email, full_name, role, created_at FROM admins ORDER BY id ASC'
    );
    res.json({
      ok: true,
      admins: rows.map((row) => ({
        ...formatAdminPublic(row),
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load admin accounts' });
  }
});

router.post('/admins', requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const fullName = String(req.body?.fullName || req.body?.full_name || '').trim() || 'Admin';
    const password = String(req.body?.password || '');
    const role = normalizeAdminRole(req.body?.role);

    if (!username || !email || !password) {
      return res.status(400).json({ ok: false, error: 'Username, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' });
    }
    if (role !== ROLES.PRODUCT_EDITOR && role !== ROLES.SUPER_ADMIN) {
      return res.status(400).json({ ok: false, error: 'Invalid role' });
    }

    const existing = await query(
      'SELECT id FROM admins WHERE username = ? OR email = ? LIMIT 1',
      [username, email]
    );
    if (existing.length) {
      return res.status(400).json({ ok: false, error: 'Username or email already in use' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO admins (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)${returningId()}`,
      [username, email, hash, fullName, role]
    );
    const newId = firstInsertId(result);
    const rows = newId
      ? await query('SELECT id, username, email, full_name, role, created_at FROM admins WHERE id = ?', [newId])
      : await query(
          'SELECT id, username, email, full_name, role, created_at FROM admins WHERE username = ? LIMIT 1',
          [username]
        );

    res.json({ ok: true, admin: { ...formatAdminPublic(rows[0]), createdAt: rows[0]?.created_at } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not create admin account' });
  }
});

router.put('/admins/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid admin id' });

    const rows = await query('SELECT id, role FROM admins WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Admin not found' });

    const nextRole = req.body?.role != null ? normalizeAdminRole(req.body.role) : normalizeAdminRole(rows[0].role);
    const fullName = req.body?.fullName != null ? String(req.body.fullName).trim() : null;
    const email = req.body?.email != null ? String(req.body.email).trim().toLowerCase() : null;
    const password = req.body?.password != null ? String(req.body.password) : '';

    if (email) {
      const dup = await query('SELECT id FROM admins WHERE email = ? AND id != ? LIMIT 1', [email, id]);
      if (dup.length) return res.status(400).json({ ok: false, error: 'Email already in use' });
    }

    if (password && password.length < 6) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' });
    }

    if (Number(req.adminId) === id && nextRole !== ROLES.SUPER_ADMIN) {
      return res.status(400).json({ ok: false, error: 'You cannot remove your own super admin access' });
    }

    if (normalizeAdminRole(rows[0].role) === ROLES.SUPER_ADMIN && nextRole !== ROLES.SUPER_ADMIN) {
      const superCount = await scalarCount(
        "SELECT COUNT(*) AS cnt FROM admins WHERE role = 'super_admin' OR role IS NULL OR role = ''"
      );
      if (superCount <= 1) {
        return res.status(400).json({ ok: false, error: 'At least one super admin is required' });
      }
    }

    const fields = ['role = ?'];
    const params = [nextRole];
    if (fullName) {
      fields.push('full_name = ?');
      params.push(fullName);
    }
    if (email) {
      fields.push('email = ?');
      params.push(email);
    }
    if (password) {
      fields.push('password_hash = ?');
      params.push(await bcrypt.hash(password, 10));
    }
    params.push(id);
    await query(`UPDATE admins SET ${fields.join(', ')} WHERE id = ?`, params);

    const updated = await query(
      'SELECT id, username, email, full_name, role, created_at FROM admins WHERE id = ?',
      [id]
    );
    res.json({ ok: true, admin: { ...formatAdminPublic(updated[0]), createdAt: updated[0]?.created_at } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not update admin account' });
  }
});

router.delete('/admins/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid admin id' });
    if (Number(req.adminId) === id) {
      return res.status(400).json({ ok: false, error: 'You cannot delete your own account' });
    }

    const rows = await query('SELECT id, role FROM admins WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Admin not found' });

    if (normalizeAdminRole(rows[0].role) === ROLES.SUPER_ADMIN) {
      const superCount = await scalarCount(
        "SELECT COUNT(*) AS cnt FROM admins WHERE role = 'super_admin' OR role IS NULL OR role = ''"
      );
      if (superCount <= 1) {
        return res.status(400).json({ ok: false, error: 'Cannot delete the last super admin' });
      }
    }

    await query('DELETE FROM admins WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not delete admin account' });
  }
});

// ——— Dashboard ———
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const totalOrders = await scalarCount('SELECT COUNT(*) AS totalOrders FROM orders');
    const unreadOrders = await scalarCount(
      'SELECT COUNT(*) AS unreadOrders FROM orders WHERE COALESCE(viewed_by_admin, false) = false'
    );
    const pendingOrders = await scalarCount(
      "SELECT COUNT(*) AS pendingOrders FROM orders WHERE status IN ('pending','confirmed')"
    );
    const totalRevenue = await scalarCount(
      "SELECT COALESCE(SUM(total),0) AS totalRevenue FROM orders WHERE status != 'cancelled'"
    );
    const monthRevenue = await scalarCount(
      `SELECT COALESCE(SUM(total),0) AS monthRevenue FROM orders
       WHERE status != 'cancelled' AND ${sqlDialect.ordersThisMonth()}`
    );
    const totalProducts = await scalarCount('SELECT COUNT(*) AS totalProducts FROM products');
    const lowStock = await scalarCount('SELECT COUNT(*) AS lowStock FROM products WHERE stock <= 5');
    let totalCustomers = 0;
    try {
      totalCustomers = await scalarCount('SELECT COUNT(*) AS cnt FROM users');
    } catch (_) {}

    const recentOrders = await query(
      `SELECT o.id, o.order_number, o.customer_name, o.total, o.status, o.created_at,
        ${sqlDialect.orderItemsPreview('o')} AS items_preview
       FROM orders o ORDER BY o.created_at DESC LIMIT 5`
    );

    const statusBreakdown = await query(
      `SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status`
    );

    const monthlyRevenue = await query(
      `SELECT ${sqlDialect.revenueSelectMonth()}, COALESCE(SUM(total),0) AS revenue
       FROM orders WHERE status != 'cancelled' AND ${sqlDialect.revenueLast12Months()}
       GROUP BY ${sqlDialect.revenueGroupByMonth()} ORDER BY ${sqlDialect.revenueOrderByMonth()}`
    );

    let activity = [];
    try {
      const actRes = await query(
        `SELECT order_number, customer_name, created_at, 'order' AS type FROM orders ORDER BY created_at DESC LIMIT 5`
      );
      activity = actRes.map((a) => ({
        type: 'order',
        text: `New order ${rowVal(a, 'orderNumber', 'order_number')} from ${rowVal(a, 'customerName', 'customer_name')}`,
        time: rowVal(a, 'createdAt', 'created_at'),
      }));
    } catch (_) {}

    res.json({
      ok: true,
      activity,
      stats: {
        totalOrders,
        unreadOrders,
        pendingOrders,
        totalRevenue,
        totalRevenueFormatted: formatPrice(totalRevenue),
        monthRevenue,
        monthRevenueFormatted: formatPrice(monthRevenue),
        totalProducts,
        lowStock,
        totalCustomers,
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: rowVal(o, 'orderNumber', 'order_number'),
        customerName: rowVal(o, 'customerName', 'customer_name'),
        itemsPreview: rowVal(o, 'itemsPreview', 'items_preview') || '—',
        total: Number(o.total) || 0,
        totalFormatted: formatPrice(o.total),
        status: o.status,
        statusBadge: statusBadge(o.status),
        createdAt: rowVal(o, 'createdAt', 'created_at'),
      })),
      statusBreakdown: statusBreakdown.map((b) => ({
        status: b.status,
        cnt: Number(b.cnt) || 0,
      })),
      monthlyRevenue: monthlyRevenue.map((r) => ({
        month: Number(r.m) || 0,
        revenue: Number(r.revenue) || 0,
      })),
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ ok: false, error: 'Could not load dashboard' });
  }
});

// ——— Orders ———
router.get('/orders/unread-count', requireAdmin, async (req, res) => {
  try {
    const unreadCount = await scalarCount(
      'SELECT COUNT(*) AS unreadCount FROM orders WHERE COALESCE(viewed_by_admin, false) = false'
    );
    res.json({ ok: true, unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load unread order count' });
  }
});

router.get('/orders', requireAdmin, async (req, res) => {
  try {
    const { status, search, payment, page = 1, limit = 20 } = req.query;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(5, parseInt(limit, 10) || 20));
    const offset = (p - 1) * l;

    let sql = `SELECT o.* FROM orders o WHERE 1=1`;
    let countSql = `SELECT COUNT(*) AS total FROM orders o WHERE 1=1`;
    const params = [];
    if (status && status !== 'all') {
      sql += ' AND o.status = ?';
      countSql += ' AND o.status = ?';
      params.push(status);
    }
    if (payment && payment !== 'all') {
      sql += ' AND o.payment_method = ?';
      countSql += ' AND o.payment_method = ?';
      params.push(payment);
    }
    if (search) {
      sql += ' AND (o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)';
      countSql += ' AND (o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q);
    }
    const [{ total }] = await query(countSql, params);
    const [{ totalOrders }] = await query('SELECT COUNT(*) AS totalOrders FROM orders');
    const [{ unreadCount }] = await query(
      'SELECT COUNT(*) AS unreadCount FROM orders WHERE COALESCE(viewed_by_admin, false) = false'
    );
    sql += ` ORDER BY o.created_at DESC LIMIT ${l} OFFSET ${offset}`;
    const orders = await query(sql, params);

    const enriched = await Promise.all(
      orders.map(async (o) => {
        const items = await query(
          'SELECT product_name, quantity FROM order_items WHERE order_id = ?',
          [o.id]
        );
        const preview = items.map((i) => `${i.product_name} ×${i.quantity}`).join(', ');
        return {
          id: o.id,
          orderNumber: o.order_number,
          customerName: o.customer_name,
          customerPhone: o.customer_phone,
          viewedByAdmin: Boolean(o.viewed_by_admin),
          viewedAt: o.viewed_at || null,
          paymentMethod: o.payment_method,
          total: Number(o.total),
          totalFormatted: formatPrice(o.total),
          status: o.status,
          statusBadge: statusBadge(o.status),
          itemsPreview: preview || '—',
          createdAt: o.created_at,
        };
      })
    );

    res.json({
      ok: true,
      orders: enriched,
      totalOrders: Number(totalOrders) || 0,
      unreadCount: Number(unreadCount) || 0,
      pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) || 1 },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load orders' });
  }
});

router.get('/orders/:id', requireAdmin, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Order not found' });
    const o = rows[0];
    await query('UPDATE orders SET viewed_by_admin = true, viewed_at = CURRENT_TIMESTAMP WHERE id = ?', [o.id]);
    const items = await query('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
    const unreadCount = await scalarCount(
      'SELECT COUNT(*) AS unreadCount FROM orders WHERE COALESCE(viewed_by_admin, false) = false'
    );
    res.json({
      ok: true,
      unreadCount,
      order: {
        ...o,
        subtotal: Number(o.subtotal),
        deliveryFee: Number(o.delivery_fee),
        total: Number(o.total),
        totalFormatted: formatPrice(o.total),
        items,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load order' });
  }
});

router.patch('/orders/:id', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ ok: false, error: 'Invalid status' });
    }
    const id = Number(req.params.id);
    const rows = await query('SELECT id, user_id, status FROM orders WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Order not found' });
    const prevStatus = String(rows[0].status || '').toLowerCase();
    await query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);

    let pointsAwarded = 0;
    let bonusPoints = 0;
    if (status === 'delivered' && prevStatus !== 'delivered') {
      const award = await awardOrderPointsOnDelivery(query, id);
      pointsAwarded = award.earned || 0;
      bonusPoints = award.bonus || 0;
    }

    res.json({ ok: true, pointsAwarded, bonusPoints });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not update order' });
  }
});

router.delete('/orders/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid order id' });
    const rows = await query('SELECT id FROM orders WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Order not found' });
    await query('DELETE FROM order_items WHERE order_id = ?', [id]);
    await query('DELETE FROM orders WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not delete order' });
  }
});

router.post('/orders/bulk-delete', requireAdmin, async (req, res) => {
  try {
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Boolean))];
    if (!ids.length) return res.status(400).json({ ok: false, error: 'No orders selected' });
    const placeholders = ids.map(() => '?').join(',');
    await query(`DELETE FROM order_items WHERE order_id IN (${placeholders})`, ids);
    await query(`DELETE FROM orders WHERE id IN (${placeholders})`, ids);
    res.json({ ok: true, deleted: ids.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not delete selected orders' });
  }
});

// ——— Product image gallery ———
router.get('/product-images', requireAdmin, async (req, res) => {
  try {
    await ensureProductImagesTable();
    const { search, category, page = 1, limit = 48 } = req.query;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(96, Math.max(12, parseInt(limit, 10) || 48));
    const offset = (p - 1) * l;

    const where = ['TRIM(COALESCE(img.image_url, \'\')) != \'\''];
    const params = [];

    if (search && String(search).trim()) {
      const q = `%${String(search).trim()}%`;
      where.push('(p.name_bn LIKE ? OR p.slug LIKE ? OR img.image_url LIKE ?)');
      params.push(q, q, q);
    }
    if (category && category !== 'all') {
      const catIds = await resolveCategoryIdsBySlug(query, category);
      if (catIds.length) {
        const { clause, params: catParams } = categoryInClause(catIds);
        where.push(clause);
        params.push(...catParams);
      } else {
        where.push('1=0');
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const baseSql = `
      FROM (
        SELECT pi.id AS image_id, pi.product_id, p.name_bn AS product_name, p.slug AS product_slug,
               pi.image_url, pi.sort_order,
               CASE WHEN pi.sort_order = 0 THEN 1 ELSE 0 END AS is_main,
               c.name_bn AS category_name, c.slug AS category_slug
        FROM product_images pi
        INNER JOIN products p ON p.id = pi.product_id
        INNER JOIN categories c ON c.id = p.category_id
        WHERE TRIM(COALESCE(pi.image_url, '')) != ''

        UNION ALL

        SELECT NULL AS image_id, p.id AS product_id, p.name_bn AS product_name, p.slug AS product_slug,
               p.image_url, 0 AS sort_order, 1 AS is_main, c.name_bn AS category_name, c.slug AS category_slug
        FROM products p
        INNER JOIN categories c ON c.id = p.category_id
        WHERE TRIM(COALESCE(p.image_url, '')) != ''
          AND NOT EXISTS (SELECT 1 FROM product_images pi2 WHERE pi2.product_id = p.id)
      ) img
      INNER JOIN products p ON p.id = img.product_id
    `;

    const countRows = await query(`SELECT COUNT(*) AS total ${baseSql} ${whereSql}`, params);
    const total = Number(countRows[0]?.total ?? Object.values(countRows[0] || {})[0]) || 0;

    const rows = await query(
      `SELECT img.image_id, img.product_id, img.product_name, img.product_slug, img.image_url,
              img.sort_order, img.is_main, img.category_name, img.category_slug
       ${baseSql}
       ${whereSql}
       ORDER BY img.product_id DESC, img.sort_order ASC, img.image_id ASC
       LIMIT ? OFFSET ?`,
      [...params, l, offset]
    );

    const productIds = new Set(rows.map((r) => Number(r.product_id)));
    res.json({
      ok: true,
      images: rows.map((r) => ({
        id: r.image_id,
        productId: r.product_id,
        productName: r.product_name,
        productSlug: r.product_slug,
        imageUrl: r.image_url,
        sortOrder: Number(r.sort_order) || 0,
        isMain: Boolean(Number(r.is_main)),
        categoryName: r.category_name,
        categorySlug: r.category_slug,
      })),
      stats: {
        totalImages: total,
        productsOnPage: productIds.size,
      },
      pagination: {
        page: p,
        limit: l,
        total,
        pages: Math.max(1, Math.ceil(total / l)),
      },
    });
  } catch (err) {
    console.error('admin product-images', err);
    res.status(500).json({ ok: false, error: 'Could not load product images' });
  }
});

// ——— Products ———
router.get('/products', requireAdmin, async (req, res) => {
  try {
    const { category, search, page = 1, limit = 6 } = req.query;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(48, Math.max(1, parseInt(limit, 10) || 6));
    const offset = (p - 1) * l;
    let sql = `
      SELECT p.*, c.name_bn AS category_name, c.slug AS category_slug, c.parent_id AS category_parent_id,
             pc.name_bn AS parent_category_name
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN categories pc ON pc.id = c.parent_id
      WHERE 1=1`;
    let countSql = `
      SELECT COUNT(*) AS total
      FROM products p JOIN categories c ON c.id = p.category_id WHERE 1=1`;
    const params = [];
    if (category && category !== 'all') {
      const catIds = await resolveCategoryIdsBySlug(query, category);
      if (catIds.length) {
        const { clause, params: catParams } = categoryInClause(catIds);
        sql += ` AND ${clause}`;
        countSql += ` AND ${clause}`;
        params.push(...catParams);
      } else {
        sql += ' AND 1=0';
        countSql += ' AND 1=0';
      }
    }
    if (search) {
      sql += ' AND (p.name_bn LIKE ? OR p.slug LIKE ?)';
      countSql += ' AND (p.name_bn LIKE ? OR p.slug LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q);
    }
    const [{ total }] = await query(countSql, params);
    sql += ' ORDER BY p.id DESC';
    sql += ` LIMIT ${l} OFFSET ${offset}`;
    const products = await query(sql, params);
    res.json({
      ok: true,
      products,
      pagination: { page: p, limit: l, total: Number(total) || 0, pages: Math.ceil((Number(total) || 0) / l) || 1 },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load products' });
  }
});

router.get('/products/export', requireAdmin, async (req, res) => {
  try {
    const products = await query(
      `SELECT p.*, c.name_bn AS category_name, c.slug AS category_slug
       FROM products p
       JOIN categories c ON c.id = p.category_id
       ORDER BY p.id DESC`
    );

    const galleryMap = new Map();
    if (products.length) {
      await ensureProductImagesTable();
      const ids = products.map((p) => p.id);
      const placeholders = ids.map(() => '?').join(',');
      const imageRows = await query(
        `SELECT product_id, image_url FROM product_images WHERE product_id IN (${placeholders}) ORDER BY product_id, sort_order, id`,
        ids
      );
      for (const row of imageRows) {
        const pid = row.product_id;
        if (!galleryMap.has(pid)) galleryMap.set(pid, []);
        galleryMap.get(pid).push(row.image_url);
      }
    }

    const csvCell = (value) => {
      const s = value == null ? '' : String(value);
      return `"${s.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    };

    const columns = [
      'ID',
      'Name',
      'Slug',
      'SKU',
      'Category',
      'Category Slug',
      'Price',
      'Old Price',
      'Buy Price',
      'Stock',
      'Featured',
      'Tag Type',
      'Tag Text',
      'Discount %',
      'Image URL',
      'Gallery URLs',
      'Short Description',
      'Description',
      'SEO Title',
      'SEO Description',
      'SEO Keywords',
      'Image Alt',
      'OG Image',
      'Rating',
      'Review Count',
      'Created At',
    ];

    const rows = products.map((p) => {
      let gallery = galleryMap.get(p.id) || [];
      if (p.image_url && !gallery.includes(p.image_url)) gallery = [p.image_url, ...gallery];
      return [
        p.id,
        p.name_bn,
        p.slug,
        p.sku,
        p.category_name,
        p.category_slug,
        p.price,
        p.old_price,
        p.buy_price,
        p.stock,
        p.is_featured ? 1 : 0,
        p.tag_type,
        p.tag_text,
        p.discount_percent,
        p.image_url,
        gallery.join('|'),
        p.short_description,
        p.description_bn,
        p.seo_title,
        p.seo_description,
        p.seo_keywords,
        p.image_alt,
        p.og_image,
        p.rating,
        p.review_count,
        p.created_at,
      ]
        .map(csvCell)
        .join(',');
    });

    const csv = `${columns.join(',')}\n${rows.join('\n')}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=products.csv');
    res.send(`\uFEFF${csv}`);
  } catch (err) {
    console.error('products export', err);
    res.status(500).send('Export failed');
  }
});

router.get('/products/:id', requireAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (!productId) return res.status(400).json({ ok: false, error: 'Invalid product' });
    const rows = await query(
      `SELECT p.*, c.name_bn AS category_name, c.slug AS category_slug, c.parent_id AS category_parent_id,
              pc.name_bn AS parent_category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN categories pc ON pc.id = c.parent_id
       WHERE p.id = ? LIMIT 1`,
      [productId]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Product not found' });
    const product = await attachGalleryToProduct(rows[0]);
    res.json({ ok: true, product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load product' });
  }
});

router.post('/products', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      categoryId,
      price,
      oldPrice,
      stock,
      description,
      shortDescription,
      icon,
      iconColor,
      bgColor,
      tagType,
      tagText,
      discountPercent,
      isFeatured,
      sku,
      imageUrl,
      galleryUrls,
      seoTitle,
      seoDescription,
      seoKeywords,
      imageAlt,
      ogImage,
      buyPrice,
      todaySellingSlot,
    } = req.body;
    if (!name || !categoryId || price == null) {
      return res.status(400).json({ ok: false, error: 'Name, category and price are required' });
    }
    const pricing = normalizeProductDiscount(price, oldPrice, discountPercent);
    const buy_price = parseBuyPrice(buyPrice);
    let slug = req.body.slug ? slugify(req.body.slug) : slugify(name);
    const existing = await query('SELECT id FROM products WHERE slug = ?', [slug]);
    if (existing.length) slug = `${slug}-${Date.now()}`;

    await ensureProductSyntheticReviewsColumn();

    const result = await query(
      `INSERT INTO products (category_id, slug, sku, name_bn, description_bn, short_description, price, old_price, buy_price, stock,
        icon, icon_color, bg_color, image_url, tag_type, tag_text, discount_percent, is_featured,
        seo_title, seo_description, seo_keywords, image_alt, og_image, allow_synthetic_reviews)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)${returningId()}`,
      [
        categoryId,
        slug,
        sku || null,
        name,
        description || null,
        shortDescription || null,
        price,
        pricing.oldPrice,
        buy_price,
        stock ?? 100,
        icon || 'ti-package',
        iconColor || brandLight,
        bgColor || brandPale,
        imageUrl || null,
        tagType || 'none',
        tagText || null,
        pricing.discountPercent,
        isFeatured ? 1 : 0,
        seoTitle || null,
        seoDescription || null,
        seoKeywords || null,
        imageAlt || null,
        ogImage || null,
      ]
    );
    const newId = firstInsertId(result) ?? (await query('SELECT id FROM products WHERE slug = ?', [slug]))[0]?.id;
    if (newId) {
      const synced = await syncProductGallery(newId, galleryUrls, imageUrl);
      if (synced[0] && synced[0] !== imageUrl) {
        await query('UPDATE products SET image_url = ? WHERE id = ?', [synced[0], newId]);
      }
      await setProductTodaySellingSlot(query, newId, todaySellingSlot);
    }
    clearStoreBootstrapCache();
    res.json({ ok: true, id: newId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not create product' });
  }
});

router.put('/products/:id', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      slug: slugInput,
      categoryId,
      price,
      oldPrice,
      stock,
      description,
      shortDescription,
      icon,
      iconColor,
      bgColor,
      tagType,
      tagText,
      discountPercent,
      isFeatured,
      sku,
      imageUrl,
      galleryUrls,
      seoTitle,
      seoDescription,
      seoKeywords,
      imageAlt,
      ogImage,
      buyPrice,
      todaySellingSlot,
    } = req.body;
    const productId = req.params.id;
    const pricing = normalizeProductDiscount(price, oldPrice, discountPercent);
    const buy_price = parseBuyPrice(buyPrice);
    let slugClause = '';
    const params = [
      categoryId,
      sku || null,
      name,
      description || null,
      shortDescription || null,
      price,
      pricing.oldPrice,
      buy_price,
      stock ?? 0,
      icon || 'ti-package',
      iconColor || brandLight,
      bgColor || brandPale,
      imageUrl || null,
      tagType || 'none',
      tagText || null,
      pricing.discountPercent,
      isFeatured ? 1 : 0,
      seoTitle || null,
      seoDescription || null,
      seoKeywords || null,
      imageAlt || null,
      ogImage || null,
    ];
    if (slugInput && String(slugInput).trim()) {
      let slug = slugify(slugInput);
      const dup = await query('SELECT id FROM products WHERE slug = ? AND id != ?', [slug, productId]);
      if (dup.length) slug = `${slug}-${productId}`;
      slugClause = ', slug=?';
      params.push(slug);
    }
    params.push(productId);
    await query(
      `UPDATE products SET category_id=?, sku=?, name_bn=?, description_bn=?, short_description=?, price=?, old_price=?, buy_price=?, stock=?,
        icon=?, icon_color=?, bg_color=?, image_url=?, tag_type=?, tag_text=?, discount_percent=?, is_featured=?,
        seo_title=?, seo_description=?, seo_keywords=?, image_alt=?, og_image=?${slugClause}
       WHERE id=?`,
      params
    );
    const synced = await syncProductGallery(productId, req.body.galleryUrls, imageUrl);
    if (synced[0] && synced[0] !== imageUrl) {
      await query('UPDATE products SET image_url = ? WHERE id = ?', [synced[0], productId]);
    }
    await setProductTodaySellingSlot(query, productId, todaySellingSlot);
    clearStoreBootstrapCache();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not update product' });
  }
});

router.post('/products/bulk-delete', requireAdmin, async (req, res) => {
  try {
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Boolean))];
    if (!ids.length) return res.status(400).json({ ok: false, error: 'No products selected' });

    const placeholders = ids.map(() => '?').join(',');
    const inOrders = await query(
      `SELECT DISTINCT product_id FROM order_items WHERE product_id IN (${placeholders})`,
      ids
    );
    const blocked = new Set(inOrders.map((r) => Number(r.product_id ?? r.productId)));
    const toDelete = ids.filter((id) => !blocked.has(id));

    if (!toDelete.length) {
      return res.status(400).json({
        ok: false,
        error:
          blocked.size === 1
            ? 'Product has orders; cannot delete'
            : `${blocked.size} selected product(s) have orders and cannot be deleted`,
      });
    }

    const delPlaceholders = toDelete.map(() => '?').join(',');
    await query(`DELETE FROM products WHERE id IN (${delPlaceholders})`, toDelete);
    clearStoreBootstrapCache();
    res.json({
      ok: true,
      deleted: toDelete.length,
      skipped: blocked.size,
      skippedIds: [...blocked],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not delete selected products' });
  }
});

router.delete('/products/:id', requireAdmin, async (req, res) => {
  try {
    const inOrders = await query(
      'SELECT id FROM order_items WHERE product_id = ? LIMIT 1',
      [req.params.id]
    );
    if (inOrders.length) {
      return res.status(400).json({ ok: false, error: 'Product has orders; cannot delete' });
    }
    await query('DELETE FROM products WHERE id = ?', [req.params.id]);
    clearStoreBootstrapCache();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not delete product' });
  }
});

// ——— Categories ———
async function validateCategoryParent(parentId, selfId) {
  if (parentId == null || parentId === '' || parentId === 0) return null;
  const pid = Number(parentId);
  if (!pid) return null;
  if (selfId && pid === Number(selfId)) {
    return { error: 'Category cannot be its own parent' };
  }
  const rows = await query('SELECT id, parent_id FROM categories WHERE id = ? LIMIT 1', [pid]);
  if (!rows.length) return { error: 'Parent category not found' };
  if (normalizeCategoryId(rows[0].parent_id)) {
    return { error: 'Subcategories can only be placed under a top-level category' };
  }
  if (selfId) {
    const children = await query('SELECT id FROM categories WHERE parent_id = ? LIMIT 1', [selfId]);
    if (children.length && pid !== Number(selfId)) {
      return { error: 'Remove subcategories before changing this to a subcategory' };
    }
  }
  return pid;
}

router.get('/categories', requireAdmin, async (req, res) => {
  try {
    const categories = await listCategoriesWithCounts(query);
    let subcategoryReady = true;
    try {
      await query('SELECT parent_id FROM categories LIMIT 1');
    } catch (err) {
      subcategoryReady = false;
    }
    res.json({ ok: true, categories, subcategoryReady });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load categories' });
  }
});

router.post('/categories/:parentId/subcategories', requireAdmin, async (req, res) => {
  try {
    const parentCheck = await validateCategoryParent(req.params.parentId);
    if (parentCheck?.error) return res.status(400).json({ ok: false, error: parentCheck.error });
    if (!parentCheck) {
      return res.status(400).json({ ok: false, error: 'Valid main category required' });
    }
    const { name, slug, icon, iconUrl, sortOrder } = req.body;
    if (!name) return res.status(400).json({ ok: false, error: 'Name required' });
    const s = normalizeStoreUrl(String(slug || slugify(name)).trim());
    await query(
      'INSERT INTO categories (slug, name_bn, icon, icon_url, sort_order, parent_id) VALUES (?, ?, ?, ?, ?, ?)',
      [s, name, icon || 'ti-category', iconUrl || null, sortOrder || 0, parentCheck]
    );
    clearStoreBootstrapCache();
    res.json({ ok: true, parentId: parentCheck });
  } catch (err) {
    console.error(err);
    const msg = String(err?.message || err);
    if (/Unknown column.*parent_id/i.test(msg)) {
      return res.status(500).json({
        ok: false,
        error: 'Database e parent_id column nai — server restart/deploy korun',
      });
    }
    res.status(500).json({ ok: false, error: 'Could not create subcategory' });
  }
});

router.post('/categories', requireAdmin, async (req, res) => {
  try {
    const { name, slug, icon, iconUrl, sortOrder } = req.body;
    const parentIdRaw = req.body.parentId ?? req.body.parent_id;
    if (!name) return res.status(400).json({ ok: false, error: 'Name required' });
    const parentCheck = await validateCategoryParent(parentIdRaw);
    if (parentCheck?.error) return res.status(400).json({ ok: false, error: parentCheck.error });
    const parent_id = parentCheck === null ? null : parentCheck;
    const s = normalizeStoreUrl(String(slug || slugify(name)).trim());
    await query(
      'INSERT INTO categories (slug, name_bn, icon, icon_url, sort_order, parent_id) VALUES (?, ?, ?, ?, ?, ?)',
      [s, name, icon || 'ti-category', iconUrl || null, sortOrder || 0, parent_id]
    );
    clearStoreBootstrapCache();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not create category' });
  }
});

router.put('/categories/:id', requireAdmin, async (req, res) => {
  try {
    const { name, slug, icon, iconUrl, sortOrder } = req.body;
    const parentIdRaw = req.body.parentId ?? req.body.parent_id;
    const parentCheck = await validateCategoryParent(parentIdRaw, req.params.id);
    if (parentCheck?.error) return res.status(400).json({ ok: false, error: parentCheck.error });
    const parent_id = parentCheck === null ? null : parentCheck;
    const s = normalizeStoreUrl(String(slug || '').trim());
    await query(
      'UPDATE categories SET slug=?, name_bn=?, icon=?, icon_url=?, sort_order=?, parent_id=? WHERE id=?',
      [s, name, icon || 'ti-category', iconUrl || null, sortOrder || 0, parent_id, req.params.id]
    );
    clearStoreBootstrapCache();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not update category' });
  }
});

router.delete('/categories/:id', requireAdmin, async (req, res) => {
  try {
    const children = await query('SELECT id FROM categories WHERE parent_id = ? LIMIT 1', [req.params.id]);
    if (children.length) {
      return res.status(400).json({ ok: false, error: 'Category has subcategories — delete them first' });
    }
    const prods = await query('SELECT id FROM products WHERE category_id = ? LIMIT 1', [req.params.id]);
    if (prods.length) {
      return res.status(400).json({ ok: false, error: 'Category has products' });
    }
    await query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    clearStoreBootstrapCache();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not delete category' });
  }
});

// ——— Customers ———
router.get('/customers', requireAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `
      SELECT u.id, u.full_name, u.email, u.phone, u.created_at,
        COALESCE(u.reward_points, 0) AS reward_points,
        COUNT(DISTINCT o.id) AS order_count,
        COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total ELSE 0 END), 0) AS total_spent
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id`;
    const params = [];
    if (search) {
      sql += ' WHERE u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?';
      const q = `%${search}%`;
      params.push(q, q, q);
    }
    sql += ' GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200';
    const customers = await query(sql, params);
    res.json({
      ok: true,
      customers: customers.map((c) => ({
        id: c.id,
        fullName: c.full_name,
        email: c.email,
        phone: c.phone,
        rewardPoints: Number(c.reward_points) || 0,
        orderCount: c.order_count,
        totalSpent: Number(c.total_spent),
        totalSpentFormatted: formatPrice(c.total_spent),
        createdAt: c.created_at,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load customers' });
  }
});

router.patch('/customers/:id/points', requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ ok: false, error: 'Invalid customer' });
    const points = await setUserRewardPoints(query, userId, req.body.points, { logSource: 'admin' });
    res.json({ ok: true, points });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not update points' });
  }
});

router.get('/customers/:id/reward-points', requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ ok: false, error: 'Invalid customer' });

    const users = await query(
      'SELECT id, full_name, email, phone, COALESCE(reward_points, 0) AS reward_points FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const customer = users[0];
    if (!customer) return res.status(404).json({ ok: false, error: 'Customer not found' });

    const rows = await listUserRewardPointHistory(query, userId);
    const events = rows.map((row) => {
      const { label, detail } = describeRewardPointEvent(row.event_type, row.reference_key);
      const points = Number(row.points) || 0;
      return {
        id: row.id,
        eventType: row.event_type,
        label,
        detail,
        points,
        pointsFormatted: points > 0 ? `+${points}` : String(points),
        referenceKey: row.reference_key,
        createdAt: row.created_at,
        synthesized: Boolean(row.synthesized),
        orderId:
          row.event_type === 'order_delivery' ||
          row.event_type === 'first_order' ||
          row.event_type === 'order_redeem'
            ? Number(row.reference_key) || null
            : null,
      };
    });

    const earnedTotal = events.reduce((sum, ev) => sum + (ev.points > 0 ? ev.points : 0), 0);
    const spentTotal = events.reduce((sum, ev) => sum + (ev.points < 0 ? Math.abs(ev.points) : 0), 0);

    res.json({
      ok: true,
      customer: {
        id: customer.id,
        fullName: customer.full_name,
        email: customer.email,
        phone: customer.phone,
        rewardPoints: Number(customer.reward_points) || 0,
      },
      summary: {
        balance: Number(customer.reward_points) || 0,
        earnedTotal,
        spentTotal,
        eventCount: events.length,
      },
      events,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load reward point history' });
  }
});

async function deleteCustomerAccount(userId) {
  const rows = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!rows.length) return { ok: false, error: 'not_found' };

  await query('UPDATE orders SET user_id = NULL WHERE user_id = ?', [userId]).catch(() => {});
  await query('UPDATE product_reviews SET user_id = NULL WHERE user_id = ?', [userId]).catch(() => {});
  await query('UPDATE users SET referred_by_user_id = NULL WHERE referred_by_user_id = ?', [userId]).catch(
    () => {}
  );
  await query('DELETE FROM reward_point_events WHERE user_id = ?', [userId]).catch(() => {});
  await query('DELETE FROM user_addresses WHERE user_id = ?', [userId]).catch(() => {});
  await query('DELETE FROM users WHERE id = ?', [userId]);
  return { ok: true };
}

router.post('/customers/bulk-delete', requireAdmin, async (req, res) => {
  try {
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Boolean))];
    if (!ids.length) return res.status(400).json({ ok: false, error: 'No customers selected' });

    let deleted = 0;
    let notFound = 0;
    for (const userId of ids) {
      const result = await deleteCustomerAccount(userId);
      if (result.ok) deleted += 1;
      else if (result.error === 'not_found') notFound += 1;
    }

    if (!deleted) {
      return res.status(400).json({
        ok: false,
        error: notFound ? 'Selected customers were not found' : 'Could not delete selected customers',
      });
    }

    res.json({ ok: true, deleted, notFound });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not delete selected customers' });
  }
});

router.delete('/customers/:id', requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ ok: false, error: 'Invalid customer' });

    const result = await deleteCustomerAccount(userId);
    if (!result.ok) {
      return res.status(404).json({ ok: false, error: 'Customer not found' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not delete customer' });
  }
});

// ——— Coupons ———
router.get('/coupons', requireAdmin, async (req, res) => {
  try {
    const coupons = await query('SELECT * FROM coupons ORDER BY id DESC');
    res.json({ ok: true, coupons });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load coupons' });
  }
});

router.post('/coupons', requireAdmin, async (req, res) => {
  try {
    const { code, discountType, discountValue, minOrder, usageLimit, expiresAt, isActive } = req.body;
    await query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order, usage_limit, expires_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        code.toUpperCase(),
        discountType || 'percent',
        discountValue,
        minOrder || 0,
        usageLimit || null,
        expiresAt || null,
        isActive !== false ? 1 : 0,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not create coupon' });
  }
});

router.post('/coupons/bulk-delete', requireAdmin, async (req, res) => {
  try {
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Boolean))];
    if (!ids.length) return res.status(400).json({ ok: false, error: 'No coupons selected' });
    const placeholders = ids.map(() => '?').join(',');
    await query(`DELETE FROM coupons WHERE id IN (${placeholders})`, ids);
    res.json({ ok: true, deleted: ids.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not delete selected coupons' });
  }
});

router.delete('/coupons/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM coupons WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not delete coupon' });
  }
});

// ——— Hero side slider (homepage) ———
router.put('/hero-side-slider', requireAdmin, async (req, res) => {
  try {
    const { enabled, slides, intervalMs } = req.body;
    if (enabled != null) {
      await query(upsertSiteSettingSql(), [
        'hero_side_slider_enabled',
        enabled === false || enabled === '0' ? '0' : '1',
      ]);
    }
    if (slides != null) {
      const cleaned = (Array.isArray(slides) ? slides : [])
        .map((s) => ({
          image: String(s?.image || s?.imageUrl || '').trim(),
          link: String(s?.link || s?.linkUrl || '').trim(),
          alt: String(s?.alt || s?.title || '').trim(),
        }))
        .filter((s) => s.image);
      await query(upsertSiteSettingSql(), ['hero_side_slides', JSON.stringify(cleaned)]);
    }
    if (intervalMs != null) {
      const ms = Math.max(2500, Math.min(12000, Number(intervalMs) || 4500));
      await query(upsertSiteSettingSql(), ['hero_side_slider_interval', String(ms)]);
    }
    clearSiteSettingsCache();
    clearStoreBootstrapCache();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not save hero slider' });
  }
});

// ——— Today Deals (homepage section) ———
router.put('/today-deals', requireAdmin, async (req, res) => {
  try {
    const { enabled, title, endsAt, productIds } = req.body;
    if (enabled != null) {
      await query(upsertSiteSettingSql(), [
        'today_deals_enabled',
        enabled === false || enabled === '0' ? '0' : '1',
      ]);
    }
    if (title != null) {
      await query(upsertSiteSettingSql(), [
        'today_deals_title',
        String(title).trim() || 'Today Deals',
      ]);
    }
    if (endsAt != null) {
      const raw = String(endsAt || '').trim();
      let value = '';
      if (raw) {
        const ms = Date.parse(raw);
        value = Number.isFinite(ms) ? new Date(ms).toISOString() : '';
      }
      await query(upsertSiteSettingSql(), ['today_deals_ends_at', value]);
    }
    if (productIds != null) {
      const ids = (Array.isArray(productIds) ? productIds : [])
        .map((id) => Number(id))
        .filter((id) => id > 0)
        .slice(0, 12);
      await query(upsertSiteSettingSql(), ['today_deals_product_ids', JSON.stringify(ids)]);
    }
    clearSiteSettingsCache();
    clearStoreBootstrapCache();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not save Today Deals' });
  }
});

// ——— Today Selling (legacy — kept for old admin clients) ———
router.put('/today-selling', requireAdmin, async (req, res) => {
  try {
    const { enabled, title, product1 } = req.body;
    if (enabled != null) {
      await query(upsertSiteSettingSql(), ['today_selling_enabled', enabled === false || enabled === '0' ? '0' : '1']);
    }
    if (title != null) {
      await query(upsertSiteSettingSql(), ['today_selling_title', String(title).trim() || 'Today Selling']);
    }
    await setTodaySellingProducts(query, product1 || null);
    clearSiteSettingsCache();
    clearStoreBootstrapCache();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not save Today Selling' });
  }
});

// ——— Settings ———
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = sanitizeSmtpForAdminResponse(await getSettingsMap());
    res.json({ ok: true, settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load settings' });
  }
});

router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = req.body.settings || req.body;
    let smtpPasswordSaved = false;
    for (const [key, value] of Object.entries(settings)) {
      if (key === 'smtp_pass_set') continue;
      if (key === 'smtp_pass' && !String(value).trim()) continue;
      let next = String(value);
      if (key === 'site_url') next = normalizeSiteBaseUrl(next);
      await query(upsertSiteSettingSql(), [key, next]);
      if (key === 'smtp_pass') smtpPasswordSaved = true;
    }
    if (smtpPasswordSaved) {
      await query(upsertSiteSettingSql(), ['smtp_pass_set', '1']);
    }
    clearSiteSettingsCache();
    clearStoreBootstrapCache();
    const updated = sanitizeSmtpForAdminResponse(await getSettingsMap());
    res.json({ ok: true, settings: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not save settings' });
  }
});

const SMTP_PERSIST_KEYS = [
  'notify_email',
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_pass',
  'feature_email_notify',
];

async function persistSmtpSettings(settings) {
  for (const key of SMTP_PERSIST_KEYS) {
    if (key === 'smtp_pass' && !String(settings.smtp_pass || '').trim()) continue;
    if (settings[key] == null) continue;
    await query(upsertSiteSettingSql(), [key, String(settings[key])]);
  }
  if (String(settings.smtp_pass || '').trim()) {
    await query(upsertSiteSettingSql(), ['smtp_pass_set', '1']);
  }
  clearSiteSettingsCache();
}

router.post('/settings/test-email', requireAdmin, async (req, res) => {
  try {
    const incoming = req.body?.settings || {};
    const saved = await loadNotifySettings(query);
    const merged = { ...saved, ...incoming };
    if (!String(incoming.smtp_pass || '').trim() && saved.smtp_pass) {
      merged.smtp_pass = saved.smtp_pass;
    }

    const siteName = merged.site_name || 'RakuShopBD';
    const result = await sendAdminEmail(merged, {
      subject: `[${siteName}] Test email notification`,
      text: `This is a test email from ${siteName} admin panel.\n\nIf you received this, SMTP is configured correctly.`,
      html: `<p>This is a test email from <strong>${siteName}</strong> admin panel.</p><p>If you received this, SMTP is configured correctly.</p>`,
    });

    if (result.skipped) {
      const msg =
        result.reason === 'disabled'
          ? 'Email notifications are turned off. Enable "Email notifications" first.'
          : 'SMTP is not configured. Enter SMTP user and App Password, then save.';
      return res.status(400).json({ ok: false, error: msg });
    }

    await persistSmtpSettings(merged);

    const updated = sanitizeSmtpForAdminResponse(await getSettingsMap());
    res.json({
      ok: true,
      to: result.to,
      saved: true,
      settings: updated,
      message: `Test email sent to ${result.to}. SMTP settings saved — order alerts will work now.`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message || 'Could not send test email' });
  }
});

require('./adminExtended')(router, {
  query,
  formatPrice,
  slugify,
  requireAdmin,
  statusBadge,
});

module.exports = router;
