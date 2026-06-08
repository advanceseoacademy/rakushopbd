const { query } = require('../config/db');
const { upsertSiteSettingSql } = require('./db-dialect');
const { clearSiteSettingsCache } = require('./siteSettings');

const DEFAULTS = [
  ['tracking_ga4_id', ''],
  ['tracking_gtm_id', ''],
  ['tracking_facebook_pixel_id', ''],
  ['tracking_scripts_head', ''],
  ['tracking_scripts_body', ''],
  ['tracking_scripts_footer', ''],
];

let ensured = false;

async function ensureTrackingSettings() {
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
    console.warn('Tracking settings:', err.message);
  }
}

module.exports = { ensureTrackingSettings };
