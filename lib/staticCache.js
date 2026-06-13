const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const ONE_YEAR_SEC = 31536000;

function isProductionEnv() {
  return process.env.NODE_ENV === 'production';
}

function parseMaxAgeSec(maxAge) {
  if (typeof maxAge === 'number') return Math.floor(maxAge / 1000);
  const raw = String(maxAge || '').trim().toLowerCase();
  const m = raw.match(/^(\d+(?:\.\d+)?)([smhdwy])?$/);
  if (!m) return ONE_YEAR_SEC;
  const n = Number(m[1]);
  switch (m[2] || 'ms') {
    case 'y':
      return Math.floor(n * 365 * 24 * 60 * 60);
    case 'd':
      return Math.floor(n * 24 * 60 * 60);
    case 'h':
      return Math.floor(n * 60 * 60);
    case 'm':
      return Math.floor(n * 60);
    case 's':
      return Math.floor(n);
    default:
      return Math.floor(n / 1000);
  }
}

function applyStaticCacheHeaders(res, { maxAgeSec = ONE_YEAR_SEC, immutable = false } = {}) {
  if (!isProductionEnv()) {
    res.set('Cache-Control', 'no-cache');
    return;
  }
  const parts = ['public', `max-age=${maxAgeSec}`];
  if (immutable) parts.push('immutable');
  res.set('Cache-Control', parts.join(', '));
}

function expressStaticCache(maxAge, { immutable = true } = {}) {
  const maxAgeSec = parseMaxAgeSec(maxAge);
  return {
    maxAge: isProductionEnv() ? maxAge : 0,
    etag: true,
    lastModified: true,
    immutable: isProductionEnv() && immutable,
    setHeaders(res) {
      applyStaticCacheHeaders(res, { maxAgeSec, immutable });
    },
  };
}

module.exports = {
  ONE_YEAR_MS,
  ONE_YEAR_SEC,
  isProductionEnv,
  applyStaticCacheHeaders,
  expressStaticCache,
};
