/** HTTP cache helpers — align with Chrome “efficient cache lifetimes” (≥30 days for static assets). */
const ONE_YEAR_SEC = 31536000;
const ONE_MONTH_SEC = 2592000;

function useLongStaticCache() {
  if (process.env.STATIC_CACHE === '0') return false;
  if (process.env.NODE_ENV === 'development') return false;
  return true;
}

function cacheControlPublic(maxAgeSec, { immutable = false, staleWhileRevalidate } = {}) {
  const parts = ['public', `max-age=${Math.max(0, Math.round(Number(maxAgeSec) || 0))}`];
  if (immutable) parts.push('immutable');
  if (staleWhileRevalidate != null) {
    parts.push(`stale-while-revalidate=${Math.round(Number(staleWhileRevalidate))}`);
  }
  return parts.join(', ');
}

/** Long-lived static asset (JS/CSS/images/uploads) — default 1 year. */
function cacheControlStaticAsset(maxAgeSec = ONE_YEAR_SEC) {
  return cacheControlPublic(maxAgeSec, { immutable: true });
}

function expressStaticOptions(maxAgeSec = ONE_YEAR_SEC) {
  if (!useLongStaticCache()) {
    return { etag: true, maxAge: 0 };
  }
  return {
    etag: true,
    maxAge: maxAgeSec * 1000,
    immutable: true,
    setHeaders(res) {
      res.setHeader('Cache-Control', cacheControlStaticAsset(maxAgeSec));
    },
  };
}

function applyStaticAssetCache(res, maxAgeSec = ONE_YEAR_SEC) {
  if (!useLongStaticCache()) {
    res.setHeader('Cache-Control', 'no-cache');
    return;
  }
  res.setHeader('Cache-Control', cacheControlStaticAsset(maxAgeSec));
}

module.exports = {
  ONE_YEAR_SEC,
  ONE_MONTH_SEC,
  useLongStaticCache,
  cacheControlPublic,
  cacheControlStaticAsset,
  expressStaticOptions,
  applyStaticAssetCache,
};
