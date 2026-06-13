const { query } = require('../config/db');
const { upsertSiteSettingSql } = require('./db-dialect');
const { clearSiteSettingsCache } = require('./siteSettings');

const DEFAULTS = [
  ['marketing_enabled', '1'],
  [
    'marketing_card1_title',
    'Save More with Group Shopping!',
  ],
  [
    'marketing_card1_desc',
    'Join friends and family to unlock amazing discounts on our selected popular products. Our group shopping feature lets you enjoy bulk savings while shopping together.',
  ],
  ['marketing_card1_btn', 'Start Group Shopping'],
  ['marketing_card1_link', '#products'],
  ['marketing_card1_image', ''],
  ['marketing_card1_bg', '#fce4ec'],
  ['marketing_card2_title', 'Get Surprise gift'],
  [
    'marketing_card2_desc',
    'Subscribe with your phone number to get new gifts and updates about our new products and offers',
  ],
  ['marketing_card2_btn', 'Submit'],
  ['marketing_card2_image', ''],
  ['marketing_card2_bg', '#ede7f6'],
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
    console.warn('Marketing settings:', err.message);
  }
}

module.exports = { ensureMarketingSettings };
