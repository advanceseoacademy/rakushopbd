#!/usr/bin/env node
/**
 * Convert existing /uploads images to WebP and update database paths.
 *
 * Usage:
 *   node scripts/migrate-uploads-to-webp.js           # convert + update DB
 *   node scripts/migrate-uploads-to-webp.js --dry-run # preview only
 *   node scripts/migrate-uploads-to-webp.js --remove-originals
 *
 * Safety:
 * - WebP is written and verified before any DB update
 * - Originals moved to public/uploads/_orig/ (unless --remove-originals)
 * - server.js serves .webp when old .jpg/.png URL is requested (fallback)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('../config/db');
const {
  convertFileToWebp,
  webpUrlForUploadUrl,
  isRasterUploadExt,
  uploadDir,
} = require('../lib/imageOptimize');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const REMOVE_ORIGINALS = args.has('--remove-originals');
const ORIG_BACKUP_DIR = path.join(uploadDir, '_orig');

function publicPathFromUrl(url) {
  if (!url || !url.startsWith('/uploads/')) return null;
  return path.join(__dirname, '../public', url.replace(/^\//, ''));
}

async function collectDbUploadUrls() {
  const urls = new Set();

  const add = (v) => {
    const webp = webpUrlForUploadUrl(v);
    if (webp) urls.add(String(v).trim());
  };

  for (const row of await query(
    `SELECT image_url AS v FROM products WHERE image_url IS NOT NULL AND image_url != ''`
  )) {
    add(row.v);
  }
  for (const row of await query(
    `SELECT og_image AS v FROM products WHERE og_image IS NOT NULL AND og_image != ''`
  )) {
    add(row.v);
  }
  for (const row of await query(
    `SELECT image_url AS v FROM product_images WHERE image_url IS NOT NULL AND image_url != ''`
  )) {
    add(row.v);
  }
  for (const row of await query(
    `SELECT image_url AS v FROM banners WHERE image_url IS NOT NULL AND image_url != ''`
  )) {
    add(row.v);
  }
  for (const row of await query(
    `SELECT image_url AS v FROM messenger_chats WHERE image_url IS NOT NULL AND image_url != ''`
  )) {
    add(row.v);
  }
  for (const row of await query(
    `SELECT setting_value AS v FROM site_settings WHERE setting_value LIKE '%/uploads/%'`
  )) {
    const val = String(row.v || '').trim();
    if (webpUrlForUploadUrl(val)) add(val);
  }

  return urls;
}

function collectDiskUploadUrls() {
  const urls = new Set();
  if (!fs.existsSync(uploadDir)) return urls;

  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (name === '_orig' || name.startsWith('.')) continue;
      const abs = path.join(dir, name);
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!isRasterUploadExt(path.extname(name))) continue;
      const rel = path.relative(path.join(__dirname, '../public'), abs).split(path.sep).join('/');
      urls.add('/' + rel);
    }
  }

  walk(uploadDir);
  return urls;
}

async function updateDbUrl(oldUrl, newUrl) {
  const updates = [
    ['products', 'image_url'],
    ['products', 'og_image'],
    ['product_images', 'image_url'],
    ['banners', 'image_url'],
    ['messenger_chats', 'image_url'],
  ];

  let total = 0;
  for (const [table, col] of updates) {
    const matched = await query(`SELECT COUNT(*) AS c FROM ${table} WHERE ${col} = ?`, [oldUrl]);
    const n = Number(matched[0]?.c ?? 0);
    if (n > 0) {
      await query(`UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`, [newUrl, oldUrl]);
      total += n;
    }
  }

  const matchedSettings = await query(
    `SELECT COUNT(*) AS c FROM site_settings WHERE setting_value = ?`,
    [oldUrl]
  );
  const settingsN = Number(matchedSettings[0]?.c ?? 0);
  if (settingsN > 0) {
    await query(`UPDATE site_settings SET setting_value = ? WHERE setting_value = ?`, [
      newUrl,
      oldUrl,
    ]);
    total += settingsN;
  }

  return total;
}

function archiveOriginal(absOrig) {
  const rel = path.relative(uploadDir, absOrig);
  const dest = path.join(ORIG_BACKUP_DIR, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(absOrig, dest);
}

async function migrateOne(oldUrl) {
  const newUrl = webpUrlForUploadUrl(oldUrl);
  if (!newUrl) return { status: 'skip', reason: 'not raster upload' };

  const absOrig = publicPathFromUrl(oldUrl);
  const absWebp = publicPathFromUrl(newUrl);
  if (!absOrig || !absWebp) return { status: 'skip', reason: 'bad path' };

  if (!fs.existsSync(absOrig)) {
    if (fs.existsSync(absWebp)) {
      if (!DRY_RUN) await updateDbUrl(oldUrl, newUrl);
      return { status: 'db-only', oldUrl, newUrl, note: 'webp exists, original missing' };
    }
    return { status: 'missing', oldUrl, reason: 'file not on disk' };
  }

  if (fs.existsSync(absWebp)) {
    if (!DRY_RUN) await updateDbUrl(oldUrl, newUrl);
    return { status: 'already-webp', oldUrl, newUrl };
  }

  if (DRY_RUN) {
    return { status: 'would-convert', oldUrl, newUrl };
  }

  fs.mkdirSync(path.dirname(absWebp), { recursive: true });
  const stats = await convertFileToWebp(absOrig, absWebp);
  const rows = await updateDbUrl(oldUrl, newUrl);

  if (REMOVE_ORIGINALS) {
    fs.unlinkSync(absOrig);
  } else {
    archiveOriginal(absOrig);
  }

  return {
    status: 'converted',
    oldUrl,
    newUrl,
    rows,
    ...stats,
  };
}

async function main() {
  console.log('RakuShopBD — migrate uploads to WebP');
  console.log('Mode:', DRY_RUN ? 'DRY RUN' : 'LIVE');
  console.log('Originals:', REMOVE_ORIGINALS ? 'delete' : `archive → ${ORIG_BACKUP_DIR}`);
  console.log('Upload dir:', uploadDir);
  console.log('');

  const dbUrls = await collectDbUploadUrls();
  const diskUrls = collectDiskUploadUrls();
  const all = new Set([...dbUrls, ...diskUrls]);

  const raster = [...all].filter((u) => webpUrlForUploadUrl(u)).sort();
  console.log(`Found ${raster.length} raster upload(s) to process.\n`);

  const summary = { converted: 0, already: 0, dbOnly: 0, missing: 0, would: 0, errors: 0 };
  let savedBytes = 0;

  for (const oldUrl of raster) {
    try {
      const result = await migrateOne(oldUrl);
      if (result.status === 'converted') {
        summary.converted++;
        savedBytes += (result.bytesBefore || 0) - (result.bytesAfter || 0);
        console.log(
          `✓ ${oldUrl} → ${result.newUrl} (${Math.round(result.bytesBefore / 1024)}KB → ${Math.round(result.bytesAfter / 1024)}KB, ${result.rows} DB row(s))`
        );
      } else if (result.status === 'already-webp') {
        summary.already++;
        console.log(`• ${oldUrl} → ${result.newUrl} (webp exists, DB updated)`);
      } else if (result.status === 'db-only') {
        summary.dbOnly++;
        console.log(`• ${oldUrl} → ${result.newUrl} (DB only — webp on disk)`);
      } else if (result.status === 'would-convert') {
        summary.would++;
        console.log(`→ would convert ${oldUrl} → ${result.newUrl}`);
      } else if (result.status === 'missing') {
        summary.missing++;
        console.warn(`! missing file (skipped): ${oldUrl}`);
      }
    } catch (err) {
      summary.errors++;
      console.error(`✗ ${oldUrl}:`, err.message);
    }
  }

  console.log('\n--- Summary ---');
  console.log(summary);
  if (savedBytes > 0) {
    console.log(`Space saved: ~${(savedBytes / 1024 / 1024).toFixed(2)} MB`);
  }
  if (DRY_RUN) {
    console.log('\nRe-run without --dry-run to apply changes.');
  } else if (summary.errors === 0) {
    console.log('\nDone. Old JPG/PNG URLs still work via server fallback until cache clears.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
