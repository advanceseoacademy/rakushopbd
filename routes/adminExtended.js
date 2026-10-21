const path = require('path');
const { brandGradient } = require('../lib/brandColors');
const { upload } = require('../lib/upload');
const { optimizeAndSaveImage } = require('../lib/imageOptimize');
const { sql: sqlDialect, likeFragment } = require('../lib/db-dialect');

module.exports = function registerExtendedAdminRoutes(router, deps) {
  const { query, formatPrice, slugify, requireAdmin, statusBadge } = deps;

  function paginate(page, limit) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(5, parseInt(limit, 10) || 20));
    return { page: p, limit: l, offset: (p - 1) * l };
  }

  async function countSql(sql, params = []) {
    const rows = await query(sql, params);
    if (!rows?.[0]) return 0;
    return Number(Object.values(rows[0])[0]) || 0;
  }

  function isViewedByAdmin(val) {
    return val === true || val === 1 || val === '1' || val === 't' || val === 'true';
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

  // ——— Visitor activity ———
  const { ensureVisitorEventsTable, RETENTION_DAYS } = require('../lib/visitorActivity');

  function col(row, snake) {
    if (!row) return undefined;
    if (row[snake] !== undefined) return row[snake];
    const camel = snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (row[camel] !== undefined) return row[camel];
    return row[snake.toLowerCase()];
  }

  function visitorRangeStart(range) {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    if (range === '1h') return new Date(now - hour);
    if (range === '24h') return new Date(now - 24 * hour);
    if (range === '7d') return new Date(now - 7 * 24 * hour);
    if (range === '30d') return new Date(now - 30 * 24 * hour);
    if (range === 'all') return new Date(now - RETENTION_DAYS * 24 * hour);
    const dhakaOffset = 6 * hour;
    const dhakaNow = new Date(now + dhakaOffset);
    dhakaNow.setUTCHours(0, 0, 0, 0);
    return new Date(dhakaNow.getTime() - dhakaOffset);
  }

  function describeDevice(ua) {
    const s = String(ua || '');
    let os = 'Unknown';
    if (/iPhone/i.test(s)) os = 'iPhone';
    else if (/iPad/i.test(s)) os = 'iPad';
    else if (/Android/i.test(s)) os = 'Android';
    else if (/Windows/i.test(s)) os = 'Windows';
    else if (/Mac OS X|Macintosh/i.test(s)) os = 'Mac';
    else if (/Linux/i.test(s)) os = 'Linux';
    let browser = 'Browser';
    if (/FBAN|FBAV|FB_IAB/i.test(s)) browser = 'Facebook app';
    else if (/Instagram/i.test(s)) browser = 'Instagram app';
    else if (/Edg\//i.test(s)) browser = 'Edge';
    else if (/OPR\/|Opera/i.test(s)) browser = 'Opera';
    else if (/SamsungBrowser/i.test(s)) browser = 'Samsung Internet';
    else if (/Firefox|FxiOS/i.test(s)) browser = 'Firefox';
    else if (/Chrome|CriOS/i.test(s)) browser = 'Chrome';
    else if (/Safari/i.test(s)) browser = 'Safari';
    const mobile = /Mobi|Android|iPhone|iPad/i.test(s);
    return { os, browser, mobile, label: `${os} · ${browser}` };
  }

  function describeSource(entryPath, referrer) {
    let params = null;
    try {
      params = new URL(entryPath || '/', 'http://x').searchParams;
    } catch (_) {
      params = null;
    }
    const utm = params?.get('utm_source');
    if (params?.get('fbclid')) return utm ? `Facebook (${utm})` : 'Facebook';
    if (params?.get('gclid')) return 'Google Ads';
    if (utm) return utm;
    if (referrer) {
      try {
        const host = new URL(referrer).hostname.replace(/^www\./, '').replace(/^(m|l|lm)\./, '');
        if (/facebook\.com|fb\.com/.test(host)) return 'Facebook';
        if (/instagram\.com/.test(host)) return 'Instagram';
        if (/google\./.test(host)) return 'Google';
        if (/youtube\.com/.test(host)) return 'YouTube';
        return host;
      } catch (_) {
        return 'Other';
      }
    }
    return 'Direct';
  }

  function parseMeta(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function inList(n) {
    return new Array(n).fill('?').join(',');
  }

  router.get('/visitors', requireAdmin, async (req, res) => {
    try {
      await ensureVisitorEventsTable();
      const range = String(req.query.range || 'today');
      const since = visitorRangeStart(range);
      const filter = String(req.query.filter || 'all');
      const q = String(req.query.q || '').trim().slice(0, 100);
      const { page, limit, offset } = paginate(req.query.page, req.query.limit || 30);

      const where = ['created_at >= ?'];
      const params = [since];
      if (q) {
        const like = `%${q}%`;
        where.push(`visitor_id IN (
          SELECT visitor_id FROM visitor_events
          WHERE created_at >= ? AND (
            visitor_id = ? OR ip = ? OR ${likeFragment('label')} OR ${likeFragment('meta')} OR ${likeFragment('path')}
            OR user_id IN (SELECT id FROM users WHERE ${likeFragment('full_name')} OR ${likeFragment('phone')} OR ${likeFragment('email')})
          ))`);
        params.push(since, q, q, like, like, like, like, like, like);
      }
      const having = [];
      if (filter === 'cart') having.push("SUM(CASE WHEN event = 'add_to_cart' THEN 1 ELSE 0 END) > 0");
      if (filter === 'checkout') having.push("SUM(CASE WHEN event = 'begin_checkout' THEN 1 ELSE 0 END) > 0");
      if (filter === 'ordered') having.push("SUM(CASE WHEN event = 'order_placed' THEN 1 ELSE 0 END) > 0");
      if (filter === 'abandoned') {
        having.push("SUM(CASE WHEN event = 'add_to_cart' THEN 1 ELSE 0 END) > 0");
        having.push("SUM(CASE WHEN event = 'order_placed' THEN 1 ELSE 0 END) = 0");
      }
      if (filter === 'members') having.push('MAX(user_id) IS NOT NULL');

      const grouped = `SELECT visitor_id,
          MIN(created_at) AS first_seen,
          MAX(created_at) AS last_seen,
          SUM(CASE WHEN event = 'page_view' THEN 1 ELSE 0 END) AS views,
          SUM(CASE WHEN event = 'add_to_cart' THEN 1 ELSE 0 END) AS carts,
          SUM(CASE WHEN event = 'begin_checkout' THEN 1 ELSE 0 END) AS checkouts,
          SUM(CASE WHEN event = 'order_placed' THEN 1 ELSE 0 END) AS orders,
          COUNT(*) AS total_events,
          MAX(user_id) AS user_id
        FROM visitor_events
        WHERE ${where.join(' AND ')}
        GROUP BY visitor_id
        ${having.length ? `HAVING ${having.join(' AND ')}` : ''}`;

      const [total, rows, statRows] = await Promise.all([
        countSql(`SELECT COUNT(*) AS cnt FROM (${grouped}) t`, params),
        query(`${grouped} ORDER BY MAX(created_at) DESC LIMIT ? OFFSET ?`, [...params, limit, offset]),
        query(
          `SELECT COUNT(DISTINCT visitor_id) AS visitors,
             SUM(CASE WHEN event = 'page_view' THEN 1 ELSE 0 END) AS views,
             SUM(CASE WHEN event = 'add_to_cart' THEN 1 ELSE 0 END) AS carts,
             SUM(CASE WHEN event = 'begin_checkout' THEN 1 ELSE 0 END) AS checkouts,
             SUM(CASE WHEN event = 'order_placed' THEN 1 ELSE 0 END) AS orders,
             COUNT(DISTINCT CASE WHEN created_at >= ? THEN visitor_id END) AS online
           FROM visitor_events WHERE created_at >= ?`,
          [new Date(Date.now() - 5 * 60 * 1000), since]
        ),
      ]);

      const vids = rows.map((r) => col(r, 'visitor_id'));
      const details = new Map(vids.map((v) => [v, {}]));
      if (vids.length) {
        const evRows = await query(
          `SELECT visitor_id, event, path, label, meta, referrer, ip, user_agent, created_at
           FROM visitor_events
           WHERE visitor_id IN (${inList(vids.length)}) AND created_at >= ?
             AND (event IN ('page_view', 'order_placed', 'register', 'login') OR referrer IS NOT NULL)
           ORDER BY created_at DESC LIMIT 5000`,
          [...vids, since]
        );
        for (const e of evRows) {
          const d = details.get(col(e, 'visitor_id'));
          if (!d) continue;
          const event = col(e, 'event');
          if (!d.ip) {
            d.ip = col(e, 'ip');
            d.userAgent = col(e, 'user_agent');
          }
          if (event === 'page_view') {
            if (!d.lastPath) {
              d.lastPath = col(e, 'path');
              d.lastTitle = col(e, 'label');
            }
            d.entryPath = col(e, 'path');
          }
          if (col(e, 'referrer')) d.referrer = col(e, 'referrer');
          if (event === 'order_placed' && !d.contact) {
            const m = parseMeta(col(e, 'meta')) || {};
            d.contact = { name: m.name || null, phone: m.phone || null, orderNumber: col(e, 'label') };
          }
        }
      }

      const userIds = [...new Set(rows.map((r) => Number(col(r, 'user_id'))).filter(Boolean))];
      const users = new Map();
      if (userIds.length) {
        const urows = await query(
          `SELECT id, full_name, phone, email FROM users WHERE id IN (${inList(userIds.length)})`,
          userIds
        );
        for (const u of urows) {
          users.set(Number(u.id), {
            id: Number(u.id),
            name: col(u, 'full_name'),
            phone: u.phone,
            email: u.email,
          });
        }
      }

      const onlineCutoff = Date.now() - 5 * 60 * 1000;
      const s = statRows[0] || {};
      res.json({
        ok: true,
        range,
        since,
        retentionDays: RETENTION_DAYS,
        stats: {
          visitors: Number(col(s, 'visitors')) || 0,
          views: Number(col(s, 'views')) || 0,
          carts: Number(col(s, 'carts')) || 0,
          checkouts: Number(col(s, 'checkouts')) || 0,
          orders: Number(col(s, 'orders')) || 0,
          online: Number(col(s, 'online')) || 0,
        },
        page,
        limit,
        total,
        visitors: rows.map((r) => {
          const vid = col(r, 'visitor_id');
          const d = details.get(vid) || {};
          const lastSeen = col(r, 'last_seen');
          return {
            visitorId: vid,
            firstSeen: col(r, 'first_seen'),
            lastSeen,
            online: new Date(lastSeen).getTime() >= onlineCutoff,
            views: Number(col(r, 'views')) || 0,
            carts: Number(col(r, 'carts')) || 0,
            checkouts: Number(col(r, 'checkouts')) || 0,
            orders: Number(col(r, 'orders')) || 0,
            totalEvents: Number(col(r, 'total_events')) || 0,
            user: users.get(Number(col(r, 'user_id'))) || null,
            contact: d.contact || null,
            ip: d.ip || null,
            device: describeDevice(d.userAgent),
            source: describeSource(d.entryPath, d.referrer),
            lastPath: d.lastPath || null,
            lastTitle: d.lastTitle || null,
          };
        }),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Could not load visitor activity' });
    }
  });

  router.get('/visitors/:vid', requireAdmin, async (req, res) => {
    try {
      await ensureVisitorEventsTable();
      const vid = String(req.params.vid || '').slice(0, 40);
      const rows = await query(
        `SELECT id, user_id, event, path, label, product_id, meta, referrer, ip, user_agent, created_at
         FROM visitor_events WHERE visitor_id = ? ORDER BY created_at DESC, id DESC LIMIT 1000`,
        [vid]
      );
      if (!rows.length) return res.status(404).json({ ok: false, error: 'Visitor not found' });
      const userId = rows.map((r) => Number(col(r, 'user_id'))).find(Boolean);
      let user = null;
      if (userId) {
        const urows = await query('SELECT id, full_name, phone, email FROM users WHERE id = ? LIMIT 1', [userId]);
        if (urows[0]) {
          user = { id: userId, name: col(urows[0], 'full_name'), phone: urows[0].phone, email: urows[0].email };
        }
      }
      const oldest = rows[rows.length - 1];
      const entryView = [...rows].reverse().find((r) => col(r, 'event') === 'page_view');
      const refRow = [...rows].reverse().find((r) => col(r, 'referrer'));
      res.json({
        ok: true,
        visitorId: vid,
        user,
        ip: col(rows[0], 'ip'),
        device: describeDevice(col(rows[0], 'user_agent')),
        userAgent: col(rows[0], 'user_agent'),
        source: describeSource(col(entryView, 'path'), col(refRow, 'referrer')),
        referrer: col(refRow, 'referrer') || null,
        firstSeen: col(oldest, 'created_at'),
        lastSeen: col(rows[0], 'created_at'),
        truncated: rows.length >= 1000,
        events: rows.map((r) => ({
          id: Number(r.id),
          event: col(r, 'event'),
          path: col(r, 'path'),
          label: col(r, 'label'),
          productId: col(r, 'product_id') != null ? Number(col(r, 'product_id')) : null,
          meta: parseMeta(col(r, 'meta')),
          createdAt: col(r, 'created_at'),
        })),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Could not load visitor timeline' });
    }
  });

  // ——— Customer carts (logged-in customers' current carts) ———
  router.get('/customer-carts', requireAdmin, async (req, res) => {
    try {
      const { ensureUserCartsTable } = require('../lib/savedCarts');
      await ensureUserCartsTable();
      const { page, limit, offset } = paginate(req.query.page, req.query.limit || 20);
      const search = String(req.query.search || '').trim().slice(0, 100);
      const where = [];
      const params = [];
      if (search) {
        const like = `%${search}%`;
        where.push(
          `(${likeFragment('u.full_name')} OR ${likeFragment('u.email')} OR ${likeFragment('u.phone')} OR ${likeFragment('c.items')})`
        );
        params.push(like, like, like, like);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const base = `FROM user_carts c JOIN users u ON u.id = c.user_id ${whereSql}`;

      const [total, rows, statRows] = await Promise.all([
        countSql(`SELECT COUNT(*) AS cnt ${base}`, params),
        query(
          `SELECT c.user_id, c.items, c.item_count, c.subtotal, c.created_at, c.updated_at,
                  u.full_name, u.email, u.phone,
                  (SELECT COUNT(*) FROM orders o WHERE o.user_id = c.user_id) AS order_count,
                  (SELECT MAX(o.created_at) FROM orders o WHERE o.user_id = c.user_id) AS last_order_at
           ${base}
           ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`,
          [...params, limit, offset]
        ),
        query(
          `SELECT COUNT(*) AS carts, COALESCE(SUM(item_count), 0) AS items, COALESCE(SUM(subtotal), 0) AS value,
             SUM(CASE WHEN updated_at >= ? THEN 1 ELSE 0 END) AS today
           FROM user_carts`,
          [new Date(Date.now() - 24 * 60 * 60 * 1000)]
        ),
      ]);

      const s = statRows[0] || {};
      res.json({
        ok: true,
        page,
        limit,
        total,
        stats: {
          carts: Number(col(s, 'carts')) || 0,
          items: Number(col(s, 'items')) || 0,
          value: Number(col(s, 'value')) || 0,
          valueFormatted: formatPrice(Number(col(s, 'value')) || 0),
          last24h: Number(col(s, 'today')) || 0,
        },
        carts: rows.map((r) => {
          let items = [];
          try {
            items = JSON.parse(col(r, 'items')) || [];
          } catch (_) {
            items = [];
          }
          const subtotal = Number(col(r, 'subtotal')) || 0;
          return {
            userId: Number(col(r, 'user_id')),
            name: col(r, 'full_name') || 'Customer',
            email: r.email || '',
            phone: r.phone || '',
            items,
            itemCount: Number(col(r, 'item_count')) || 0,
            subtotal,
            subtotalFormatted: formatPrice(subtotal),
            createdAt: col(r, 'created_at'),
            updatedAt: col(r, 'updated_at'),
            orderCount: Number(col(r, 'order_count')) || 0,
            lastOrderAt: col(r, 'last_order_at') || null,
          };
        }),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Could not load customer carts' });
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
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
      const offset = (page - 1) * limit;

      let countSql = `SELECT COUNT(*) AS total FROM product_reviews r WHERE 1=1`;
      let sql = `SELECT r.*, p.name_bn AS product_name FROM product_reviews r
        JOIN products p ON p.id = r.product_id WHERE 1=1`;
      const params = [];
      if (status && status !== 'all') {
        countSql += ' AND r.status = ?';
        sql += ' AND r.status = ?';
        params.push(status);
      }
      sql += ' ORDER BY COALESCE(r.homepage_sort_order, 9999) ASC, r.created_at DESC LIMIT ? OFFSET ?';

      const [{ total }] = await query(countSql, params).catch(() => [{ total: 0 }]);
      const reviews = await query(sql, [...params, limit, offset]);
      const pendingRows = await query(
        "SELECT COUNT(*) AS c FROM product_reviews WHERE status='pending'"
      ).catch(() => [{ c: 0 }]);
      const pendingCount = Number(pendingRows[0]?.c) || 0;
      let unreadCount = 0;
      try {
        const { ensureViewedByAdminColumns, countUnreadByAdmin, isViewedByAdmin: isViewed } =
          require('../lib/ensureViewedByAdminColumns');
        await ensureViewedByAdminColumns('product_reviews');
        unreadCount = await countUnreadByAdmin('product_reviews');
        reviews.forEach((r) => {
          r.viewedByAdmin = isViewed(r.viewed_by_admin);
        });
      } catch (_) {}
      const totalNum = Number(total) || 0;
      res.json({
        ok: true,
        reviews,
        pendingCount,
        unreadCount,
        pagination: {
          page,
          limit,
          total: totalNum,
          pages: Math.max(1, Math.ceil(totalNum / limit)),
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Reviews table missing — run db setup' });
    }
  });

  router.get('/reviews/unread-count', requireAdmin, async (req, res) => {
    try {
      const { ensureViewedByAdminColumns, countUnreadByAdmin } = require('../lib/ensureViewedByAdminColumns');
      await ensureViewedByAdminColumns('product_reviews');
      const unreadCount = await countUnreadByAdmin('product_reviews');
      res.json({ ok: true, unreadCount });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Could not load unread review count' });
    }
  });

  router.post('/reviews/mark-viewed', requireAdmin, async (req, res) => {
    try {
      const { ensureViewedByAdminColumns, markRowsViewedByAdmin } = require('../lib/ensureViewedByAdminColumns');
      await ensureViewedByAdminColumns('product_reviews');
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const result = await markRowsViewedByAdmin('product_reviews', ids);
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Could not update review view status' });
    }
  });

  router.post('/reviews', requireAdmin, async (req, res) => {
    try {
      const { ensureProductReviewAvatarColumn } = require('../lib/ensureProductReviewAvatarColumn');
      await ensureProductReviewAvatarColumn();

      const productId = Number(req.body.productId);
      const customerName = String(req.body.customerName || '').trim();
      const rating = Math.min(5, Math.max(1, Number(req.body.rating) || 0));
      const comment = String(req.body.comment || '').trim() || null;
      const imageUrl = String(req.body.imageUrl || '').trim() || null;
      const avatarUrl = String(req.body.avatarUrl || '').trim() || null;
      const city = String(req.body.city || '').trim() || null;
      const status = ['approved', 'pending', 'rejected'].includes(String(req.body.status))
        ? String(req.body.status)
        : 'approved';

      if (!productId) return res.status(400).json({ ok: false, error: 'Product is required' });
      if (!customerName) return res.status(400).json({ ok: false, error: 'Customer name is required' });
      if (!rating) return res.status(400).json({ ok: false, error: 'Rating is required' });

      const products = await query('SELECT id FROM products WHERE id = ? LIMIT 1', [productId]);
      if (!products.length) return res.status(404).json({ ok: false, error: 'Product not found' });

      const result = await query(
        `INSERT INTO product_reviews (product_id, user_id, customer_name, rating, comment, image_url, reviewer_avatar_url, reviewer_city, status)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, customerName, rating, comment, imageUrl, avatarUrl, city, status]
      );

      const id = result?.insertId || result?.[0]?.id;
      if (id) {
        await query(
          'UPDATE product_reviews SET viewed_by_admin = true, viewed_at = CURRENT_TIMESTAMP WHERE id = ?',
          [id]
        ).catch(() => {});
      }
      const { syncProductReviewStats } = require('../lib/productReviews');
      await syncProductReviewStats(query, productId);
      const { clearStoreBootstrapCache } = require('../lib/storeBootstrap');
      clearStoreBootstrapCache();
      res.json({ ok: true, id });
    } catch (err) {
      console.error('admin create review', err);
      res.status(500).json({ ok: false, error: 'Could not create review' });
    }
  });

  router.put('/reviews/:id', requireAdmin, async (req, res) => {
    try {
      const { ensureProductReviewAvatarColumn } = require('../lib/ensureProductReviewAvatarColumn');
      await ensureProductReviewAvatarColumn();

      const id = Number(req.params.id);
      const productId = Number(req.body.productId);
      const customerName = String(req.body.customerName || '').trim();
      const rating = Math.min(5, Math.max(1, Number(req.body.rating) || 0));
      const comment = String(req.body.comment || '').trim() || null;
      const imageUrl = String(req.body.imageUrl || '').trim() || null;
      const avatarUrl = String(req.body.avatarUrl || '').trim() || null;
      const city = String(req.body.city || '').trim() || null;
      const status = ['approved', 'pending', 'rejected'].includes(String(req.body.status))
        ? String(req.body.status)
        : 'approved';

      if (!id) return res.status(400).json({ ok: false, error: 'Invalid review id' });
      if (!productId) return res.status(400).json({ ok: false, error: 'Product is required' });
      if (!customerName) return res.status(400).json({ ok: false, error: 'Customer name is required' });
      if (!rating) return res.status(400).json({ ok: false, error: 'Rating is required' });

      const prev = await query('SELECT id, product_id FROM product_reviews WHERE id = ? LIMIT 1', [id]);
      if (!prev.length) return res.status(404).json({ ok: false, error: 'Review not found' });

      const products = await query('SELECT id FROM products WHERE id = ? LIMIT 1', [productId]);
      if (!products.length) return res.status(404).json({ ok: false, error: 'Product not found' });

      await query(
        `UPDATE product_reviews
         SET product_id=?, customer_name=?, rating=?, comment=?, image_url=?, reviewer_avatar_url=?, reviewer_city=?, status=?,
             viewed_by_admin = true, viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP)
         WHERE id=?`,
        [productId, customerName, rating, comment, imageUrl, avatarUrl, city, status, id]
      );

      const { syncProductReviewStats } = require('../lib/productReviews');
      await syncProductReviewStats(query, productId);
      const prevProductId = Number(prev[0].product_id || prev[0].productId);
      if (prevProductId && prevProductId !== productId) {
        await syncProductReviewStats(query, prevProductId);
      }

      const { clearStoreBootstrapCache } = require('../lib/storeBootstrap');
      clearStoreBootstrapCache();
      res.json({ ok: true });
    } catch (err) {
      console.error('admin update review', err);
      res.status(500).json({ ok: false, error: 'Could not update review' });
    }
  });

  router.patch('/reviews/:id', requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      if (!['approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ ok: false, error: 'Invalid status' });
      }
      const rows = await query('SELECT * FROM product_reviews WHERE id = ? LIMIT 1', [req.params.id]);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'Review not found' });
      const prev = rows[0];
      await query(
        'UPDATE product_reviews SET status = ?, viewed_by_admin = true, viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP) WHERE id = ?',
        [status, req.params.id]
      );
      if (rows.length) {
        const { syncProductReviewStats } = require('../lib/productReviews');
        await syncProductReviewStats(query, rows[0].product_id || rows[0].productId);
      }
      if (status === 'approved' && String(prev.status).toLowerCase() !== 'approved') {
        const { awardApprovedReviewPoints } = require('../lib/rewardPoints');
        await awardApprovedReviewPoints(query, prev);
      }
      const { clearStoreBootstrapCache } = require('../lib/storeBootstrap');
      clearStoreBootstrapCache();
      let unreadCount = 0;
      try {
        const { countUnreadByAdmin } = require('../lib/ensureViewedByAdminColumns');
        unreadCount = await countUnreadByAdmin('product_reviews');
      } catch (_) {}
      res.json({ ok: true, unreadCount });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not update review' });
    }
  });

  router.post('/reviews/bulk-delete', requireAdmin, async (req, res) => {
    try {
      const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Boolean))];
      if (!ids.length) return res.status(400).json({ ok: false, error: 'No reviews selected' });
      const placeholders = ids.map(() => '?').join(',');
      const rows = await query(
        `SELECT DISTINCT product_id FROM product_reviews WHERE id IN (${placeholders})`,
        ids
      );
      await query(`DELETE FROM product_reviews WHERE id IN (${placeholders})`, ids);
      if (rows.length) {
        const { syncProductReviewStats } = require('../lib/productReviews');
        for (const row of rows) {
          await syncProductReviewStats(query, row.product_id || row.productId);
        }
      }
      const { clearStoreBootstrapCache } = require('../lib/storeBootstrap');
      clearStoreBootstrapCache();
      res.json({ ok: true, deleted: ids.length });
    } catch (err) {
      console.error('admin reviews bulk delete', err);
      res.status(500).json({ ok: false, error: 'Could not delete selected reviews' });
    }
  });

  router.delete('/reviews/:id', requireAdmin, async (req, res) => {
    try {
      const rows = await query('SELECT product_id FROM product_reviews WHERE id = ? LIMIT 1', [
        req.params.id,
      ]);
      await query('DELETE FROM product_reviews WHERE id = ?', [req.params.id]);
      if (rows.length) {
        const { syncProductReviewStats } = require('../lib/productReviews');
        await syncProductReviewStats(query, rows[0].product_id || rows[0].productId);
      }
      const { clearStoreBootstrapCache } = require('../lib/storeBootstrap');
      clearStoreBootstrapCache();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not delete review' });
    }
  });

  router.get('/review-videos', requireAdmin, async (req, res) => {
    try {
      const status = String(req.query.status || 'pending').trim() || 'pending';
      const { listAdminReviewVideos, countPendingReviewVideos, countUnreadReviewVideos } = require('../lib/reviewVideos');
      const videos = await listAdminReviewVideos(query, status);
      const pendingCount = await countPendingReviewVideos(query);
      let unreadCount = 0;
      try {
        const { ensureViewedByAdminColumns, countUnreadByAdmin } = require('../lib/ensureViewedByAdminColumns');
        await ensureViewedByAdminColumns('product_review_videos');
        unreadCount = await countUnreadByAdmin('product_review_videos');
      } catch (_) {
        unreadCount = await countUnreadReviewVideos(query).catch(() => 0);
      }
      res.json({ ok: true, videos, pendingCount, unreadCount });
    } catch (err) {
      console.error('admin review videos list', err);
      res.status(500).json({ ok: false, error: 'Could not load review videos' });
    }
  });

  router.get('/review-videos/unread-count', requireAdmin, async (req, res) => {
    try {
      const { ensureViewedByAdminColumns, countUnreadByAdmin } = require('../lib/ensureViewedByAdminColumns');
      await ensureViewedByAdminColumns('product_review_videos');
      const unreadCount = await countUnreadByAdmin('product_review_videos');
      res.json({ ok: true, unreadCount });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Could not load unread review video count' });
    }
  });

  router.post('/review-videos/mark-viewed', requireAdmin, async (req, res) => {
    try {
      const { ensureViewedByAdminColumns, markRowsViewedByAdmin } = require('../lib/ensureViewedByAdminColumns');
      await ensureViewedByAdminColumns('product_review_videos');
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const result = await markRowsViewedByAdmin('product_review_videos', ids);
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Could not update review video view status' });
    }
  });

  router.patch('/review-videos/:id', requireAdmin, async (req, res) => {
    try {
      const { status, adminNote } = req.body || {};
      if (!['approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ ok: false, error: 'Invalid status' });
      }
      const rows = await query('SELECT * FROM product_review_videos WHERE id = ? LIMIT 1', [
        req.params.id,
      ]);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'Review video not found' });
      const prev = rows[0];
      const note = adminNote != null ? String(adminNote).trim().slice(0, 500) : prev.admin_note;

      await query(
        `UPDATE product_review_videos SET status = ?, admin_note = ?, reviewed_at = CURRENT_TIMESTAMP,
         viewed_by_admin = true, viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP) WHERE id = ?`,
        [status, note || '', req.params.id]
      );

      let pointsAwarded = 0;
      if (status === 'approved' && String(prev.status).toLowerCase() !== 'approved') {
        const { awardApprovedReviewVideoPoints } = require('../lib/rewardPoints');
        const award = await awardApprovedReviewVideoPoints(query, prev);
        pointsAwarded = award.awarded || 0;
      }

      let unreadCount = 0;
      try {
        const { countUnreadByAdmin } = require('../lib/ensureViewedByAdminColumns');
        unreadCount = await countUnreadByAdmin('product_review_videos');
      } catch (_) {}

      res.json({ ok: true, pointsAwarded, unreadCount });
    } catch (err) {
      console.error('admin review video patch', err);
      res.status(500).json({ ok: false, error: 'Could not update review video' });
    }
  });

  router.delete('/review-videos/:id', requireAdmin, async (req, res) => {
    try {
      await query('DELETE FROM product_review_videos WHERE id = ?', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not delete review video' });
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
          bgGradient || brandGradient,
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

  router.post('/upload', requireAdmin, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });
      const saved = await optimizeAndSaveImage(req.file);
      res.json({
        ok: true,
        url: saved.url,
        format: saved.format,
        sizeBefore: saved.bytesBefore,
        sizeAfter: saved.bytesAfter,
      });
    } catch (err) {
      console.error('upload optimize', err);
      res.status(500).json({ ok: false, error: err.message || 'Image upload failed' });
    }
  });

  // ——— Coupon update ———
  router.put('/coupons/:id', requireAdmin, async (req, res) => {
    try {
      const { code, discountType, discountValue, minOrder, usageLimit, expiresAt, isActive, freeDelivery } = req.body;
      const type = String(discountType || 'percent').trim();
      if (!['percent', 'fixed', 'free_delivery'].includes(type)) {
        return res.status(400).json({ ok: false, error: 'Invalid coupon type' });
      }
      const value = type === 'free_delivery' ? 0 : Number(discountValue);
      const { ensureCouponFreeDeliveryType } = require('../lib/ensureCouponFreeDeliveryType');
      await ensureCouponFreeDeliveryType();
      const freeDeliveryOn = type === 'free_delivery' || Boolean(freeDelivery);
      await query(
        `UPDATE coupons SET code=?, discount_type=?, discount_value=?, min_order=?, usage_limit=?, expires_at=?, is_active=?, free_delivery=? WHERE id=?`,
        [
          String(code || '').trim().toUpperCase(),
          type,
          value,
          minOrder,
          usageLimit || null,
          expiresAt || null,
          isActive ? 1 : 0,
          freeDeliveryOn,
          req.params.id,
        ]
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not update coupon' });
    }
  });

  router.patch('/coupons/:id/free-delivery', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'Invalid coupon' });
      const { ensureCouponFreeDeliveryType } = require('../lib/ensureCouponFreeDeliveryType');
      await ensureCouponFreeDeliveryType();
      const rows = await query('SELECT id, discount_type FROM coupons WHERE id = ? LIMIT 1', [id]);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'Coupon not found' });
      if (String(rows[0].discount_type) === 'free_delivery') {
        return res.status(400).json({ ok: false, error: 'Free Delivery coupons always give free delivery' });
      }
      const on = Boolean(req.body?.enabled);
      await query('UPDATE coupons SET free_delivery = ? WHERE id = ?', [on, id]);
      res.json({ ok: true, freeDelivery: on });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Could not update free delivery' });
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

      const pendingCount = await countSql(`SELECT COUNT(*) AS c FROM appointments WHERE status = 'pending'`);
      const unreadCount = await countSql(
        `SELECT COUNT(*) AS c FROM appointments WHERE viewed_by_admin IS NOT TRUE`
      );

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
          viewedByAdmin: isViewedByAdmin(r.viewed_by_admin),
          viewedAt: r.viewed_at || null,
          createdAt: r.created_at || r.createdAt,
        })),
        pagination: {
          page: p,
          limit: l,
          total: totalN,
          pages: Math.max(1, Math.ceil(totalN / l)),
        },
        pendingCount,
        unreadCount,
      });
    } catch (err) {
      console.error('admin appointments', err);
      res.status(500).json({ ok: false, error: 'Could not load appointments' });
    }
  });

  router.get('/appointments/unread-count', requireAdmin, async (req, res) => {
    try {
      const { ensureAppointmentsTable } = require('../lib/ensureAppointmentsTable');
      await ensureAppointmentsTable();
      const unreadCount = await countSql(
        `SELECT COUNT(*) AS c FROM appointments WHERE viewed_by_admin IS NOT TRUE`
      );
      res.json({ ok: true, unreadCount });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Could not load unread appointment count' });
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
      await query(
        `UPDATE appointments
         SET status = ?, viewed_by_admin = true, viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP)
         WHERE id = ?`,
        [status, req.params.id]
      );
      const unreadCount = await countSql(
        `SELECT COUNT(*) AS c FROM appointments WHERE viewed_by_admin IS NOT TRUE`
      );
      res.json({ ok: true, unreadCount });
    } catch (err) {
      console.error('admin appointment patch', err);
      res.status(500).json({ ok: false, error: 'Could not update appointment' });
    }
  });

  router.post('/appointments/mark-viewed', requireAdmin, async (req, res) => {
    try {
      const { ensureAppointmentsTable } = require('../lib/ensureAppointmentsTable');
      await ensureAppointmentsTable();
      const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Boolean))];
      if (ids.length) {
        const placeholders = ids.map(() => '?').join(',');
        await query(
          `UPDATE appointments
           SET viewed_by_admin = true, viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP)
           WHERE id IN (${placeholders})`,
          ids
        );
      }
      const unreadCount = await countSql(
        `SELECT COUNT(*) AS c FROM appointments WHERE viewed_by_admin IS NOT TRUE`
      );
      res.json({ ok: true, unreadCount, updated: ids.length });
    } catch (err) {
      console.error('admin appointment mark-viewed', err);
      res.status(500).json({ ok: false, error: 'Could not update appointment view status' });
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

  router.post('/appointments/bulk-delete', requireAdmin, async (req, res) => {
    try {
      const { ensureAppointmentsTable } = require('../lib/ensureAppointmentsTable');
      await ensureAppointmentsTable();
      const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Boolean))];
      if (!ids.length) return res.status(400).json({ ok: false, error: 'No appointments selected' });
      const placeholders = ids.map(() => '?').join(',');
      await query(`DELETE FROM appointments WHERE id IN (${placeholders})`, ids);
      res.json({ ok: true, deleted: ids.length });
    } catch (err) {
      console.error('admin appointments bulk delete', err);
      res.status(500).json({ ok: false, error: 'Could not delete selected appointments' });
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

  // ——— Blog posts ———
  router.get('/blog/posts', requireAdmin, async (req, res) => {
    try {
      const { ensureBlogPostsTable } = require('../lib/ensureBlogPostsTable');
      const { ensureBlogSeoColumns } = require('../lib/ensureBlogSeoColumns');
      const { blogPostToPublic } = require('../lib/blogPosts');
      await ensureBlogPostsTable();
      await ensureBlogSeoColumns();
      const { page, limit, status, search } = req.query;
      const { page: p, limit: l, offset } = paginate(page, limit);
      const where = [];
      const params = [];
      if (status && status !== 'all') {
        where.push('status = ?');
        params.push(String(status));
      }
      if (search && String(search).trim()) {
        where.push('(title LIKE ? OR slug LIKE ?)');
        const q = `%${String(search).trim()}%`;
        params.push(q, q);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const countRows = await query(`SELECT COUNT(*) AS total FROM blog_posts ${whereSql}`, params);
      const total = Number(countRows[0]?.total ?? Object.values(countRows[0] || {})[0]) || 0;
      const rows = await query(
        `SELECT * FROM blog_posts ${whereSql} ORDER BY COALESCE(published_at, created_at) DESC, id DESC LIMIT ? OFFSET ?`,
        [...params, l, offset]
      );
      res.json({
        ok: true,
        posts: rows.map((row) => blogPostToPublic(row)),
        pagination: { page: p, limit: l, total, pages: Math.max(1, Math.ceil(total / l)) },
      });
    } catch (err) {
      console.error('admin blog GET', err);
      res.status(500).json({ ok: false, error: 'Could not load blog posts' });
    }
  });

  router.post('/blog/posts', requireAdmin, async (req, res) => {
    try {
      const { ensureBlogPostsTable } = require('../lib/ensureBlogPostsTable');
      const { ensureBlogSeoColumns } = require('../lib/ensureBlogSeoColumns');
      const {
        ensureUniqueBlogSlug,
        normalizeBlogStatus,
        blogPostPublicUrl,
        parseBlogSeoFields,
      } = require('../lib/blogPosts');
      await ensureBlogPostsTable();
      await ensureBlogSeoColumns();

      const title = String(req.body?.title || '').trim().slice(0, 255);
      const content = String(req.body?.content || '').trim().slice(0, 80000);
      const excerpt = String(req.body?.excerpt || '').trim().slice(0, 2000) || null;
      const featuredImageUrl = String(req.body?.featuredImageUrl || '').trim().slice(0, 500) || null;
      const status = normalizeBlogStatus(req.body?.status);
      const seo = parseBlogSeoFields(req.body);
      if (!title) return res.status(400).json({ ok: false, error: 'Title is required' });
      if (!content) return res.status(400).json({ ok: false, error: 'Content is required' });

      const slugInput = String(req.body?.slug || '').trim() || title;
      const slug = await ensureUniqueBlogSlug(query, slugInput);
      const publishedAt = status === 'published' ? new Date() : null;

      const result = await query(
        `INSERT INTO blog_posts (
          title, slug, excerpt, content, featured_image_url, status, published_at,
          seo_title, seo_description, seo_keywords, image_alt, og_image
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          slug,
          excerpt,
          content,
          featuredImageUrl,
          status,
          publishedAt,
          seo.seoTitle,
          seo.seoDescription,
          seo.seoKeywords,
          seo.imageAlt,
          seo.ogImage,
        ]
      );
      const id = result?.insertId || result?.[0]?.id;
      res.json({ ok: true, id, slug, url: blogPostPublicUrl(slug) });
    } catch (err) {
      console.error('admin blog POST', err);
      res.status(500).json({ ok: false, error: 'Could not create blog post' });
    }
  });

  router.put('/blog/posts/:id', requireAdmin, async (req, res) => {
    try {
      const { ensureBlogPostsTable } = require('../lib/ensureBlogPostsTable');
      const { ensureBlogSeoColumns } = require('../lib/ensureBlogSeoColumns');
      const {
        ensureUniqueBlogSlug,
        normalizeBlogStatus,
        blogPostPublicUrl,
        parseBlogSeoFields,
      } = require('../lib/blogPosts');
      await ensureBlogPostsTable();
      await ensureBlogSeoColumns();

      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'Invalid post id' });

      const prev = await query('SELECT id, slug, status, published_at FROM blog_posts WHERE id = ? LIMIT 1', [id]);
      if (!prev.length) return res.status(404).json({ ok: false, error: 'Post not found' });

      const title = String(req.body?.title || '').trim().slice(0, 255);
      const content = String(req.body?.content || '').trim().slice(0, 80000);
      const excerpt = String(req.body?.excerpt || '').trim().slice(0, 2000) || null;
      const featuredImageUrl = String(req.body?.featuredImageUrl || '').trim().slice(0, 500) || null;
      const status = normalizeBlogStatus(req.body?.status);
      const seo = parseBlogSeoFields(req.body);
      if (!title) return res.status(400).json({ ok: false, error: 'Title is required' });
      if (!content) return res.status(400).json({ ok: false, error: 'Content is required' });

      const slugInput = String(req.body?.slug || '').trim() || title;
      const slug = await ensureUniqueBlogSlug(query, slugInput, id);

      let publishedAt = prev[0].published_at || prev[0].publishedAt || null;
      const prevStatus = normalizeBlogStatus(prev[0].status);
      if (status === 'published' && (!publishedAt || prevStatus !== 'published')) {
        publishedAt = new Date();
      }
      if (status === 'draft') publishedAt = null;

      await query(
        `UPDATE blog_posts
         SET title = ?, slug = ?, excerpt = ?, content = ?, featured_image_url = ?, status = ?, published_at = ?,
             seo_title = ?, seo_description = ?, seo_keywords = ?, image_alt = ?, og_image = ?
         WHERE id = ?`,
        [
          title,
          slug,
          excerpt,
          content,
          featuredImageUrl,
          status,
          publishedAt,
          seo.seoTitle,
          seo.seoDescription,
          seo.seoKeywords,
          seo.imageAlt,
          seo.ogImage,
          id,
        ]
      );
      res.json({ ok: true, id, slug, url: blogPostPublicUrl(slug) });
    } catch (err) {
      console.error('admin blog PUT', err);
      res.status(500).json({ ok: false, error: 'Could not update blog post' });
    }
  });

  router.delete('/blog/posts/:id', requireAdmin, async (req, res) => {
    try {
      const { ensureBlogPostsTable } = require('../lib/ensureBlogPostsTable');
      await ensureBlogPostsTable();
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'Invalid post id' });
      await query('DELETE FROM blog_posts WHERE id = ?', [id]);
      res.json({ ok: true });
    } catch (err) {
      console.error('admin blog DELETE', err);
      res.status(500).json({ ok: false, error: 'Could not delete blog post' });
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

      const newCount = await countSql(`SELECT COUNT(*) AS c FROM contact_messages WHERE status = 'new'`);
      const unreadCount = await countSql(
        `SELECT COUNT(*) AS c FROM contact_messages WHERE viewed_by_admin IS NOT TRUE`
      );

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
        unreadCount,
      });
    } catch (err) {
      console.error('admin contact messages', err);
      res.status(500).json({ ok: false, error: 'Could not load contact messages' });
    }
  });

  router.get('/contact-messages/unread-count', requireAdmin, async (req, res) => {
    try {
      const { ensureContactMessagesTable } = require('../lib/ensureContactMessagesTable');
      await ensureContactMessagesTable();
      const unreadCount = await countSql(
        `SELECT COUNT(*) AS c FROM contact_messages WHERE viewed_by_admin IS NOT TRUE`
      );
      res.json({ ok: true, unreadCount });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Could not load unread contact count' });
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
      await query(
        `UPDATE contact_messages
         SET status = ?, viewed_by_admin = true, viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP)
         WHERE id = ?`,
        [status, req.params.id]
      );
      const unreadCount = await countSql(
        `SELECT COUNT(*) AS c FROM contact_messages WHERE viewed_by_admin IS NOT TRUE`
      );
      res.json({ ok: true, unreadCount });
    } catch (err) {
      console.error('admin contact message patch', err);
      res.status(500).json({ ok: false, error: 'Could not update message' });
    }
  });

  router.post('/contact-messages/mark-viewed', requireAdmin, async (req, res) => {
    try {
      const { ensureContactMessagesTable } = require('../lib/ensureContactMessagesTable');
      await ensureContactMessagesTable();
      const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Boolean))];
      if (ids.length) {
        const placeholders = ids.map(() => '?').join(',');
        await query(
          `UPDATE contact_messages
           SET viewed_by_admin = true, viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP)
           WHERE id IN (${placeholders})`,
          ids
        );
      }
      const unreadCount = await countSql(
        `SELECT COUNT(*) AS c FROM contact_messages WHERE viewed_by_admin IS NOT TRUE`
      );
      res.json({ ok: true, unreadCount, updated: ids.length });
    } catch (err) {
      console.error('admin contact mark-viewed', err);
      res.status(500).json({ ok: false, error: 'Could not update contact view status' });
    }
  });

  router.post('/contact-messages/bulk-delete', requireAdmin, async (req, res) => {
    try {
      const { ensureContactMessagesTable } = require('../lib/ensureContactMessagesTable');
      await ensureContactMessagesTable();
      const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Boolean))];
      if (!ids.length) return res.status(400).json({ ok: false, error: 'No messages selected' });
      const placeholders = ids.map(() => '?').join(',');
      await query(`DELETE FROM contact_messages WHERE id IN (${placeholders})`, ids);
      res.json({ ok: true, deleted: ids.length });
    } catch (err) {
      console.error('admin contact messages bulk delete', err);
      res.status(500).json({ ok: false, error: 'Could not delete selected messages' });
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

  // ——— Homepage YouTube videos ———
  router.get('/homepage-videos', requireAdmin, async (req, res) => {
    try {
      const { ensureHomepageVideos } = require('../lib/ensureHomepageVideos');
      await ensureHomepageVideos();
      const videos = await query(
        'SELECT * FROM homepage_videos ORDER BY sort_order ASC, id DESC'
      );
      res.json({ ok: true, videos });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Homepage videos table missing' });
    }
  });

  router.post('/homepage-videos', requireAdmin, async (req, res) => {
    try {
      const {
        ensureHomepageVideos,
        parseYoutubeId,
        normalizeYoutubeUrl,
      } = require('../lib/ensureHomepageVideos');
      const { clearStoreBootstrapCache } = require('../lib/storeBootstrap');
      await ensureHomepageVideos();
      const { title, youtubeUrl, sortOrder, isActive } = req.body;
      const youtubeId = parseYoutubeId(youtubeUrl);
      if (!youtubeId) {
        return res.status(400).json({ ok: false, error: 'Valid YouTube link required' });
      }
      await query(
        `INSERT INTO homepage_videos (title, youtube_url, youtube_id, sort_order, is_active)
         VALUES (?,?,?,?,?)`,
        [
          String(title || '').trim().slice(0, 160),
          normalizeYoutubeUrl(youtubeId),
          youtubeId,
          Number(sortOrder) || 0,
          isActive !== false,
        ]
      );
      clearStoreBootstrapCache();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not add video' });
    }
  });

  router.put('/homepage-videos/:id', requireAdmin, async (req, res) => {
    try {
      const {
        ensureHomepageVideos,
        parseYoutubeId,
        normalizeYoutubeUrl,
      } = require('../lib/ensureHomepageVideos');
      const { clearStoreBootstrapCache } = require('../lib/storeBootstrap');
      await ensureHomepageVideos();
      const { title, youtubeUrl, sortOrder, isActive } = req.body;
      const youtubeId = parseYoutubeId(youtubeUrl);
      if (!youtubeId) {
        return res.status(400).json({ ok: false, error: 'Valid YouTube link required' });
      }
      await query(
        `UPDATE homepage_videos SET title=?, youtube_url=?, youtube_id=?, sort_order=?, is_active=? WHERE id=?`,
        [
          String(title || '').trim().slice(0, 160),
          normalizeYoutubeUrl(youtubeId),
          youtubeId,
          Number(sortOrder) || 0,
          Boolean(isActive),
          req.params.id,
        ]
      );
      clearStoreBootstrapCache();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not update video' });
    }
  });

  router.delete('/homepage-videos/:id', requireAdmin, async (req, res) => {
    try {
      const { ensureHomepageVideos } = require('../lib/ensureHomepageVideos');
      const { clearStoreBootstrapCache } = require('../lib/storeBootstrap');
      await ensureHomepageVideos();
      await query('DELETE FROM homepage_videos WHERE id = ?', [req.params.id]);
      clearStoreBootstrapCache();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not delete video' });
    }
  });

  // ——— Messenger chat screenshots ———
  router.get('/messenger-chats', requireAdmin, async (req, res) => {
    try {
      const { ensureMessengerChats } = require('../lib/ensureMessengerChats');
      await ensureMessengerChats();
      const chats = await query(
        'SELECT * FROM messenger_chats ORDER BY sort_order ASC, id DESC'
      );
      res.json({ ok: true, chats });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Messenger chats table missing' });
    }
  });

  router.post('/messenger-chats', requireAdmin, async (req, res) => {
    try {
      const { ensureMessengerChats } = require('../lib/ensureMessengerChats');
      const { clearStoreBootstrapCache } = require('../lib/storeBootstrap');
      await ensureMessengerChats();
      const { customerName, caption, imageUrl, sortOrder, isActive } = req.body;
      if (!imageUrl) {
        return res.status(400).json({ ok: false, error: 'Screenshot image is required' });
      }
      await query(
        `INSERT INTO messenger_chats (customer_name, caption, image_url, sort_order, is_active)
         VALUES (?,?,?,?,?)`,
        [
          customerName || '',
          caption || '',
          imageUrl,
          sortOrder || 0,
          isActive !== false,
        ]
      );
      clearStoreBootstrapCache();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not create chat screenshot' });
    }
  });

  router.put('/messenger-chats/:id', requireAdmin, async (req, res) => {
    try {
      const { ensureMessengerChats } = require('../lib/ensureMessengerChats');
      const { clearStoreBootstrapCache } = require('../lib/storeBootstrap');
      await ensureMessengerChats();
      const { customerName, caption, imageUrl, sortOrder, isActive } = req.body;
      if (!imageUrl) {
        return res.status(400).json({ ok: false, error: 'Screenshot image is required' });
      }
      await query(
        `UPDATE messenger_chats SET customer_name=?, caption=?, image_url=?, sort_order=?, is_active=? WHERE id=?`,
        [
          customerName || '',
          caption || '',
          imageUrl,
          sortOrder || 0,
          Boolean(isActive),
          req.params.id,
        ]
      );
      clearStoreBootstrapCache();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not update chat screenshot' });
    }
  });

  router.delete('/messenger-chats/:id', requireAdmin, async (req, res) => {
    try {
      const { ensureMessengerChats } = require('../lib/ensureMessengerChats');
      const { clearStoreBootstrapCache } = require('../lib/storeBootstrap');
      await ensureMessengerChats();
      await query('DELETE FROM messenger_chats WHERE id = ?', [req.params.id]);
      clearStoreBootstrapCache();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not delete chat screenshot' });
    }
  });

};
