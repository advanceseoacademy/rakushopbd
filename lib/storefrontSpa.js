/** Storefront SPA paths — direct URL reload must serve index.ejs (not 404). */
const STOREFRONT_SPA_EXACT_PATHS = new Set([
  '/account',
  '/cart',
  '/checkout',
  '/wishlist',
  '/success',
  '/appointment',
  '/faq',
  '/blog',
  '/about',
  '/about-us',
  '/contact',
  '/track',
  '/privacy-policy',
  '/terms-and-conditions',
  '/return-policy',
  '/pre-order-policy',
  '/reward-point-policy',
]);

function normalizeStorefrontPath(pathname) {
  const raw = String(pathname || '/').split('?')[0].split('#')[0];
  if (raw === '/' || raw === '') return '/';
  return raw.replace(/\/+$/, '') || '/';
}

function isStorefrontSpaPath(pathname) {
  const path = normalizeStorefrontPath(pathname);
  if (path === '/') return true;
  if (STOREFRONT_SPA_EXACT_PATHS.has(path)) return true;
  if (/^\/product\/[^/]+$/.test(path)) return true;
  if (/^\/category\/[^/]+$/.test(path)) return true;
  if (/^\/blog\/[^/]+$/.test(path)) return true;
  return false;
}

module.exports = {
  STOREFRONT_SPA_EXACT_PATHS,
  normalizeStorefrontPath,
  isStorefrontSpaPath,
};
