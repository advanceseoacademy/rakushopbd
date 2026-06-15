const { query } = require('../config/db');
const { upsertSiteSettingSql } = require('./db-dialect');
const { clearSiteSettingsCache } = require('./siteSettings');
const { normalizeSiteBaseUrl } = require('./seo');

const DEFAULTS = [
  ['seo_meta_description', 'RakuShopBD — Bangladesh online shop for quality products, great prices, and fast nationwide delivery.'],
  ['seo_meta_keywords', 'RakuShopBD, online shopping Bangladesh, ecommerce, delivery'],
  ['seo_og_image', ''],
  ['site_url', ''],
  ['seo_google_verification', ''],
  ['seo_twitter_handle', ''],
  ['seo_home_title', ''],
];

let ensured = false;

async function ensureSeoSettings() {
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

    const urlRows = await query(
      'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
      ['site_url']
    );
    if (urlRows.length) {
      const current = String(urlRows[0].setting_value ?? '').trim();
      const fixed = normalizeSiteBaseUrl(current);
      if (current && fixed && fixed !== current) {
        await query(upsertSiteSettingSql(), ['site_url', fixed]);
      }
    }

    clearSiteSettingsCache();
    ensured = true;
  } catch (err) {
    console.warn('SEO settings:', err.message);
  }
}

module.exports = { ensureSeoSettings };
