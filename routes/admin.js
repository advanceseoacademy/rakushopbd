const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { formatPrice } = require('../lib/format');
const { slugify } = require('../lib/slugify');
const { clearSiteSettingsCache } = require('../lib/siteSettings');
const { requireAdmin } = require('../middleware/requireAdmin');
const { saveSession } = require('../lib/sessionSave');
const { signAdminToken, getAdminIdFromRequest } = require('../lib/adminToken');

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
    res.json({ ok: true, adminCount: Number(row.adminCount) || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Database error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Username and password required' });
    }
    const rows = await query(
      'SELECT id, username, email, full_name, password_hash FROM admins WHERE username = ? OR email = ? LIMIT 1',
      [username.trim(), username.trim()]
    );
    if (!rows.length) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

    req.session.adminId = admin.id;
    const payload = {
      ok: true,
      token: signAdminToken(admin.id),
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        fullName: admin.full_name,
      },
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
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  const adminId = getAdminIdFromRequest(req);
  if (!adminId) return res.json({ ok: true, admin: null });
  const rows = await query(
    'SELECT id, username, email, full_name FROM admins WHERE id = ?',
    [adminId]
  );
  if (!rows.length) {
    req.session = null;
    return res.json({ ok: true, admin: null });
  }
  const a = rows[0];
  res.json({
    ok: true,
    admin: { id: a.id, username: a.username, email: a.email, fullName: a.full_name },
  });
});

// ——— Dashboard ———
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const [{ totalOrders }] = await query('SELECT COUNT(*) AS totalOrders FROM orders');
    const [{ pendingOrders }] = await query(
      "SELECT COUNT(*) AS pendingOrders FROM orders WHERE status IN ('pending','confirmed')"
    );
    const [{ totalRevenue }] = await query(
      "SELECT COALESCE(SUM(total),0) AS totalRevenue FROM orders WHERE status != 'cancelled'"
    );
    const [{ monthRevenue }] = await query(
      `SELECT COALESCE(SUM(total),0) AS monthRevenue FROM orders
       WHERE status != 'cancelled' AND MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())`
    );
    const [{ totalProducts }] = await query('SELECT COUNT(*) AS totalProducts FROM products');
    const [{ lowStock }] = await query('SELECT COUNT(*) AS lowStock FROM products WHERE stock <= 5');
    let totalCustomers = 0;
    try {
      const [{ cnt }] = await query('SELECT COUNT(*) AS cnt FROM users');
      totalCustomers = cnt;
    } catch (_) {}

    const recentOrders = await query(
      `SELECT o.id, o.order_number, o.customer_name, o.total, o.status, o.created_at,
        (SELECT GROUP_CONCAT(oi.product_name SEPARATOR ', ') FROM order_items oi WHERE oi.order_id = o.id LIMIT 2) AS items_preview
       FROM orders o ORDER BY o.created_at DESC LIMIT 8`
    );

    const statusBreakdown = await query(
      `SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status`
    );

    const monthlyRevenue = await query(
      `SELECT MONTH(created_at) AS m, COALESCE(SUM(total),0) AS revenue
       FROM orders WHERE status != 'cancelled' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY YEAR(created_at), MONTH(created_at) ORDER BY YEAR(created_at), MONTH(created_at)`
    );

    let activity = [];
    try {
      const actRes = await query(
        `SELECT order_number, customer_name, created_at, 'order' AS type FROM orders ORDER BY created_at DESC LIMIT 5`
      );
      activity = actRes.map((a) => ({
        type: 'order',
        text: `New order ${a.order_number} from ${a.customer_name}`,
        time: a.created_at,
      }));
    } catch (_) {}

    res.json({
      ok: true,
      activity,
      stats: {
        totalOrders,
        pendingOrders,
        totalRevenue: Number(totalRevenue),
        totalRevenueFormatted: formatPrice(totalRevenue),
        monthRevenue: Number(monthRevenue),
        monthRevenueFormatted: formatPrice(monthRevenue),
        totalProducts,
        lowStock,
        totalCustomers: Number(totalCustomers),
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        customerName: o.customer_name,
        itemsPreview: o.items_preview || '—',
        total: Number(o.total),
        totalFormatted: formatPrice(o.total),
        status: o.status,
        statusBadge: statusBadge(o.status),
        createdAt: o.created_at,
      })),
      statusBreakdown,
      monthlyRevenue: monthlyRevenue.map((r) => ({
        month: r.m,
        revenue: Number(r.revenue),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load dashboard' });
  }
});

// ——— Orders ———
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
    const items = await query('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
    res.json({
      ok: true,
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
    await query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not update order' });
  }
});

