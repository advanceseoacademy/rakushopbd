const path = require('path');
const { upload } = require('../lib/upload');
const { sql: sqlDialect } = require('../lib/db-dialect');

module.exports = function registerExtendedAdminRoutes(router, deps) {
  const { query, formatPrice, slugify, requireAdmin, statusBadge } = deps;

  function paginate(page, limit) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(5, parseInt(limit, 10) || 20));
    return { page: p, limit: l, offset: (p - 1) * l };
  }

  // ——— Dashboard activity ———
  router.get('/activity', requireAdmin, async (req, res) => {
    try {
      const orders = await query(
        `SELECT order_number, customer_name, created_at FROM orders ORDER BY created_at DESC LIMIT 5`
      );
      const users = await query(
        `SELECT full_name, created_at FROM users ORDER BY created_at DESC LIMIT 3`
      );
      const lowStock = await query(
        `SELECT name_bn, stock FROM products WHERE stock <= 5 ORDER BY stock ASC LIMIT 3`
      );
      const reviews = await query(
        `SELECT customer_name, created_at FROM product_reviews WHERE status = 'pending' ORDER BY created_at DESC LIMIT 3`
      ).catch(() => []);
      let contacts = [];
      try {
        const { ensureContactMessagesTable } = require('../lib/ensureContactMessagesTable');
        await ensureContactMessagesTable();
        contacts = await query(
          `SELECT customer_name, subject, created_at FROM contact_messages WHERE status = 'new' ORDER BY created_at DESC LIMIT 3`
        );
      } catch (_) {}

      const items = [];
      orders.forEach((o) =>
        items.push({
          type: 'order',
          text: `New order ${o.order_number} from ${o.customer_name}`,
          time: o.created_at,
        })
      );
      users.forEach((u) =>
        items.push({ type: 'user', text: `New customer registered: ${u.full_name}`, time: u.created_at })
      );
      lowStock.forEach((p) =>
        items.push({ type: 'alert', text: `Low stock: ${p.name_bn} (${p.stock} left)`, time: new Date() })
      );
      reviews.forEach((r) =>
        items.push({ type: 'review', text: `Review pending from ${r.customer_name}`, time: r.created_at })
      );
      contacts.forEach((c) =>
        items.push({
          type: 'contact',
          text: `Contact message from ${c.customer_name} — ${c.subject || 'general'}`,
          time: c.created_at,
        })
      );
      items.sort((a, b) => new Date(b.time) - new Date(a.time));
      res.json({ ok: true, activity: items.slice(0, 10) });
    } catch (err) {
      console.error(err);
      res.json({ ok: true, activity: [] });
    }
  });

  // ——— Analytics ———
  router.get('/analytics', requireAdmin, async (req, res) => {
    try {
      const [{ monthOrders }] = await query(
        `SELECT COUNT(*) AS monthOrders FROM orders WHERE ${sqlDialect.ordersThisMonth()}`
      );
      const [{ monthCustomers }] = await query(
        `SELECT COUNT(*) AS monthCustomers FROM users WHERE ${sqlDialect.ordersThisMonth()}`
      ).catch(() => [{ monthCustomers: 0 }]);
      const [{ avgOrder }] = await query(
        `SELECT COALESCE(AVG(total),0) AS avgOrder FROM orders WHERE status != 'cancelled'`
      );
      const topProducts = await query(
        `SELECT oi.product_name, SUM(oi.quantity) AS qty, SUM(oi.line_total) AS revenue
         FROM order_items oi JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
         GROUP BY oi.product_id, oi.product_name ORDER BY qty DESC LIMIT 10`
      );
      res.json({
        ok: true,
        stats: {
          monthOrders,
          monthCustomers: monthCustomers || 0,
          avgOrder: Number(avgOrder),
          avgOrderFormatted: formatPrice(avgOrder),
        },
        topProducts: topProducts.map((p, i) => ({
          rank: i + 1,
          name: p.product_name,
          qty: p.qty,
          revenue: Number(p.revenue),
          revenueFormatted: formatPrice(p.revenue),
        })),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Could not load analytics' });
    }
  });

  // ——— Orders export & pagination ———
  router.get('/orders/export', requireAdmin, async (req, res) => {
    try {
      const orders = await query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5000');
      const header = 'Order ID,Customer,Phone,Payment,Status,Total,Date\n';
      const rows = orders
        .map(
          (o) =>
            `"${o.order_number}","${o.customer_name}","${o.customer_phone}","${o.payment_method}","${o.status}",${o.total},"${o.created_at}"`
        )
        .join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
      res.send(header + rows);
    } catch (err) {
      res.status(500).send('Export failed');
    }
  });

  // ——— Customers stats & export ———
  router.get('/customers/stats', requireAdmin, async (req, res) => {
    try {
      const [{ total }] = await query('SELECT COUNT(*) AS total FROM users').catch(() => [{ total: 0 }]);
      const [{ monthNew }] = await query(
        `SELECT COUNT(*) AS monthNew FROM users WHERE ${sqlDialect.ordersThisMonth()}`
      ).catch(() => [{ monthNew: 0 }]);
      const [{ avgSpent }] = await query(
        `SELECT COALESCE(AVG(t.spent),0) AS avgSpent FROM (
          SELECT SUM(total) AS spent FROM orders WHERE status!='cancelled' AND user_id IS NOT NULL GROUP BY user_id
        ) t`
      ).catch(() => [{ avgSpent: 0 }]);
      res.json({
        ok: true,
        stats: { total, monthNew, avgSpent: Number(avgSpent), avgSpentFormatted: formatPrice(avgSpent) },
      });
    } catch (err) {
      res.json({ ok: true, stats: { total: 0, monthNew: 0, avgSpent: 0, avgSpentFormatted: '৳0' } });
    }
  });

  router.get('/customers/export', requireAdmin, async (req, res) => {
    try {
      const customers = await query(
        'SELECT full_name, email, phone, created_at FROM users ORDER BY created_at DESC'
      );
      const header = 'Name,Email,Phone,Joined\n';
      const rows = customers
        .map((c) => `"${c.full_name}","${c.email}","${c.phone}","${c.created_at}"`)
        .join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customers.csv');
      res.send(header + rows);
    } catch (err) {
      res.status(500).send('Export failed');
    }
  });

  // ——— Reviews ———
  router.get('/reviews', requireAdmin, async (req, res) => {
    try {
      const { status } = req.query;
      let sql = `SELECT r.*, p.name_bn AS product_name FROM product_reviews r
        JOIN products p ON p.id = r.product_id WHERE 1=1`;
      const params = [];
      if (status && status !== 'all') {
        sql += ' AND r.status = ?';
        params.push(status);
      }
      sql += ' ORDER BY r.created_at DESC LIMIT 200';
      const reviews = await query(sql, params);
      const [{ pending }] = await query(
        "SELECT COUNT(*) AS pending FROM product_reviews WHERE status='pending'"
      ).catch(() => [{ pending: 0 }]);
      res.json({ ok: true, reviews, pendingCount: pending });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Reviews table missing — run db setup' });
    }
  });

  router.patch('/reviews/:id', requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      if (!['approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ ok: false, error: 'Invalid status' });
      }
      await query('UPDATE product_reviews SET status = ? WHERE id = ?', [status, req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not update review' });
    }
  });

  router.delete('/reviews/:id', requireAdmin, async (req, res) => {
    try {
      await query('DELETE FROM product_reviews WHERE id = ?', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not delete review' });
    }
  });

  // ——— Banners ———
  router.get('/banners', requireAdmin, async (req, res) => {
    try {
      const banners = await query('SELECT * FROM banners ORDER BY sort_order, id');
      res.json({ ok: true, banners });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Banners table missing' });
    }
  });

  router.post('/banners', requireAdmin, async (req, res) => {
    try {
      const { title, position, linkUrl, bgGradient, expiresAt, isActive, sortOrder, imageUrl } = req.body;
      await query(
        `INSERT INTO banners (title, position, link_url, bg_gradient, expires_at, is_active, sort_order, image_url)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          title,
          position || 'hero',
          linkUrl || '/',
          bgGradient || 'linear-gradient(135deg,#2d8a2d,#164816)',
          expiresAt || null,
          isActive !== false ? 1 : 0,
          sortOrder || 0,
          imageUrl || null,
        ]
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not create banner' });
    }
  });

  router.put('/banners/:id', requireAdmin, async (req, res) => {
    try {
      const { title, position, linkUrl, bgGradient, expiresAt, isActive, sortOrder, imageUrl } = req.body;
      await query(
        `UPDATE banners SET title=?, position=?, link_url=?, bg_gradient=?, expires_at=?, is_active=?, sort_order=?, image_url=? WHERE id=?`,
        [
          title,
          position,
          linkUrl,
          bgGradient,
          expiresAt || null,
          isActive ? 1 : 0,
          sortOrder || 0,
          imageUrl || null,
          req.params.id,
        ]
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not update banner' });
    }
  });

  router.delete('/banners/:id', requireAdmin, async (req, res) => {
    try {
      await query('DELETE FROM banners WHERE id = ?', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not delete banner' });
    }
  });

  router.post('/upload', requireAdmin, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });
    const url = '/uploads/' + req.file.filename;
    res.json({ ok: true, url });
  });

  // ——— Coupon update ———
  router.put('/coupons/:id', requireAdmin, async (req, res) => {
    try {
      const { code, discountType, discountValue, minOrder, usageLimit, expiresAt, isActive } = req.body;
      await query(
        `UPDATE coupons SET code=?, discount_type=?, discount_value=?, min_order=?, usage_limit=?, expires_at=?, is_active=? WHERE id=?`,
        [
          code.toUpperCase(),
          discountType,
          discountValue,
          minOrder,
          usageLimit || null,
          expiresAt || null,
          isActive ? 1 : 0,
          req.params.id,
        ]
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not update coupon' });
    }
  });

  // ——— Appointments ———
  router.get('/appointments', requireAdmin, async (req, res) => {
    try {
      const { ensureAppointmentsTable } = require('../lib/ensureAppointmentsTable');
      const { serviceLabel } = require('../lib/appointments');
      await ensureAppointmentsTable();

      const { page, limit, status, search } = req.query;
      const { page: p, limit: l, offset } = paginate(page, limit);
      const where = [];
      const params = [];

      if (status && status !== 'all') {
        where.push('status = ?');
        params.push(status);
      }
      if (search && String(search).trim()) {
        const q = `%${String(search).trim()}%`;
        where.push(
          `(reference_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR notes LIKE ?)`
        );
        params.push(q, q, q, q);
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = (
        await query(`SELECT COUNT(*) AS c FROM appointments ${whereSql}`, params)
      )[0];
      const totalN = Number(total?.c ?? total?.count ?? Object.values(total || {})[0]) || 0;

      const rows = await query(
        `SELECT * FROM appointments ${whereSql}
         ORDER BY appointment_date ASC, created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, l, offset]
      );

      const pendingRows = await query(
        `SELECT COUNT(*) AS c FROM appointments WHERE status = 'pending'`
      );
      const pendingCount =
        Number(pendingRows[0]?.c ?? Object.values(pendingRows[0] || {})[0]) || 0;

      res.json({
        ok: true,
        appointments: rows.map((r) => ({
          id: r.id,
          referenceNumber: r.reference_number || r.referenceNumber,
          customerName: r.customer_name || r.customerName,
          customerPhone: r.customer_phone || r.customerPhone,
          customerEmail: r.customer_email || r.customerEmail,
          appointmentDate: r.appointment_date || r.appointmentDate,
          appointmentTime: r.appointment_time || r.appointmentTime,
          serviceType: r.service_type || r.serviceType,
          serviceLabel: serviceLabel(r.service_type || r.serviceType),
          notes: r.notes,
          status: r.status,
          createdAt: r.created_at || r.createdAt,
        })),
        pagination: {
          page: p,
          limit: l,
          total: totalN,
          pages: Math.max(1, Math.ceil(totalN / l)),
        },
        pendingCount,
      });
    } catch (err) {
      console.error('admin appointments', err);
      res.status(500).json({ ok: false, error: 'Could not load appointments' });
    }
  });

  router.patch('/appointments/:id', requireAdmin, async (req, res) => {
    try {
      const { ensureAppointmentsTable } = require('../lib/ensureAppointmentsTable');
      await ensureAppointmentsTable();
      const status = String(req.body?.status || '').trim();
      const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
      if (!allowed.includes(status)) {
        return res.status(400).json({ ok: false, error: 'Invalid status' });
      }
      await query('UPDATE appointments SET status = ? WHERE id = ?', [status, req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      console.error('admin appointment patch', err);
      res.status(500).json({ ok: false, error: 'Could not update appointment' });
    }
  });

  router.delete('/appointments/:id', requireAdmin, async (req, res) => {
    try {
      const { ensureAppointmentsTable } = require('../lib/ensureAppointmentsTable');
      await ensureAppointmentsTable();
      await query('DELETE FROM appointments WHERE id = ?', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not delete appointment' });
    }
  });

  // ——— FAQ ———
  router.get('/faqs', requireAdmin, async (req, res) => {
    try {
      const { ensureFaqsTable } = require('../lib/ensureFaqsTable');
      const { faqToPublic } = require('../lib/faqs');
      await ensureFaqsTable();
      const rows = await query('SELECT * FROM faqs ORDER BY sort_order ASC, id ASC');
      res.json({ ok: true, faqs: rows.map(faqToPublic) });
    } catch (err) {
      console.error('admin faqs GET', err);
      res.status(500).json({ ok: false, error: 'Could not load FAQs' });
    }
  });

  router.post('/faqs', requireAdmin, async (req, res) => {
    try {
      const { ensureFaqsTable } = require('../lib/ensureFaqsTable');
      await ensureFaqsTable();
      const question = String(req.body?.question || '').trim().slice(0, 500);
      const answer = String(req.body?.answer || '').trim().slice(0, 8000);
      const sortOrder = Number(req.body?.sortOrder) || 0;
      const isActive = req.body?.isActive !== false;
      if (!question) return res.status(400).json({ ok: false, error: 'Question is required' });
      if (!answer) return res.status(400).json({ ok: false, error: 'Answer is required' });
      await query(
        'INSERT INTO faqs (question, answer, sort_order, is_active) VALUES (?, ?, ?, ?)',
        [question, answer, sortOrder, isActive ? 1 : 0]
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('admin faqs POST', err);
      res.status(500).json({ ok: false, error: 'Could not create FAQ' });
    }
  });

  router.put('/faqs/:id', requireAdmin, async (req, res) => {
    try {
      const { ensureFaqsTable } = require('../lib/ensureFaqsTable');
      await ensureFaqsTable();
      const question = String(req.body?.question || '').trim().slice(0, 500);
      const answer = String(req.body?.answer || '').trim().slice(0, 8000);
      const sortOrder = Number(req.body?.sortOrder) || 0;
      const isActive = req.body?.isActive !== false;
      if (!question) return res.status(400).json({ ok: false, error: 'Question is required' });
      if (!answer) return res.status(400).json({ ok: false, error: 'Answer is required' });
      await query(
        'UPDATE faqs SET question = ?, answer = ?, sort_order = ?, is_active = ? WHERE id = ?',
        [question, answer, sortOrder, isActive ? 1 : 0, req.params.id]
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('admin faqs PUT', err);
      res.status(500).json({ ok: false, error: 'Could not update FAQ' });
    }
  });

  router.delete('/faqs/:id', requireAdmin, async (req, res) => {
    try {
      const { ensureFaqsTable } = require('../lib/ensureFaqsTable');
      await ensureFaqsTable();
      await query('DELETE FROM faqs WHERE id = ?', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not delete FAQ' });
    }
  });

  // ——— Contact messages ———
  router.get('/contact-messages', requireAdmin, async (req, res) => {
    try {
      const { ensureContactMessagesTable } = require('../lib/ensureContactMessagesTable');
      const { contactToPublic } = require('../lib/contactMessages');
      await ensureContactMessagesTable();

      const { page, limit, status, search } = req.query;
      const { page: p, limit: l, offset } = paginate(page, limit);
      const where = [];
      const params = [];

      if (status && status !== 'all') {
        where.push('status = ?');
        params.push(status);
      }
      if (search && String(search).trim()) {
        const q = `%${String(search).trim()}%`;
        where.push(
          `(customer_name LIKE ? OR customer_phone LIKE ? OR customer_email LIKE ? OR subject LIKE ? OR message LIKE ?)`
        );
        params.push(q, q, q, q, q);
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = (
        await query(`SELECT COUNT(*) AS c FROM contact_messages ${whereSql}`, params)
      )[0];
      const totalN = Number(total?.c ?? total?.count ?? Object.values(total || {})[0]) || 0;

      const rows = await query(
        `SELECT * FROM contact_messages ${whereSql}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, l, offset]
      );

      const newRows = await query(
        `SELECT COUNT(*) AS c FROM contact_messages WHERE status = 'new'`
      );
      const newCount = Number(newRows[0]?.c ?? Object.values(newRows[0] || {})[0]) || 0;

      res.json({
        ok: true,
        messages: rows.map(contactToPublic),
        pagination: {
          page: p,
          limit: l,
          total: totalN,
          pages: Math.max(1, Math.ceil(totalN / l)),
        },
        newCount,
      });
    } catch (err) {
      console.error('admin contact messages', err);
      res.status(500).json({ ok: false, error: 'Could not load contact messages' });
    }
  });

  router.patch('/contact-messages/:id', requireAdmin, async (req, res) => {
    try {
      const { ensureContactMessagesTable } = require('../lib/ensureContactMessagesTable');
      await ensureContactMessagesTable();
      const status = String(req.body?.status || '').trim();
      const allowed = ['new', 'read', 'replied', 'archived'];
      if (!allowed.includes(status)) {
        return res.status(400).json({ ok: false, error: 'Invalid status' });
      }
      await query('UPDATE contact_messages SET status = ? WHERE id = ?', [status, req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      console.error('admin contact message patch', err);
      res.status(500).json({ ok: false, error: 'Could not update message' });
    }
  });

  router.delete('/contact-messages/:id', requireAdmin, async (req, res) => {
    try {
      const { ensureContactMessagesTable } = require('../lib/ensureContactMessagesTable');
      await ensureContactMessagesTable();
      await query('DELETE FROM contact_messages WHERE id = ?', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not delete message' });
    }
  });

  // ——— Phone subscribers (marketing) ———
  router.get('/phone-subscribers', requireAdmin, async (req, res) => {
    try {
      const { ensurePhoneSubscribersTable } = require('../lib/ensurePhoneSubscribersTable');
      const { subscriberToPublic } = require('../lib/phoneSubscribers');
      await ensurePhoneSubscribersTable();

      const { page, limit, status, search } = req.query;
      const { page: p, limit: l, offset } = paginate(page, limit);
      const where = [];
      const params = [];

      if (status && status !== 'all') {
        where.push('status = ?');
        params.push(status);
      }
      if (search && String(search).trim()) {
        const q = `%${String(search).trim()}%`;
        where.push('customer_phone LIKE ?');
        params.push(q);
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = (
        await query(`SELECT COUNT(*) AS c FROM phone_subscribers ${whereSql}`, params)
      )[0];
      const totalN = Number(total?.c ?? total?.count ?? Object.values(total || {})[0]) || 0;

      const rows = await query(
        `SELECT * FROM phone_subscribers ${whereSql}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, l, offset]
      );

      const newRows = await query(
        `SELECT COUNT(*) AS c FROM phone_subscribers WHERE status = 'new'`
      );
      const newCount = Number(newRows[0]?.c ?? Object.values(newRows[0] || {})[0]) || 0;

      res.json({
        ok: true,
        subscribers: rows.map(subscriberToPublic),
        pagination: {
          page: p,
          limit: l,
          total: totalN,
          pages: Math.max(1, Math.ceil(totalN / l)),
        },
        newCount,
      });
    } catch (err) {
      console.error('admin phone subscribers', err);
      res.status(500).json({ ok: false, error: 'Could not load subscribers' });
    }
  });

  router.patch('/phone-subscribers/:id', requireAdmin, async (req, res) => {
    try {
      const { ensurePhoneSubscribersTable } = require('../lib/ensurePhoneSubscribersTable');
      await ensurePhoneSubscribersTable();
      const status = String(req.body?.status || '').trim();
      const allowed = ['new', 'read', 'archived'];
      if (!allowed.includes(status)) {
        return res.status(400).json({ ok: false, error: 'Invalid status' });
      }
      await query('UPDATE phone_subscribers SET status = ? WHERE id = ?', [status, req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not update subscriber' });
    }
  });

  router.delete('/phone-subscribers/:id', requireAdmin, async (req, res) => {
    try {
      const { ensurePhoneSubscribersTable } = require('../lib/ensurePhoneSubscribersTable');
      await ensurePhoneSubscribersTable();
      await query('DELETE FROM phone_subscribers WHERE id = ?', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not delete subscriber' });
    }
  });

};
