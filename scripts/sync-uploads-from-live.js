#!/usr/bin/env node
/**
 * Download missing /uploads files from live site into public/uploads (local dev).
 *
 * Usage:
 *   node scripts/sync-uploads-from-live.js
 *   SOURCE_URL=https://rakushopbd.com node scripts/sync-uploads-from-live.js --dry-run
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('../config/db');
const { findAlternateUpload } = require('../lib/legacyUploadWebp');
const { uploadDir } = require('../lib/imageOptimize');

const SOURCE_URL = (process.env.SOURCE_URL || 'https://rakushopbd.com').replace(/\/$/, '');
const DRY_RUN = process.argv.includes('--dry-run');

function publicPathFromUrl(url) {
  if (!url || !String(url).startsWith('/uploads/')) return null;
  const rel = String(url).replace(/^\//, '');
  if (rel.includes('..')) return null;
  return path.join(__dirname, '../public', rel);
}

function localExists(url) {
  const rel = String(url || '').replace(/^\//, '');
  const abs = path.join(uploadDir, rel);
  if (fs.existsSync(abs)) return true;
  return Boolean(findAlternateUpload(rel));
}

async function collectDbUploadUrls() {
  const urls = new Set();
  const add = (v) => {
    const s = String(v || '').trim();
    if (s.includes('/uploads/')) urls.add(s.startsWith('/') ? s : `/${s}`);
  };

  for (const row of await query(
    `SELECT image_url, og_image FROM products WHERE image_url IS NOT NULL OR og_image IS NOT NULL`
  )) {
    add(row.image_url);
    add(row.og_image);
  }
  for (const row of await query(
    `SELECT image_url FROM product_images WHERE image_url IS NOT NULL AND image_url != ''`
  )) {
    add(row.image_url);
  }
  for (const row of await query(
    `SELECT image_url FROM banners WHERE image_url IS NOT NULL AND image_url != ''`
  )) {
    add(row.image_url);
  }
  for (const row of await query(
    `SELECT image_url FROM messenger_chats WHERE image_url IS NOT NULL AND image_url != ''`
  )) {
    add(row.image_url);
  }
  for (const row of await query(
    `SELECT icon_url FROM categories WHERE icon_url IS NOT NULL AND icon_url != ''`
  )) {
    add(row.icon_url);
  }
  for (const row of await query(
    `SELECT setting_value FROM site_settings WHERE setting_value LIKE '%/uploads/%'`
  )) {
    add(row.setting_value);
  }

  return urls;
}

async function downloadUrl(url) {
  const dest = publicPathFromUrl(url);
  if (!dest) return { url, status: 'skip' };
  if (localExists(url)) return { url, status: 'exists' };

  const candidates = [url];
  const ext = path.extname(url).toLowerCase();
  const base = url.slice(0, -ext.length);
  if (ext === '.webp') {
    for (const alt of ['.png', '.jpg', '.jpeg']) candidates.push(`${base}${alt}`);
  } else if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
    candidates.push(`${base}.webp`);
  }

  for (const candidate of candidates) {
    const tryDest = publicPathFromUrl(candidate);
    if (!tryDest || localExists(candidate)) continue;

    const remote = `${SOURCE_URL}${candidate}`;
    try {
      const res = await fetch(remote, { redirect: 'follow' });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 32) continue;

      if (DRY_RUN) return { url: candidate, status: 'would-download', remote };

      fs.mkdirSync(path.dirname(tryDest), { recursive: true });
      fs.writeFileSync(tryDest, buf);
      return { url: candidate, status: 'downloaded', bytes: buf.length };
    } catch (_) {}
  }

  return { url, status: 'missing' };
}

async function main() {
  console.log(`Sync uploads from ${SOURCE_URL}${DRY_RUN ? ' (dry run)' : ''}`);
  const urls = await collectDbUploadUrls();
  const list = [...urls].sort();
  let downloaded = 0;
  let exists = 0;
  let missing = 0;

  for (const url of list) {
    const result = await downloadUrl(url);
    if (result.status === 'exists') exists++;
    else if (result.status === 'downloaded' || result.status === 'would-download') {
      downloaded++;
      console.log(`+ ${result.url}${result.bytes ? ` (${result.bytes} bytes)` : ''}`);
    } else if (!localExists(url)) {
      missing++;
      console.log(`! ${url}`);
    } else {
      exists++;
    }
  }

  console.log('');
  console.log(`Total URLs: ${list.length}`);
  console.log(`Already local: ${exists}`);
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Still missing: ${missing}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
