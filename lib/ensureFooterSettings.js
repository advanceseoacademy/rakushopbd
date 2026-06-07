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
  { label: 'Return Policy', href: '#' },
  { label: 'Shipping Info', href: '#' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Contact Us', href: '/contact' },
]);

const DEFAULTS = [
  ['footer_desc', "Bangladesh's trusted online shopping platform. Huge selection, great prices, and fast delivery."],
  ['store_hours', '9 AM — 10 PM'],
  ['site_logo_url', '/images/rakushopbd-logo.png'],
  ['social_facebook', ''],
  ['social_instagram', ''],
  ['social_youtube', ''],
  ['social_whatsapp', ''],
  ['footer_quick_links', DEFAULT_QUICK],
  ['footer_help_links', DEFAULT_HELP],
];

let ensured = false;

function normalizeHelpLink(link) {
  if (!link || typeof link !== 'object') return link;
  const label = String(link.label || '').trim();
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
  if (link.page === 'contact') return { label: label || 'Contact Us', href: '/contact' };
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
  const next = links.map(normalizeHelpLink);
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
