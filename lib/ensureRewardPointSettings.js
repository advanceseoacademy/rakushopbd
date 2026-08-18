const { query } = require('../config/db');
const { upsertSiteSettingSql } = require('./db-dialect');
const { clearSiteSettingsCache } = require('./siteSettings');
const { rewardPointSettingDefaults } = require('./rewardPointSettings');

let ensured = false;

async function ensureRewardPointSettings() {
  if (ensured) return;
  try {
    let addedBalancePercent = false;
    for (const [key, value] of rewardPointSettingDefaults()) {
      const rows = await query(
        'SELECT setting_key FROM site_settings WHERE setting_key = ? LIMIT 1',
        [key]
      );
      if (!rows.length) {
        await query(upsertSiteSettingSql(), [key, value]);
        if (key === 'reward_points_max_balance_percent') addedBalancePercent = true;
      }
    }
    const minRows = await query(
      'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
      ['reward_points_min_redeem']
    );
    const minVal = String(minRows[0]?.setting_value ?? minRows[0]?.settingValue ?? '');
    if (addedBalancePercent || minVal === '500') {
      await query(upsertSiteSettingSql(), ['reward_points_min_redeem', '1']);
    }
    clearSiteSettingsCache();
    ensured = true;
  } catch (err) {
    console.warn('Reward point settings:', err.message);
  }
}

module.exports = { ensureRewardPointSettings };
