const { query } = require('../config/db');
const { upsertSiteSettingSql } = require('./db-dialect');
const { clearSiteSettingsCache } = require('./siteSettings');
const { rewardPointSettingDefaults } = require('./rewardPointSettings');

let ensured = false;

async function ensureRewardPointSettings() {
  if (ensured) return;
  try {
    for (const [key, value] of rewardPointSettingDefaults()) {
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
    console.warn('Reward point settings:', err.message);
  }
}

module.exports = { ensureRewardPointSettings };
