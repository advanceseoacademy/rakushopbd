#!/usr/bin/env node
/**
 * Download all site images referenced by localhost API into public/.
 * Missing files are fetched from production (rakushopbd.com).
 *
 * Usage: node scripts/download-localhost-images.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOCAL_BASE = process.env.RAKU_LOCAL_URL || 'http://localhost:3000';
const REMOTE_BASE = process.env.RAKU_REMOTE_URL || 'https://rakushopbd.com';

function addUrl(set, u) {
  if (!u || typeof u !== 'string') return;
  const s = u.trim();
  if (!s || /^https?:\/\//i.test(s)) return;
  if (!s.startsWith('/uploads/') && !s.startsWith('/images/')) return;
  set.add(s.startsWith('/') ? s : `/${s}`);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function collectImagePaths() {
  const paths = new Set();
  const boot = await fetchJson(`${LOCAL_BASE}/api/bootstrap`);
  for (const s of boot.heroSideSlider?.slides || []) addUrl(paths, s.image);
  for (const b of boot.banners || []) addUrl(paths, b.image_url || b.imageUrl);
  for (const c of boot.categories || []) addUrl(paths, c.icon_url || c.iconUrl);
  for (const m of boot.messengerChats || []) addUrl(paths, m.image_url || m.imageUrl);

  const productLists = [
    ...(boot.bestSelling || []),
    ...(boot.newArrivals || []),
    ...(boot.todayDeals || []),
  ];
  for (const p of productLists) {
    addUrl(paths, p.image_url || p.imageUrl);
    for (const g of p.gallery_urls || []) addUrl(paths, g);
  }

  try {
    const products = await fetchJson(`${LOCAL_BASE}/api/products?limit=500`);
    for (const p of products.products || []) {
      addUrl(paths, p.image_url || p.imageUrl);
      for (const g of p.gallery_urls || []) addUrl(paths, g);
    }
  } catch (_) {}

  return [...paths];
}

async function existsLocally(urlPath) {
  const res = await fetch(`${LOCAL_BASE}${urlPath}`, { method: 'HEAD' });
  return res.ok;
}

async function downloadToFile(fromBase, urlPath, dest) {
  const res = await fetch(`${fromBase}${urlPath}`);
  if (!res.ok) throw new Error(`${fromBase}${urlPath} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return buf.length;
}

async function main() {
  console.log(`Collecting image paths from ${LOCAL_BASE}…`);
  const paths = await collectImagePaths();
  console.log(`Found ${paths.length} unique local image paths.`);

  let ok = 0;
  let downloaded = 0;
  let failed = 0;

  for (const urlPath of paths) {
    const dest = path.join(ROOT, 'public', urlPath);
    if (fs.existsSync(dest)) {
      ok++;
      continue;
    }
    if (await existsLocally(urlPath)) {
      ok++;
      continue;
    }

    try {
      const bytes = await downloadToFile(REMOTE_BASE, urlPath, dest);
      downloaded++;
      console.log(`✓ ${urlPath} (${(bytes / 1024).toFixed(1)} KB)`);
    } catch (err) {
      try {
        const bytes = await downloadToFile(LOCAL_BASE, urlPath, dest);
        downloaded++;
        console.log(`✓ ${urlPath} from local (${(bytes / 1024).toFixed(1)} KB)`);
      } catch {
        failed++;
        console.error(`✗ ${urlPath} — ${err.message}`);
      }
    }
  }

  console.log(`\nDone: ${ok} already present, ${downloaded} downloaded, ${failed} failed.`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
