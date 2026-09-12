const crypto = require('crypto');
const { getAdminIdFromRequest } = require('./adminToken');

function timingSafeEqualString(a, b) {
  try {
    const bufA = Buffer.from(String(a), 'utf8');
    const bufB = Buffer.from(String(b), 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Diagnostic endpoints must not be public.
 * Behind LiteSpeed/nginx, req.socket is often 127.0.0.1 for all traffic,
 * so loopback alone is NOT enough in production.
 *
 * Allowed when:
 * - logged-in admin, or
 * - DIAGNOSTIC_KEY matches (?key= / x-diagnostic-key), or
 * - non-production AND direct loopback TCP peer
 */
function requireAdminOrLocal(req, res, next) {
  if (getAdminIdFromRequest(req)) return next();

  const expected = String(process.env.DIAGNOSTIC_KEY || '').trim();
  const provided = String(req.query.key || req.headers['x-diagnostic-key'] || '').trim();
  if (expected && provided && timingSafeEqualString(expected, provided)) return next();

  if (process.env.NODE_ENV !== 'production') {
    const raw = String(req.socket?.remoteAddress || '');
    if (raw === '127.0.0.1' || raw === '::1' || raw === '::ffff:127.0.0.1') return next();
  }

  return res.status(404).json({ ok: false, error: 'Not found' });
}

module.exports = {
  requireAdminOrLocal,
};
