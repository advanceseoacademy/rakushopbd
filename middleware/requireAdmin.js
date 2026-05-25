function requireAdmin(req, res, next) {
  if (!req.session.adminId) {
    return res.status(401).json({ ok: false, error: 'Admin login required' });
  }
  next();
}

module.exports = { requireAdmin };
