#!/usr/bin/env node
/**
 * Concatenate homepage-critical CSS into one file (shorter network dependency tree).
 */
const fs = require('fs');
const path = require('path');

const CSS_DIR = path.join(__dirname, '..', 'public', 'css');
const OUT = path.join(CSS_DIR, 'home.bundle.css');
const PARTS = [
  'tabler-icons-subset.css',
  'brand-tokens.css',
  'perf.css',
  'main.css',
  'category.css',
  'responsive.css',
  'home-hero-slider.css',
];

function buildHomeCssBundle() {
  const chunks = [`/* Homepage bundle — regenerate: node scripts/build-home-css-bundle.js */`];
  for (const file of PARTS) {
    const src = path.join(CSS_DIR, file);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing CSS part: ${file}`);
    }
    chunks.push(`/* --- ${file} --- */`);
    chunks.push(fs.readFileSync(src, 'utf8').trim());
  }
  fs.writeFileSync(OUT, `${chunks.join('\n\n')}\n`);
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log(`home.bundle.css: ${kb}KB (${PARTS.length} files)`);
  return { outPath: OUT, kb, parts: PARTS.length };
}

module.exports = { buildHomeCssBundle };

if (require.main === module) {
  try {
    buildHomeCssBundle();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
