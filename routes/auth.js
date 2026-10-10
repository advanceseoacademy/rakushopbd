const fs = require('fs');
const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { formatPrice } = require('../lib/format');
const { saveSession } = require('../lib/sessionSave');
const { returningId } = require('../lib/db-dialect');
const { firstInsertId } = require('../config/db');
const { logVisitorEvent } = require('../lib/visitorActivity');
const { syncCartOnLogin } = require('../lib/savedCarts');
const { getSiteSettings } = require('../lib/siteSettings');
const { normalizeSiteBaseUrl } = require('../lib/seo');
const {
  processNewUserRewards,
  assignReferralCode,
  getRewardPointConfig,
} = require('../lib/rewardPoints');
const { createRateLimiter } = require('../lib/simpleRateLimit');
const { videoUpload } = require('../lib/uploadVideo');
const { saveVideoFile } = require('../lib/saveVideoFile');
const {
  listUserReviewVideos,
  listEligibleReviewVideoProducts,
  createReviewVideoSubmission,
} = require('../lib/reviewVideos');

const router = express.Router();

const rateLimitAuthLogin = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many login attempts — try again in a few minutes',
});

const rateLimitAuthRegister = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many registrations from this network — try again later',
});

function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    rewardPoints: Number(row.reward_points ?? row.rewardPoints) || 0,
    referralCode: row.referral_code || null,
    createdAt: row.created_at,
  };
}

async function loadUserById(userId) {
  const rows = await query(
    'SELECT id, full_name, email, phone, reward_points, referral_code, created_at FROM users WHERE id = ?',
    [userId]
  );
  return rows[0] || null;
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, error: 'Please log in to continue' });
  }
  next();
}

router.get('/me', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.json({ ok: true, user: null });
    }
    const rows = await loadUserById(req.session.userId);
    if (!rows) {
      req.session = null;
      return res.json({ ok: true, user: null });
    }
    res.json({ ok: true, user: sanitizeUser(rows) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load account' });
  }
});

router.post('/register', rateLimitAuthRegister, async (req, res) => {
  try {
    const { fullName, email, phone, password, referralCode } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ ok: false, error: 'Name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' });
    }

    const existing = await query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length) {
      return res.status(400).json({ ok: false, error: 'Email is already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (full_name, email, phone, password_hash) VALUES (?, ?, ?, ?)${returningId()}`,
      [fullName.trim(), email.trim().toLowerCase(), (phone || '').trim(), hash]
    );

    const userId = firstInsertId(result) ?? (await query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]))[0]?.id;
    req.session.userId = userId;
    logVisitorEvent(req, 'register', { label: fullName.trim(), meta: { email: email.trim().toLowerCase() } });
    await syncCartOnLogin(req);
    const rewards = await processNewUserRewards(query, userId, { referralCode });
    const rows = await loadUserById(userId);
    saveSession(req, (saveErr) => {
      if (saveErr) {
        console.error(saveErr);
        return res.status(500).json({ ok: false, error: 'Session save failed' });
      }
      const pts = rewards.welcomePoints || rewards.registrationAwarded || 0;
      res.json({
        ok: true,
        user: sanitizeUser(rows),
        welcomePoints: pts,
        referralBonus: rewards.referralSignupAwarded || 0,
        message:
          pts > 0
            ? rewards.referralSignupAwarded
              ? `Welcome! You earned ${pts} reward points (${rewards.registrationAwarded} signup + ${rewards.referralSignupAwarded} referral bonus).`
              : `Welcome! You earned ${pts} reward points for joining Raku Shop BD.`
            : 'Welcome to Raku Shop BD!',
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Registration failed' });
  }
});

router.post('/login', rateLimitAuthLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required' });
    }

    const rows = await query('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (!rows.length) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password' });
    }

    req.session.userId = user.id;
    logVisitorEvent(req, 'login', { label: user.full_name, meta: { email: user.email } });
    await syncCartOnLogin(req);
    await assignReferralCode(query, user.id);
    const fresh = await loadUserById(user.id);
    saveSession(req, (saveErr) => {
      if (saveErr) {
        console.error(saveErr);
        return res.status(500).json({ ok: false, error: 'Session save failed' });
      }
      res.json({ ok: true, user: sanitizeUser(fresh || user) });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  logVisitorEvent(req, 'logout');
  const vid = req.session?.vid;
  req.session = vid ? { vid } : null;
  res.json({ ok: true });
});

