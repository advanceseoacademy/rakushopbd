#!/usr/bin/env node
/**
 * Build a storefront Tabler Icons CSS subset (only icons used in views/JS).
 * Admin keeps the full tabler-icons.min.css.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC_CSS = path.join(ROOT, 'public/vendor/tabler/tabler-icons.min.css');
const OUT_CSS = path.join(ROOT, 'public/vendor/tabler/tabler-icons-storefront.min.css');

const EXTRA_ICONS = [
  'ti-category',
  'ti-package',
  'ti-loader',
  'ti-photo',
  'ti-bell',
  'ti-heart-filled',
  'ti-circle-check',
  'ti-menu-2',
  'ti-building-store',
  'ti-body-scan',
  'ti-scan',
  'ti-world',
  'ti-map',
  'ti-discount',
  'ti-rosette-discount-check',
  'ti-device-watch',
  'ti-truck',
  'ti-users',
  'ti-box',
  'ti-currency-taka',
];

/** Icons used in DB/templates that differ from Tabler class names */
const ICON_ALIASES = {
  'ti-watch': 'ti-device-watch',
  'ti-glasses-off': 'ti-eyeglass',
  'ti-lipstick': 'ti-droplet',
};

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === 'vendor') continue;
      walkFiles(full, acc);
    } else if (/\.(ejs|js|css)$/.test(name) && !name.startsWith('admin')) {
      acc.push(full);
    }
  }
  return acc;
}

function collectIcons() {
  const icons = new Set(EXTRA_ICONS);
  const files = [
    ...walkFiles(path.join(ROOT, 'views')),
    ...walkFiles(path.join(ROOT, 'public/js')),
    ...walkFiles(path.join(ROOT, 'database')),
  ].filter((f) => !f.includes(`${path.sep}admin.js`) && !f.includes(`${path.sep}admin.ejs`));

  const re = /\bti-([a-z0-9-]+)\b/g;
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = re.exec(text))) {
      icons.add(`ti-${m[1]}`);
    }
  }

  return [...icons].sort();
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSubset(iconNames) {
  const css = fs.readFileSync(SRC_CSS, 'utf8');
  const fontFace = css.match(/@font-face\{[^}]+\}/);
  const base = css.match(/\.ti\{[^}]+\}/);
  if (!fontFace || !base) {
    throw new Error('Could not parse tabler-icons.min.css');
  }

  const parts = [`/* Tabler Icons storefront subset — ${iconNames.length} icons */`, fontFace[0], base[0]];
  const missing = [];

  for (const name of iconNames) {
    const re = new RegExp(`\\.${escapeRe(name)}:before\\{content:"\\\\[^"]+"\\}`);
    let rule = css.match(re);
    if (!rule && ICON_ALIASES[name]) {
      const alias = ICON_ALIASES[name];
      const aliasRe = new RegExp(`\\.${escapeRe(alias)}:before\\{content:"\\\\[^"]+"\\}`);
      rule = css.match(aliasRe);
      if (rule) parts.push(`.${name}:before${rule[0].split(':before')[1]}`);
      else missing.push(name);
      continue;
    }
    if (rule) parts.push(rule[0]);
    else missing.push(name);
  }

  if (missing.length) {
    console.warn('Missing icon rules:', missing.join(', '));
  }

  return parts.join('');
}

function main() {
  const icons = collectIcons();
  const out = buildSubset(icons);
  fs.writeFileSync(OUT_CSS, out);
  console.log(`Wrote ${OUT_CSS} (${icons.length} icons, ${out.length} bytes)`);
}

main();
