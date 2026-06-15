const { query } = require('../config/db');
const { upsertSiteSettingSql } = require('./db-dialect');
const { clearSiteSettingsCache } = require('./siteSettings');
const { MARKETING_DEFAULTS } = require('./marketingDefaults');

const DEFAULTS = [
  ...Object.entries(MARKETING_DEFAULTS),
  ['hero_side_slider_enabled', '1'],
  ['hero_side_slides', '[]'],
  ['hero_side_slider_interval', '4500'],
  ['today_deals_enabled', '1'],
  ['today_deals_title', 'Today Deals'],
  ['today_deals_ends_at', ''],
  ['today_deals_product_ids', '[]'],
];

let ensured = false;

async function ensureMarketingSettings() {
  if (ensured) return;
  try {
    for (const [key, value] of DEFAULTS) {
      const rows = await query(
        'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
        [key]
      );
      if (!rows.length) {
        await query(upsertSiteSettingSql(), [key, value]);
      } else if (!String(rows[0].setting_value ?? '').trim() && String(value ?? '').trim()) {
        await query(upsertSiteSettingSql(), [key, value]);
      }
    }
    clearSiteSettingsCache();
    ensured = true;
  } catch (err) {
    console.warn('Marketing settings:', err.message);
  }
}

module.exports = { ensureMarketingSettings };
