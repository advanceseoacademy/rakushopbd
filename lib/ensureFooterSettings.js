const { query } = require('../config/db');
const { upsertSiteSettingSql } = require('./db-dialect');
const { clearSiteSettingsCache } = require('./siteSettings');

const DEFAULT_QUICK = JSON.stringify([
  { label: 'Home', page: 'home' },
  { label: 'All Categories', page: 'home' },
  { label: 'My Cart', page: 'cart' },
  { label: 'My Account', page: 'account' },
  { label: 'Track Order', href: '/track' },
  { label: 'Book Appointment', page: 'appointment' },
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
  return link;
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
  const legalLabels = new Set(['Privacy Policy', 'Terms & Conditions', 'Terms', 'Return Policy']);
  const next = links
    .map(normalizeHelpLink)
    .filter((link) => {
      const label = String(link?.label || '').trim();
      const href = String(link?.href || '');
      if (legalLabels.has(label)) return false;
      if (href === '/privacy-policy' || href === '/terms-and-conditions' || href === '/return-policy') {
        return false;
      }
      return true;
    });
  const changed = JSON.stringify(next) !== JSON.stringify(links);
  if (!changed) return;
  await query(upsertSiteSettingSql(), ['footer_help_links', JSON.stringify(next)]);
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
    clearSiteSettingsCache();
    ensured = true;
  } catch (err) {
    console.warn('Footer settings:', err.message);
  }
}

module.exports = { ensureFooterSettings };
