/**
 * Admin auth routes on the Express app and/or the /api router.
 * api-router mount wins over /api/admin when server.js is stale on cPanel.
 */
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { signAdminToken, getAdminIdFromRequest, setAdminAuthCookie } = require('./adminToken');
const { formatAdminPublic } = require('./adminRoles');

function registerAdminAuthRoutes(register) {
  register('get', '/version', (req, res) => {
    res.json({ ok: true, apiVersion: 2, hasAuthToken: true, source: register.source });
  });

  register('get', '/ping', async (req, res) => {
    try {
      const [row] = await query('SELECT COUNT(*) AS adminCount FROM admins');
      res.json({
        ok: true,
        adminCount: Number(row.adminCount) || 0,
        apiVersion: 2,
        source: register.source,
      });
    } catch (err) {
      console.error(err);
      const missingTable = err.code === 'ER_NO_SUCH_TABLE' || err.code === '42P01';
      res.status(missingTable ? 503 : 500).json({
        ok: false,
        error: missingTable ? 'admins table missing — run Supabase SQL' : 'Database error',
        code: err.code || null,
        hint:
          err.code === 'MODULE_NOT_FOUND'
            ? 'cPanel → Run NPM Install + git pull'
            : !process.env.DATABASE_URL
              ? 'Add DATABASE_URL in Node.js App env'
              : 'git pull + STOP → START; test /api/db-check',
      });
    }
  });

  register('post', '/login', async (req, res) => {
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
      res.json({
        ok: true,
        token,
        admin: formatAdminPublic(admin),
      });
    } catch (err) {
      console.error(err);
      const missingTable = err.code === 'ER_NO_SUCH_TABLE';
      res.status(missingTable ? 503 : 500).json({
        ok: false,
        error: missingTable
          ? 'admins table missing — run database/cpanel-admin-fix.sql in phpMyAdmin'
          : 'Login failed',
      });
    }
  });

  register('get', '/me', async (req, res) => {
    try {
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
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Could not load session' });
    }
  });
}

function registerAdminAuth(app) {
  const register = (method, subpath, handler) => {
    app[method](`/api/admin${subpath}`, handler);
  };
  register.source = 'server-bootstrap';
  registerAdminAuthRoutes(register);
}

function registerAdminAuthApiRouter(router) {
  const register = (method, subpath, handler) => {
    router[method](`/admin${subpath}`, handler);
  };
  register.source = 'api-bootstrap';
  registerAdminAuthRoutes(register);
}

module.exports = { registerAdminAuth, registerAdminAuthApiRouter };
