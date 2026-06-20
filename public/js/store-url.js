/**
 * Normalize dev/local URLs to site-relative paths; navigate internal SPA routes.
 */
(function (global) {
  const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

  const INTERNAL_PATH_PAGES = {
    '/': 'home',
    '/appointment': 'appointment',
    '/faq': 'faq',
    '/contact': 'contact',
    '/track': 'track',
    '/cart': 'cart',
    '/checkout': 'checkout',
    '/account': 'account',
    '/wishlist': 'wishlist',
    '/privacy-policy': 'privacy',
    '/terms-and-conditions': 'terms',
    '/return-policy': 'return',
    '/pre-order-policy': 'preorder',
    '/reward-point-policy': 'points',
  };

  function isLocalDevHost(hostname) {
    return LOCAL_HOSTS.has(String(hostname || '').toLowerCase());
  }

  function normalizeStoreUrl(input) {
    const raw = String(input || '').trim();
    if (!raw) return raw;
    if (!/^https?:\/\//i.test(raw)) return raw;
    try {
      const url = new URL(raw);
      if (isLocalDevHost(url.hostname)) {
        const path = `${url.pathname || '/'}${url.search || ''}${url.hash || ''}`;
        return path || '/';
      }
      if (global.location?.hostname && url.hostname === global.location.hostname) {
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

  function pageFromPath(path) {
    const clean = String(path || '').trim().replace(/\/+$/, '') || '/';
    return INTERNAL_PATH_PAGES[clean] || null;
  }

  function navigateStoreLink(value) {
    const normalized = normalizeStoreUrl(value);
    if (isExternalStoreUrl(normalized)) {
      global.open(normalized, '_blank', 'noopener,noreferrer');
      return;
    }
    if (normalized.startsWith('/')) {
      const page = pageFromPath(normalized);
      if (page && global.showPage) {
        global.showPage(page);
        return;
      }
      global.location.href = normalized;
      return;
    }
    if (global.openCategory) global.openCategory(normalized);
  }

  global.rakuNormalizeStoreUrl = normalizeStoreUrl;
  global.rakuIsExternalStoreUrl = isExternalStoreUrl;
  global.rakuCategoryHref = categoryHref;
  global.rakuNavigateStoreLink = navigateStoreLink;
})(window);
