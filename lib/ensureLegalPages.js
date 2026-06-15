const { query } = require('../config/db');
const { upsertSiteSettingSql } = require('./db-dialect');
const { clearSiteSettingsCache } = require('./siteSettings');
const { legalDefaults } = require('./legalPages');

let ensured = false;

async function ensureLegalPages() {
  if (ensured) return;
  try {
    let siteName = 'RakuShopBD';
    try {
      const rows = await query(
        'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
        ['site_name']
      );
      if (rows.length && rows[0].setting_value) siteName = String(rows[0].setting_value);
    } catch (_) {}

    for (const [key, value] of legalDefaults(siteName)) {
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

    const oldPointsTitles = ['Raku Shop BD Reward Point Policy', 'RakuShopBD Reward Point Policy'];
    const titleRows = await query(
      'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
      ['legal_points_title']
    );
    if (titleRows.length) {
      const current = String(titleRows[0].setting_value ?? '').trim();
      if (oldPointsTitles.includes(current)) {
        await query(upsertSiteSettingSql(), ['legal_points_title', 'Reward Point Policy']);
      }
    }
    clearSiteSettingsCache();
    ensured = true;
  } catch (err) {
    console.warn('Legal pages settings:', err.message);
  }
}

module.exports = { ensureLegalPages };
