/**
 * Minify public/css/*.css → *.min.css (clean-css).
 * Production serves .min.css via server.js middleware.
 */
const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');

const CSS_DIR = path.join(__dirname, '..', 'public', 'css');

const minifier = new CleanCSS({
  level: 2,
  format: { breaks: { afterAtRule: false, afterBlockBegins: false, afterBlockEnds: false, afterRuleEnds: false } },
});

function listSourceFiles() {
  return fs.readdirSync(CSS_DIR).filter((f) => f.endsWith('.css') && !f.endsWith('.min.css'));
}

function needsMinify(srcPath, outPath) {
  if (!fs.existsSync(outPath)) return true;
  return fs.statSync(srcPath).mtimeMs > fs.statSync(outPath).mtimeMs;
}

function minifyFile(srcPath) {
  const code = fs.readFileSync(srcPath, 'utf8');
  const result = minifier.minify(code);
  if (result.errors?.length) {
    throw new Error(`${path.basename(srcPath)}: ${result.errors.join('; ')}`);
  }
  const outPath = srcPath.replace(/\.css$/, '.min.css');
  fs.writeFileSync(outPath, result.styles);
  return {
    file: path.basename(srcPath),
    inBytes: Buffer.byteLength(code),
    outBytes: Buffer.byteLength(result.styles),
  };
}

function minifyAll({ force = false } = {}) {
  const files = listSourceFiles();
  let processed = 0;
  let saved = 0;

  for (const file of files) {
    const srcPath = path.join(CSS_DIR, file);
    const outPath = path.join(CSS_DIR, file.replace(/\.css$/, '.min.css'));
    if (!force && !needsMinify(srcPath, outPath)) continue;

    const r = minifyFile(srcPath);
    processed += 1;
    saved += r.inBytes - r.outBytes;
    console.log(`  ${r.file}: ${Math.round(r.inBytes / 1024)}KB → ${Math.round(r.outBytes / 1024)}KB`);
  }

  return { processed, saved, total: files.length };
}

module.exports = { minifyAll };

if (require.main === module) {
  const force = process.argv.includes('--force');
  try {
    const { processed, saved, total } = minifyAll({ force });
    console.log(`Minified ${processed}/${total} file(s), saved ${Math.round(saved / 1024)}KB`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
