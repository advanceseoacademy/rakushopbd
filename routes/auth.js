const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { formatPrice } = require('../lib/format');

const router = express.Router();

function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at,
  };
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
    const rows = await query('SELECT id, full_name, email, phone, created_at FROM users WHERE id = ?', [
      req.session.userId,
    ]);
    if (!rows.length) {
      req.session.userId = null;
      return res.json({ ok: true, user: null });
    }
    res.json({ ok: true, user: sanitizeUser(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Could not load account' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;
    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ ok: false, error: 'All fields are required' });
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
      'INSERT INTO users (full_name, email, phone, password_hash) VALUES (?, ?, ?, ?)',
      [fullName.trim(), email.trim().toLowerCase(), phone.trim(), hash]
    );

    req.session.userId = result.insertId;
    const rows = await query('SELECT id, full_name, email, phone, created_at FROM users WHERE id = ?', [
      result.insertId,
    ]);
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error(saveErr);
        return res.status(500).json({ ok: false, error: 'Session save failed' });
      }
      res.json({ ok: true, user: sanitizeUser(rows[0]) });
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
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error(saveErr);
        return res.status(500).json({ ok: false, error: 'Session save failed' });
      }
      res.json({ ok: true, user: sanitizeUser(user) });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  req.session.userId = null;
  res.json({ ok: true });
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

    const rows = await query('SELECT id, full_name, email, phone, created_at FROM users WHERE id = ?', [
      req.session.userId,
    ]);
    res.json({ ok: true, user: sanitizeUser(rows[0]) });
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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

    const rows = await query('SELECT * FROM user_addresses WHERE id = ?', [result.insertId]);
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

module.exports = router;