router.get('/referral', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    await assignReferralCode(query, userId);
    const row = await loadUserById(userId);
    if (!row) return res.status(404).json({ ok: false, error: 'Account not found' });

    const [settings, cfg, countRows] = await Promise.all([
      getSiteSettings(query),
      getRewardPointConfig(query),
      query('SELECT COUNT(*) AS cnt FROM users WHERE referred_by_user_id = ?', [userId]),
    ]);

    const code = row.referral_code || null;
    const siteBase = normalizeSiteBaseUrl(settings.site_url || '');
    const link = code
      ? (siteBase ? `${siteBase}/?ref=${encodeURIComponent(code)}` : `/?ref=${encodeURIComponent(code)}`)
      : null;

    res.json({
      ok: true,
      referral: {
        code,
        link,
        referralCount: Number(countRows[0]?.cnt ?? countRows[0]?.count) || 0,
        registrationBonus: cfg.registration,
        referralSignupBonus: cfg.referralSignup,
        referrerBonus: cfg.referral,
        newUserTotalWithReferral: cfg.registration + cfg.referralSignup,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load referral info' });
  }
});

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { fullName, phone } = req.body;
    if (!fullName || !phone) {
      return res.status(400).json({ ok: false, error: 'Name and phone are required' });
    }

    await query('UPDATE users SET full_name = ?, phone = ? WHERE id = ?', [
      fullName.trim(),
      phone.trim(),
      req.session.userId,
    ]);

    const rows = await loadUserById(req.session.userId);
    res.json({ ok: true, user: sanitizeUser(rows) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not update profile' });
  }
});

router.put('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ ok: false, error: 'New password must be at least 6 characters' });
    }

    const rows = await query('SELECT password_hash FROM users WHERE id = ?', [req.session.userId]);
    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) {
      return res.status(401).json({ ok: false, error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.session.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not change password' });
  }
});

