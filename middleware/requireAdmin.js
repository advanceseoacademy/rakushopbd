const { getAdminIdFromRequest } = require('../lib/adminToken');

function requireAdmin(req, res, next) {
  const adminId = getAdminIdFromRequest(req);
  if (!adminId) {
    return res.status(401).json({ ok: false, error: 'Admin login required' });
  }
  req.adminId = adminId;
  next();
}

module.exports = { requireAdmin };
