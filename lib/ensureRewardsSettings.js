const { query } = require('../config/db');
const { upsertSiteSettingSql } = require('./db-dialect');
const { clearSiteSettingsCache } = require('./siteSettings');
const {
  getDefaultRewardsContent,
  parseRewardsContent,
  needsRewardsContentBackfill,
} = require('./rewardsPage');

let ensured = false;

async function ensureRewardsSettings() {
  if (ensured) return;
  try {
    const key = 'rewards_page_content';
    const rows = await query(
      'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
      [key]
    );
    const existing = rows[0]?.setting_value;
    const merged = parseRewardsContent({ rewards_page_content: existing });
    const mergedJson = JSON.stringify(merged);

    if (!rows.length || needsRewardsContentBackfill(existing)) {
      await query(upsertSiteSettingSql(), [key, mergedJson]);
    }

    clearSiteSettingsCache();
    ensured = true;
  } catch (err) {
    console.warn('Rewards settings:', err.message);
  }
}

module.exports = { ensureRewardsSettings };
