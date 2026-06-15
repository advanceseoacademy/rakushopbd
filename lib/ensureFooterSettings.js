const { query } = require('../config/db');
const { upsertSiteSettingSql } = require('./db-dialect');
const { clearSiteSettingsCache } = require('./siteSettings');

const DEFAULT_QUICK = JSON.stringify([
  { label: 'Home', page: 'home' },
  { label: 'All Categories', page: 'home' },
  { label: 'My Cart', page: 'cart' },
  { label: 'My Account', page: 'account' },
]);

const DEFAULT_HELP = JSON.stringify([
  { label: 'Track Order', href: '/track' },
  { label: 'Book Appointment', page: 'appointment' },
  { label: 'Shipping Info', href: '#' },
  { label: 'Raku Rewards', href: '/rewards' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Contact Us', href: '/contact' },
]);

const DEFAULTS = [
  ['footer_desc', "Bangladesh's trusted online shopping platform. Huge selection, great prices, and fast delivery."],
  ['store_hours', '9 AM — 10 PM'],
  ['site_logo_url', '/images/rakushopbd-logo.png'],
  ['social_facebook', 'https://www.facebook.com/rakushopbd'],
  ['social_instagram', ''],
  ['social_youtube', ''],
  ['social_whatsapp', ''],
  ['footer_legal_heading', 'Legal'],
  ['footer_quick_links', DEFAULT_QUICK],
  ['footer_help_links', DEFAULT_HELP],
];

let ensured = false;

function normalizeHelpLink(link) {
  if (!link || typeof link !== 'object') return link;
  const label = String(link.label || '').trim();
  if (label === 'Return Policy' && (!link.href || link.href === '#')) {
    return { label: 'Return Policy', href: '/return-policy' };
  }
  if (label === 'Privacy Policy' && (!link.href || link.href === '#')) {
    return { label: 'Privacy Policy', href: '/privacy-policy' };
  }
  if ((label === 'Terms & Conditions' || label === 'Terms') && (!link.href || link.href === '#')) {
    return { label: 'Terms & Conditions', href: '/terms-and-conditions' };
  }
  if (label === 'FAQ' && (!link.href || link.href === '#')) {
    return { label: 'FAQ', href: '/faq' };
  }
  if (
    (label === 'Contact Us' || label === 'Contact / Appointment') &&
    (link.page === 'appointment' || !link.href || link.href === '#')
  ) {
    return { label: 'Contact Us', href: '/contact' };
  }
  if (link.page === 'faq') return { label: label || 'FAQ', href: '/faq' };
  if (link.page === 'rewards') return { label: label || 'Raku Rewards', href: '/rewards' };
  if (link.page === 'contact') return { label: label || 'Contact Us', href: '/contact' };
  if (link.page === 'privacy') return { label: label || 'Privacy Policy', href: '/privacy-policy' };
  if (link.page === 'terms') return { label: label || 'Terms & Conditions', href: '/terms-and-conditions' };
  if (link.page === 'return') return { label: label || 'Return Policy', href: '/return-policy' };
  if (link.page === 'points') return { label: label || 'Reward Point Policy', href: '/reward-point-policy' };
  return link;
}

const PAGE_HREFS = {
  home: '/',
  cart: '/cart',
  account: '/account',
  appointment: '/appointment',
  track: '/track',
  faq: '/faq',
  rewards: '/rewards',
  contact: '/contact',
  privacy: '/privacy-policy',
  terms: '/terms-and-conditions',
  return: '/return-policy',
  preorder: '/pre-order-policy',
  points: '/reward-point-policy',
};

const LEGAL_HREFS = new Set([
  '/privacy-policy',
  '/terms-and-conditions',
  '/return-policy',
  '/pre-order-policy',
  '/reward-point-policy',
]);

const LEGAL_LABELS = new Set([
  'privacy policy',
  'terms & conditions',
  'terms',
  'return policy',
  'pre-order policy',
  'reward point policy',
]);

function footerLinkDest(link) {
  const normalized = normalizeHelpLink(link);
  if (!normalized) return '';
  if (normalized.page) {
    const href = PAGE_HREFS[normalized.page] || '';
    if (href) return href;
    return `page:${normalized.page}`;
  }
  const href = String(normalized.href || '#').trim();
  if (href && href !== '#') return href;
  return '';
}

function footerLinkKey(link) {
  const normalized = normalizeHelpLink(link);
  if (!normalized) return '';
  const label = String(normalized.label || '').trim().toLowerCase();
  const dest = footerLinkDest(link);
  if (label && dest) return `${label}::${dest}`;
  if (dest) return dest;
  return label ? `label:${label}` : '';
}

function footerLinkDestKey(link) {
  const dest = footerLinkDest(link);
  return dest ? `dest:${dest}` : footerLinkKey(link);
}

function dedupeFooterLinks(links) {
  const seen = new Set();
  const out = [];
  for (const link of links) {
    const key = footerLinkKey(link);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(normalizeHelpLink(link));
  }
  return out;
}

function isLegalFooterLink(link) {
  const normalized = normalizeHelpLink(link);
  if (!normalized) return false;
  const label = String(normalized.label || '').trim().toLowerCase();
  if (LEGAL_LABELS.has(label)) return true;
  if (normalized.page === 'privacy' || normalized.page === 'terms' || normalized.page === 'return' || normalized.page === 'preorder' || normalized.page === 'points') {
    return true;
  }
  const href = String(normalized.href || '').trim();
  return LEGAL_HREFS.has(href);
}

async function migrateFooterHelpLinks() {
  const rows = await query(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
    ['footer_help_links']
  );
  if (!rows.length) return;
  let links;
  try {
    links = JSON.parse(String(rows[0].setting_value || '[]'));
  } catch (_) {
    return;
  }
  if (!Array.isArray(links)) return;
  const next = dedupeFooterLinks(links.map(normalizeHelpLink).filter((link) => !isLegalFooterLink(link)));
  const changed = JSON.stringify(next) !== JSON.stringify(links);
  if (!changed) return;
  await query(upsertSiteSettingSql(), ['footer_help_links', JSON.stringify(next)]);
}

async function migrateFooterQuickLinks() {
  const helpRows = await query(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
    ['footer_help_links']
  );
  let helpKeys = new Set();
  if (helpRows.length) {
    try {
      const helpLinks = JSON.parse(String(helpRows[0].setting_value || '[]'));
      if (Array.isArray(helpLinks)) {
        helpKeys = new Set(helpLinks.map((link) => footerLinkDestKey(link)).filter(Boolean));
      }
    } catch (_) {}
  }

  const rows = await query(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
    ['footer_quick_links']
  );
  if (!rows.length) return;
  let links;
  try {
    links = JSON.parse(String(rows[0].setting_value || '[]'));
  } catch (_) {
    return;
  }
  if (!Array.isArray(links)) return;

  const next = dedupeFooterLinks(
    links
      .map(normalizeHelpLink)
      .filter((link) => {
        const key = footerLinkKey(link);
        if (!key) return false;
        if (helpKeys.has(footerLinkDestKey(link))) return false;
        if (isLegalFooterLink(link)) return false;
        return true;
      })
  );
  const changed = JSON.stringify(next) !== JSON.stringify(links);
  if (!changed) return;
  await query(upsertSiteSettingSql(), ['footer_quick_links', JSON.stringify(next)]);
}

async function ensureFooterSettings() {
  if (ensured) return;
  try {
    for (const [key, value] of DEFAULTS) {
      const rows = await query(
        'SELECT setting_key FROM site_settings WHERE setting_key = ? LIMIT 1',
        [key]
      );
      if (!rows.length) {
        await query(upsertSiteSettingSql(), [key, value]);
      }
    }
    await migrateFooterHelpLinks();
    await migrateFooterQuickLinks();
    clearSiteSettingsCache();
    ensured = true;
  } catch (err) {
    console.warn('Footer settings:', err.message);
  }
}

module.exports = { ensureFooterSettings };
