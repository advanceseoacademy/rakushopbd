const { requestHost } = require('./forceWww');

const RESELLER_HOSTS = new Set(
  String(process.env.RESELLER_HOSTS || 'reseller.rakushopbd.com')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
);

function isResellerRequest(req) {
  const host = requestHost(req);
  if (RESELLER_HOSTS.has(host)) return true;
  // Local / staging: /r/* path prefix or header
  if (process.env.NODE_ENV !== 'production') {
    if (req.get('x-raku-reseller') === '1') return true;
    const p = String(req.path || '');
    if (p === '/r' || p.startsWith('/r/')) return true;
  }
  return false;
}

function stripResellerPath(pathname) {
  const p = String(pathname || '/');
  if (p === '/r') return '/';
  if (p.startsWith('/r/')) return p.slice(2) || '/';
  return p;
}

module.exports = { isResellerRequest, stripResellerPath, RESELLER_HOSTS };
