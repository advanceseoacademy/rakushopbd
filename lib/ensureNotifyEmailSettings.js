const { query } = require('../config/db');
const { upsertSiteSettingSql } = require('./db-dialect');
const { clearSiteSettingsCache } = require('./siteSettings');
const { DEFAULT_NOTIFY_EMAIL } = require('./emailNotify');
const { smtpSettingDefaults } = require('./smtpSettings');

let ensured = false;

async function ensureNotifyEmailSettings() {
  if (ensured) return;
  try {
    for (const [key, fallback] of smtpSettingDefaults()) {
      const rows = await query(
        'SELECT setting_key, setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
        [key]
      );
      if (!rows.length) {
        let value = fallback;
        if (key === 'notify_email') value = process.env.NOTIFY_EMAIL || DEFAULT_NOTIFY_EMAIL;
        if (key === 'smtp_host') value = process.env.SMTP_HOST || fallback;
        if (key === 'smtp_port') value = process.env.SMTP_PORT || fallback;
        if (key === 'smtp_user') value = process.env.SMTP_USER || fallback;
        if (key === 'smtp_pass') value = process.env.SMTP_PASS || '';
        await query(upsertSiteSettingSql(), [key, value]);
      } else if (key === 'smtp_pass' && !String(rows[0].setting_value ?? '').trim() && process.env.SMTP_PASS) {
        await query(upsertSiteSettingSql(), [key, process.env.SMTP_PASS]);
      }
    }
    clearSiteSettingsCache();
    ensured = true;
  } catch (err) {
    console.warn('Notify email settings:', err.message);
  }
}

module.exports = { ensureNotifyEmailSettings };
