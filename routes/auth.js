const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { formatPrice } = require('../lib/format');
const { saveSession } = require('../lib/sessionSave');
const { returningId } = require('../lib/db-dialect');
const { firstInsertId } = require('../config/db');
const { getSiteSettings } = require('../lib/siteSettings');
const { normalizeSiteBaseUrl } = require('../lib/seo');
const {
  processNewUserRewards,
  assignReferralCode,
  getRewardPointConfig,
} = require('../lib/rewardPoints');
const { videoUpload } = require('../lib/uploadVideo');
const { saveVideoFile } = require('../lib/saveVideoFile');
const {
  listUserReviewVideos,
  listEligibleReviewVideoProducts,
  createReviewVideoSubmission,
} = require('../lib/reviewVideos');

const router = express.Router();

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

router.post('/register', async (req, res) => {
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

router.post('/login', async (req, res) => {
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
  req.session = null;
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
      `SELECT id, order_number, total, status, payment_method, created_at
       FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [req.session.userId]
    );

    const withItems = await Promise.all(
      orders.map(async (o) => {
        const items = await query(
          'SELECT product_name, quantity, unit_price, line_total FROM order_items WHERE order_id = ?',
          [o.id]
        );
        return {
          id: o.id,
          orderNumber: o.order_number,
          total: Number(o.total),
          totalFormatted: formatPrice(o.total),
          status: o.status,
          paymentMethod: o.payment_method,
          createdAt: o.created_at,
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
      return res.status(400).json({ ok: false, error: err.message || 'Invalid video upload' });
    }
    try {
      if (!req.file) return res.status(400).json({ ok: false, error: 'No video uploaded' });
      const saved = await saveVideoFile(req.file);
      res.json({ ok: true, url: saved.url });
    } catch (uploadErr) {
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

module.exports = router;
