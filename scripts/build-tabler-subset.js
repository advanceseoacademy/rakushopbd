#!/usr/bin/env node
/**
 * Build storefront Tabler Icons subset (woff2 + CSS) from used class names.
 * Requires: python3 venv with fonttools+brotli (see script header in repo docs).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const FONT_OUT = path.join(ROOT, 'public/fonts/tabler-icons.woff2');
const CSS_OUT = path.join(ROOT, 'public/css/tabler-icons-subset.css');
const TABLER_VER = '2.47.0';
const VENV_PY = process.env.FONTTOOLS_PY || '/tmp/fonttools-venv/bin/python3';
const VENV_SUBSET = process.env.FONTTOOLS_PY
  ? process.env.FONTTOOLS_PY.replace(/python3?$/, 'pyftsubset')
  : '/tmp/fonttools-venv/bin/pyftsubset';

function collectIconNames() {
  const out = execSync('rg -o "ti-[a-z0-9-]+" views public/js lib || true', {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const names = new Set();
  out.split('\n').forEach((line) => {
    const m = line.match(/ti-([a-z0-9-]+)/);
    if (m) names.add(m[1]);
  });
  return names;
}

function main() {
  const icons = collectIconNames();
  const cssUrl = `https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@${TABLER_VER}/tabler-icons.min.css`;
  const fontUrl = `https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@${TABLER_VER}/fonts/tabler-icons.woff2`;
  const css = execSync(`curl -fsSL "${cssUrl}"`, { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 });
  const tmpFont = path.join(os.tmpdir(), 'tabler-icons.woff2');
  execSync(`curl -fsSL "${fontUrl}" -o "${tmpFont}"`);

  const unicodes = new Set();
  const rules = [];
  const missing = [];
  for (const name of [...icons].sort()) {
    const m = css.match(new RegExp(`\\.ti-${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:before\\{content:"\\\\([0-9a-fA-F]+)"\\}`));
    if (!m) {
      missing.push(name);
      continue;
    }
    unicodes.add(m[1].toLowerCase());
    rules.push(`.ti-${name}:before{content:"\\${m[1]}"}`);
  }

  fs.mkdirSync(path.dirname(FONT_OUT), { recursive: true });
  const uniArg = [...unicodes].map((u) => `U+${u.toUpperCase()}`).join(',');
  execSync(`"${VENV_SUBSET}" "${tmpFont}" --unicodes=${uniArg} --flavor=woff2 --output-file="${FONT_OUT}" --drop-tables+=GSUB,GPOS`);

  const cssOut = `/* Tabler Icons subset — site-wide. Regenerate: node scripts/build-tabler-subset.js */
@font-face{font-family:"tabler-icons";font-style:normal;font-weight:400;font-display:swap;src:url("/fonts/tabler-icons.woff2?v=3") format("woff2");}
@font-face{font-family:"tabler-icons-fallback";src:local("Arial");ascent-override:90%;descent-override:22%;line-gap-override:0%;size-adjust:107%;}
.ti{font-family:tabler-icons,tabler-icons-fallback!important;speak:none;font-style:normal;font-weight:400;font-variant:normal;text-transform:none;line-height:1;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
.ti:before{display:inline-block;width:1em;height:1em;vertical-align:-0.125em;}
${rules.join('\n')}
`;
  fs.writeFileSync(CSS_OUT, cssOut);
  console.log(`icons: ${icons.size}, subset rules: ${rules.length}, missing: ${missing.length}`);
  if (missing.length) console.log('missing:', missing.join(', '));
  console.log('font KB:', Math.round(fs.statSync(FONT_OUT).size / 1024));
}

main();
