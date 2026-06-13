#!/usr/bin/env node
/**
 * Normalize malformed site_url in site_settings (e.g. "https, https://rakushopbd.com").
 */
require('dotenv').config();

const { query } = require('../config/db');
const { normalizeSiteBaseUrl } = require('../lib/seo');
const { upsertSiteSettingSql } = require('../lib/db-dialect');
const { clearSiteSettingsCache } = require('../lib/siteSettings');

async function main() {
  const rows = await query(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
    ['site_url']
  );
  const raw = String(rows[0]?.setting_value || '').trim();
  if (!raw) {
    console.log('site_url: empty, nothing to fix');
    return;
  }

  const fixed = normalizeSiteBaseUrl(raw);
  if (fixed === raw.replace(/\/$/, '') || fixed === raw) {
    console.log('site_url: already valid —', fixed);
    return;
  }

  await query(upsertSiteSettingSql(), ['site_url', fixed]);
  clearSiteSettingsCache();
  console.log('site_url: fixed —', raw, '→', fixed);
}

main().catch((err) => {
  console.warn('fix-seo-site-url:', err.message);
  process.exit(0);
});
