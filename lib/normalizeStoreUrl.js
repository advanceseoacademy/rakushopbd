const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function siteHostname() {
  const raw = String(process.env.SITE_URL || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).hostname;
  } catch (_) {
    return '';
  }
}

function isLocalDevHost(hostname) {
  return LOCAL_HOSTS.has(String(hostname || '').toLowerCase());
}

function normalizeStoreUrl(input, opts = {}) {
  const raw = String(input || '').trim();
  if (!raw) return raw;
  if (!/^https?:\/\//i.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (isLocalDevHost(url.hostname)) {
      const path = `${url.pathname || '/'}${url.search || ''}${url.hash || ''}`;
      return path || '/';
    }
    const host = opts.siteHost || siteHostname();
    if (host && url.hostname === host) {
      const path = `${url.pathname || '/'}${url.search || ''}${url.hash || ''}`;
      return path || '/';
    }
  } catch (_) {}
  return raw;
}

function isExternalStoreUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function categoryHref(slug) {
  const s = normalizeStoreUrl(slug);
  if (isExternalStoreUrl(s)) return s;
  if (s.startsWith('/')) return s;
  return `/category/${encodeURIComponent(s)}`;
}

module.exports = {
  normalizeStoreUrl,
  isExternalStoreUrl,
  categoryHref,
  isLocalDevHost,
};
