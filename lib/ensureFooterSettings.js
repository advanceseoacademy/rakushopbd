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
  { label: 'FAQ', href: '#' },
  { label: 'Contact / Appointment', page: 'appointment' },
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
    clearSiteSettingsCache();
    ensured = true;
  } catch (err) {
    console.warn('Footer settings:', err.message);
  }
}

module.exports = { ensureFooterSettings };
