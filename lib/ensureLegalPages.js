const { query } = require('../config/db');
const { upsertSiteSettingSql } = require('./db-dialect');
const { clearSiteSettingsCache } = require('./siteSettings');
const { legalDefaults, defaultContentForSlug } = require('./legalPages');

let ensured = false;

const LEGACY_POINTS_MARKERS = [
  'নতুন অ্যাকাউন্ট রেজিস্ট্রেশন</td><td>20 Points',
  'প্রথম অর্ডার সম্পন্ন</td><td>50 Points',
  'Photo Review</td><td>20 Points',
  'Friend Referral</td><td>50 Points',
  'Birthday Reward</td><td>100 Points',
];

function shouldMigratePointsPolicyContent(html) {
  const current = String(html || '').trim();
  if (!current) return false;
  if (LEGACY_POINTS_MARKERS.some((marker) => current.includes(marker))) return true;
  return current.includes('Reward Point Program') && !current.includes('Shop More • Earn More • Save More');
}

async function migratePointsPolicyContent(siteName) {
  const rows = await query(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
    ['legal_points_content']
  );
  if (!rows.length) return;
  let current = String(rows[0].setting_value ?? '');
  if (!current.trim()) return;

  if (shouldMigratePointsPolicyContent(current)) {
    await query(upsertSiteSettingSql(), [
      'legal_points_content',
      defaultContentForSlug('points', siteName),
    ]);
    return;
  }

  if (/Birthday Reward/i.test(current)) {
    current = current.replace(/<tr>\s*<td>\s*Birthday Reward\s*<\/td>\s*<td>[^<]*<\/td>\s*<\/tr>\s*/gi, '');
    await query(upsertSiteSettingSql(), ['legal_points_content', current]);
  }
}

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
    await migratePointsPolicyContent(siteName);
    clearSiteSettingsCache();
    ensured = true;
  } catch (err) {
    console.warn('Legal pages settings:', err.message);
  }
}

module.exports = { ensureLegalPages };
