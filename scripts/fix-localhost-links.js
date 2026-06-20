#!/usr/bin/env node
/**
 * Fix localhost / 127.0.0.1 URLs saved in categories or site_settings.
 * Usage: node scripts/fix-localhost-links.js
 */
const { query } = require('../config/db');
const { normalizeStoreUrl } = require('../lib/normalizeStoreUrl');
const { upsertSiteSettingSql } = require('../lib/db-dialect');
const { clearSiteSettingsCache } = require('../lib/siteSettings');
const { clearStoreBootstrapCache } = require('../lib/storeBootstrap');

const LOCAL_RE = /localhost|127\.0\.0\.1/i;

async function fixCategories() {
  const rows = await query('SELECT id, slug, name_bn FROM categories').catch(() => []);
  let updated = 0;
  for (const row of rows) {
    const slug = String(row.slug || '');
    if (!LOCAL_RE.test(slug)) continue;
    const fixed = normalizeStoreUrl(slug);
    if (fixed === slug) continue;
    await query('UPDATE categories SET slug = ? WHERE id = ?', [fixed, row.id]);
    console.log(`category #${row.id} (${row.name_bn}): ${slug} -> ${fixed}`);
    updated += 1;
  }
  return updated;
}

function scanJsonForLocalhost(value, path = '') {
  const hits = [];
  if (typeof value === 'string') {
    if (LOCAL_RE.test(value)) hits.push({ path, value, fixed: normalizeStoreUrl(value) });
    return hits;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => hits.push(...scanJsonForLocalhost(item, `${path}[${i}]`)));
    return hits;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([k, v]) => hits.push(...scanJsonForLocalhost(v, path ? `${path}.${k}` : k)));
  }
  return hits;
}

function replaceLocalhostDeep(value) {
  if (typeof value === 'string') {
    return LOCAL_RE.test(value) ? normalizeStoreUrl(value) : value;
  }
  if (Array.isArray(value)) return value.map(replaceLocalhostDeep);
  if (value && typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([k, v]) => {
      out[k] = replaceLocalhostDeep(v);
    });
    return out;
  }
  return value;
}

async function fixSiteSettings() {
  const keys = [
    'footer_quick_links',
    'footer_help_links',
    'tracking_scripts_head',
    'tracking_scripts_body',
    'tracking_scripts_footer',
  ];
  let updated = 0;
  for (const key of keys) {
    const rows = await query('SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1', [key]).catch(
      () => []
    );
    if (!rows.length) continue;
    const raw = String(rows[0].setting_value || '');
    if (!LOCAL_RE.test(raw)) continue;
    let next = raw;
    try {
      const parsed = JSON.parse(raw);
      next = JSON.stringify(replaceLocalhostDeep(parsed));
    } catch (_) {
      next = normalizeStoreUrl(raw);
    }
    if (next === raw) continue;
    await query(upsertSiteSettingSql(), [key, next]);
    console.log(`site_settings.${key}: localhost URL(s) normalized`);
    updated += 1;
  }
  return updated;
}

async function main() {
  const catCount = await fixCategories();
  const settingCount = await fixSiteSettings();
  clearSiteSettingsCache();
  clearStoreBootstrapCache();
  console.log(`Done. categories=${catCount}, settings=${settingCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