// ——— Products ———
router.get('/products', requireAdmin, async (req, res) => {
  try {
    const { category, search } = req.query;
    let sql = `
      SELECT p.*, c.name_bn AS category_name, c.slug AS category_slug
      FROM products p JOIN categories c ON c.id = p.category_id WHERE 1=1`;
    const params = [];
    if (category && category !== 'all') {
      sql += ' AND c.slug = ?';
      params.push(category);
    }
    if (search) {
      sql += ' AND (p.name_bn LIKE ? OR p.slug LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q);
    }
    sql += ' ORDER BY p.id DESC';
    const products = await query(sql, params);
    res.json({ ok: true, products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load products' });
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
      icon,
      iconColor,
      bgColor,
      tagType,
      tagText,
      discountPercent,
      isFeatured,
      sku,
      imageUrl,
    } = req.body;
    if (!name || !categoryId || price == null) {
      return res.status(400).json({ ok: false, error: 'Name, category and price are required' });
    }
    let slug = slugify(name);
    const existing = await query('SELECT id FROM products WHERE slug = ?', [slug]);
    if (existing.length) slug = `${slug}-${Date.now()}`;

    const result = await query(
      `INSERT INTO products (category_id, slug, sku, name_bn, description_bn, price, old_price, stock,
        icon, icon_color, bg_color, image_url, tag_type, tag_text, discount_percent, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        categoryId,
        slug,
        sku || null,
        name,
        description || null,
        price,
        oldPrice || null,
        stock ?? 100,
        icon || 'ti-package',
        iconColor || '#2d8a2d',
        bgColor || '#e8f5e8',
        imageUrl || null,
        tagType || 'none',
        tagText || null,
        discountPercent || null,
        isFeatured ? 1 : 0,
      ]
    );
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not create product' });
  }
});

router.put('/products/:id', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      categoryId,
      price,
      oldPrice,
      stock,
      description,
      icon,
      iconColor,
      bgColor,
      tagType,
      tagText,
      discountPercent,
      isFeatured,
      sku,
      imageUrl,
    } = req.body;
    await query(
      `UPDATE products SET category_id=?, sku=?, name_bn=?, description_bn=?, price=?, old_price=?, stock=?,
        icon=?, icon_color=?, bg_color=?, image_url=?, tag_type=?, tag_text=?, discount_percent=?, is_featured=?
       WHERE id=?`,
      [
        categoryId,
        sku || null,
        name,
        description || null,
        price,
        oldPrice || null,
        stock ?? 0,
        icon || 'ti-package',
        iconColor || '#2d8a2d',
        bgColor || '#e8f5e8',
        imageUrl || null,
        tagType || 'none',
        tagText || null,
        discountPercent || null,
        isFeatured ? 1 : 0,
        req.params.id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not update product' });
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
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not delete product' });
  }
});

// ——— Categories ———
router.get('/categories', requireAdmin, async (req, res) => {
  try {
    const categories = await query(
      `SELECT c.*, COUNT(p.id) AS product_count
       FROM categories c LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id ORDER BY c.sort_order, c.id`
    );
    res.json({ ok: true, categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load categories' });
  }
});

router.post('/categories', requireAdmin, async (req, res) => {
  try {
    const { name, slug, icon, sortOrder } = req.body;
    if (!name) return res.status(400).json({ ok: false, error: 'Name required' });
    const s = slug || slugify(name);
    await query(
      'INSERT INTO categories (slug, name_bn, icon, sort_order) VALUES (?, ?, ?, ?)',
      [s, name, icon || 'ti-category', sortOrder || 0]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not create category' });
  }
});

router.put('/categories/:id', requireAdmin, async (req, res) => {
  try {
    const { name, slug, icon, sortOrder } = req.body;
    await query(
      'UPDATE categories SET slug=?, name_bn=?, icon=?, sort_order=? WHERE id=?',
      [slug, name, icon || 'ti-category', sortOrder || 0, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not update category' });
  }
});

router.delete('/categories/:id', requireAdmin, async (req, res) => {
  try {
    const prods = await query('SELECT id FROM products WHERE category_id = ? LIMIT 1', [req.params.id]);
    if (prods.length) {
      return res.status(400).json({ ok: false, error: 'Category has products' });
    }
    await query('DELETE FROM categories WHERE id = ?', [req.params.id]);
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

router.delete('/coupons/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM coupons WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not delete coupon' });
  }
});

// ——— Settings ———
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await getSettingsMap();
    res.json({ ok: true, settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load settings' });
  }
});

router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = req.body.settings || req.body;
    for (const [key, value] of Object.entries(settings)) {
      await query(
        `INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, String(value)]
      );
    }
    clearSiteSettingsCache();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not save settings' });
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
