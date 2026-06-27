const { query } = require('../config/db');
const { getAdminIdFromRequest } = require('../lib/adminToken');
const {
  normalizeAdminRole,
  isProductEditorRole,
  isProductEditorAllowedRoute,
  isProductDeleteRoute,
  isSuperAdminRole,
} = require('../lib/adminRoles');

async function requireAdmin(req, res, next) {
  try {
    const adminId = getAdminIdFromRequest(req);
    if (!adminId) {
      return res.status(401).json({ ok: false, error: 'Admin login required' });
    }

    const rows = await query(
      'SELECT id, username, email, full_name, role FROM admins WHERE id = ? LIMIT 1',
      [adminId]
    );
    if (!rows.length) {
      return res.status(401).json({ ok: false, error: 'Admin login required' });
    }

    const admin = rows[0];
    req.adminId = adminId;
    req.adminRole = normalizeAdminRole(admin.role);
    req.adminUser = admin;

    const routePath = req.path || '';
    if (isProductEditorRole(req.adminRole)) {
      if (isProductDeleteRoute(req.method, routePath)) {
        return res.status(403).json({ ok: false, error: 'Product editors cannot delete products' });
      }
      if (!isProductEditorAllowedRoute(req.method, routePath)) {
        return res.status(403).json({ ok: false, error: 'Access denied' });
      }
    }

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Auth check failed' });
  }
}

function requireSuperAdmin(req, res, next) {
  if (!isSuperAdminRole(req.adminRole)) {
    return res.status(403).json({ ok: false, error: 'Super admin access required' });
  }
  next();
}

module.exports = { requireAdmin, requireSuperAdmin };
