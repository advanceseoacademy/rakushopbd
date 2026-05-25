/**
 * Admin auth routes registered on the Express app (not only the router).
 * Ensures /api/admin/version, /login, /me work even if the router cache is stale on cPanel.
 */
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { signAdminToken, getAdminIdFromRequest } = require('./adminToken');

function registerAdminAuth(app) {
  app.get('/api/admin/version', (req, res) => {
    res.json({ ok: true, apiVersion: 2, hasAuthToken: true, source: 'server-bootstrap' });
  });

  app.get('/api/admin/ping', async (req, res) => {
    try {
      const [row] = await query('SELECT COUNT(*) AS adminCount FROM admins');
      res.json({
        ok: true,
        adminCount: Number(row.adminCount) || 0,
        apiVersion: 2,
        source: 'server-bootstrap',
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Database error' });
    }
  });

  app.post('/api/admin/login', async (req, res) => {
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
      res.json({
        ok: true,
        token: signAdminToken(admin.id),
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          fullName: admin.full_name,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Login failed' });
    }
  });

  app.get('/api/admin/me', async (req, res) => {
    try {
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
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Could not load session' });
    }
  });
}

module.exports = { registerAdminAuth };
