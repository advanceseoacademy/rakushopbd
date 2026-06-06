const { query } = require('../config/db');
const { upsertSiteSettingSql } = require('./db-dialect');
const { clearSiteSettingsCache } = require('./siteSettings');

let ensured = false;

async function ensureFaceAnalyzerSetting() {
  if (ensured) return;
  try {
    const rows = await query(
      'SELECT setting_key FROM site_settings WHERE setting_key = ? LIMIT 1',
      ['face_analyzer_enabled']
    );
    if (!rows.length) {
      await query(upsertSiteSettingSql(), ['face_analyzer_enabled', '1']);
      clearSiteSettingsCache();
    }
    ensured = true;
  } catch (err) {
    console.warn('face_analyzer_enabled setting:', err.message);
  }
}

module.exports = { ensureFaceAnalyzerSetting };