router.get('/orders', requireAuth, async (req, res) => {
  try {
    const orders = await query(
      `SELECT id, order_number, subtotal, delivery_fee, total, status, payment_method, created_at,
              customer_name, customer_phone, address_line, district, postal_code
       FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [req.session.userId]
    );

    const withItems = await Promise.all(
      orders.map(async (o) => {
        const items = await query(
          `SELECT oi.product_id, oi.product_name, oi.quantity, oi.unit_price, oi.line_total,
                  p.slug AS product_slug, p.image_url AS product_image
           FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
           WHERE oi.order_id = ?`,
          [o.id]
        );
        const subtotal = Number(o.subtotal) || 0;
        const delivery = Number(o.delivery_fee) || 0;
        const total = Number(o.total) || 0;
        return {
          id: o.id,
          orderNumber: o.order_number,
          subtotal,
          deliveryFee: delivery,
          discount: Math.max(0, subtotal + delivery - total),
          total,
          totalFormatted: formatPrice(o.total),
          status: o.status,
          paymentMethod: o.payment_method,
          createdAt: o.created_at,
          customerName: o.customer_name,
          customerPhone: o.customer_phone,
          address: o.address_line,
          district: o.district,
          postalCode: o.postal_code,
          items,
        };
      })
    );

    res.json({ ok: true, orders: withItems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load orders' });
  }
});

router.get('/addresses', requireAuth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, label, full_name, phone, district, thana, address_line, postal_code, is_default
       FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC`,
      [req.session.userId]
    );
    res.json({ ok: true, addresses: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load addresses' });
  }
});

router.post('/addresses', requireAuth, async (req, res) => {
  try {
    const { label, fullName, phone, district, thana, addressLine, postalCode, isDefault } = req.body;
    if (!fullName || !phone || !district || !addressLine) {
      return res.status(400).json({ ok: false, error: 'Required address fields are missing' });
    }

    if (isDefault) {
      await query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [req.session.userId]);
    }

    const result = await query(
      `INSERT INTO user_addresses (user_id, label, full_name, phone, district, thana, address_line, postal_code, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)${returningId()}`,
      [
        req.session.userId,
        label || 'Home',
        fullName.trim(),
        phone.trim(),
        district,
        thana || null,
        addressLine.trim(),
        postalCode || null,
        isDefault ? 1 : 0,
      ]
    );

    const addrId = firstInsertId(result);
    const rows = await query('SELECT * FROM user_addresses WHERE id = ?', [addrId]);
    res.json({ ok: true, address: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not save address' });
  }
});

router.delete('/addresses/:id', requireAuth, async (req, res) => {
  try {
    await query('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.session.userId,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not delete address' });
  }
});

router.get('/review-videos/config', requireAuth, async (req, res) => {
  try {
    const config = await getRewardPointConfig(query);
    res.json({
      ok: true,
      enabled: config.enabled,
      videoReviewPoints: config.videoReview,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load review video settings' });
  }
});

router.get('/review-videos/eligible', requireAuth, async (req, res) => {
  try {
    const eligible = await listEligibleReviewVideoProducts(query, req.session.userId);
    res.json({ ok: true, eligible });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load eligible products' });
  }
});

router.get('/review-videos', requireAuth, async (req, res) => {
  try {
    const videos = await listUserReviewVideos(query, req.session.userId);
    res.json({ ok: true, videos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load review videos' });
  }
});

router.post('/review-videos/upload', requireAuth, (req, res) => {
  videoUpload.single('video')(req, res, async (err) => {
    if (err) {
      if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {});
      const error =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Video is too large. Maximum size is 1 GB.'
          : err.message || 'Invalid video upload';
      return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ ok: false, error });
    }
    try {
      if (!req.file) return res.status(400).json({ ok: false, error: 'No video uploaded' });
      const saved = await saveVideoFile(req.file);
      res.json({ ok: true, url: saved.url });
    } catch (uploadErr) {
      if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {});
      console.error('review video upload', uploadErr);
      res.status(500).json({ ok: false, error: 'Could not upload video' });
    }
  });
});

router.post('/review-videos', requireAuth, async (req, res) => {
  try {
    const { orderId, productId, videoUrl } = req.body || {};
    const result = await createReviewVideoSubmission(query, req.session.userId, {
      orderId,
      productId,
      videoUrl,
    });
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not submit review video' });
  }
});

function photoReviewImageUrl(url) {
  const value = String(url || '').trim();
  if (!value.startsWith('/uploads/') || value.startsWith('/uploads/review-videos/')) return null;
  if (value.includes('..') || value.includes('\\')) return null;
  return value.slice(0, 500);
}

router.get('/photo-reviews/eligible', requireAuth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT DISTINCT o.id AS order_id, o.order_number, oi.product_id, oi.product_name
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = ? AND LOWER(o.status) = 'delivered' AND oi.product_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM product_reviews r
           WHERE r.user_id = o.user_id AND r.product_id = oi.product_id
             AND r.image_url IS NOT NULL AND r.status IN ('pending', 'approved')
         )
       ORDER BY o.id DESC`,
      [req.session.userId]
    );
    const seen = new Set();
    const eligible = [];
    for (const r of rows) {
      const pid = Number(r.product_id ?? r.productId);
      if (seen.has(pid)) continue;
      seen.add(pid);
      eligible.push({
        orderId: Number(r.order_id ?? r.orderId),
        orderNumber: r.order_number ?? r.orderNumber,
        productId: pid,
        productName: r.product_name ?? r.productName,
      });
    }
    res.json({ ok: true, eligible });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load eligible products' });
  }
});

router.get('/photo-reviews', requireAuth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT r.id, r.product_id, r.rating, r.comment, r.image_url, r.status, r.created_at,
              p.name_bn AS product_name, p.slug AS product_slug
       FROM product_reviews r LEFT JOIN products p ON p.id = r.product_id
       WHERE r.user_id = ? AND r.image_url IS NOT NULL
       ORDER BY r.created_at DESC LIMIT 50`,
      [req.session.userId]
    );
    res.json({
      ok: true,
      reviews: rows.map((r) => ({
        id: r.id,
        productId: r.product_id ?? r.productId,
        productName: r.product_name ?? r.productName,
        productSlug: r.product_slug ?? r.productSlug,
        rating: Number(r.rating) || 0,
        comment: r.comment || '',
        imageUrl: r.image_url ?? r.imageUrl,
        status: r.status,
        createdAt: r.created_at ?? r.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load photo reviews' });
  }
});

router.post('/photo-reviews', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const orderId = Number(req.body?.orderId);
    const productId = Number(req.body?.productId);
    const rating = Math.round(Number(req.body?.rating) || 0);
    const comment = String(req.body?.comment || '').trim().slice(0, 2000);
    const imageUrl = photoReviewImageUrl(req.body?.imageUrl);

    if (!orderId || !productId) return res.status(400).json({ ok: false, error: 'Please select a delivered product' });
    if (rating < 1 || rating > 5) return res.status(400).json({ ok: false, error: 'Please choose a rating (1–5 stars)' });
    if (!imageUrl) return res.status(400).json({ ok: false, error: 'Please upload a photo' });

    const orders = await query(
      `SELECT id FROM orders WHERE id = ? AND user_id = ? AND LOWER(status) = 'delivered' LIMIT 1`,
      [orderId, userId]
    );
    if (!orders.length) return res.status(400).json({ ok: false, error: 'Delivered order not found' });
    const items = await query('SELECT 1 FROM order_items WHERE order_id = ? AND product_id = ? LIMIT 1', [
      orderId,
      productId,
    ]);
    if (!items.length) return res.status(400).json({ ok: false, error: 'Product was not in this order' });

    const existing = await query(
      `SELECT id FROM product_reviews
       WHERE user_id = ? AND product_id = ? AND image_url IS NOT NULL AND status IN ('pending', 'approved') LIMIT 1`,
      [userId, productId]
    );
    if (existing.length) {
      return res.status(400).json({ ok: false, error: 'You already submitted a photo review for this product' });
    }

    const users = await query('SELECT full_name FROM users WHERE id = ? LIMIT 1', [userId]);
    const customerName = String(users[0]?.full_name ?? users[0]?.fullName ?? 'Customer').trim() || 'Customer';

    const result = await query(
      `INSERT INTO product_reviews (product_id, user_id, customer_name, rating, comment, image_url, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')${returningId()}`,
      [productId, userId, customerName, rating, comment || null, imageUrl]
    );
    res.json({ ok: true, id: firstInsertId(result), status: 'pending' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not submit photo review' });
  }
});

module.exports = router;
