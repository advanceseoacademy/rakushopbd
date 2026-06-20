/**
 * Minify public/js/*.js → *.min.js (Terser).
 * Production serves .min.js via server.js middleware.
 */
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const JS_DIR = path.join(__dirname, '..', 'public', 'js');

function listSourceFiles() {
  return fs.readdirSync(JS_DIR).filter((f) => f.endsWith('.js') && !f.endsWith('.min.js'));
}

function needsMinify(srcPath, outPath) {
  if (!fs.existsSync(outPath)) return true;
  return fs.statSync(srcPath).mtimeMs > fs.statSync(outPath).mtimeMs;
}

async function minifyFile(srcPath) {
  const code = fs.readFileSync(srcPath, 'utf8');
  const result = await minify(code, {
    compress: { passes: 2 },
    mangle: true,
    format: { comments: false },
  });
  if (!result.code) throw new Error(`Empty minify output: ${srcPath}`);
  const outPath = srcPath.replace(/\.js$/, '.min.js');
  fs.writeFileSync(outPath, result.code);
  return {
    file: path.basename(srcPath),
    inBytes: Buffer.byteLength(code),
    outBytes: Buffer.byteLength(result.code),
  };
}

async function minifyAll({ force = false } = {}) {
  const files = listSourceFiles();
  let processed = 0;
  let saved = 0;

  for (const file of files) {
    const srcPath = path.join(JS_DIR, file);
    const outPath = path.join(JS_DIR, file.replace(/\.js$/, '.min.js'));
    if (!force && !needsMinify(srcPath, outPath)) continue;

    const r = await minifyFile(srcPath);
    processed += 1;
    saved += r.inBytes - r.outBytes;
    console.log(`  ${r.file}: ${Math.round(r.inBytes / 1024)}KB → ${Math.round(r.outBytes / 1024)}KB`);
  }

  return { processed, saved, total: files.length };
}

module.exports = { minifyAll };

if (require.main === module) {
  const force = process.argv.includes('--force');
  minifyAll({ force })
    .then(({ processed, saved, total }) => {
      console.log(`Minified ${processed}/${total} file(s), saved ${Math.round(saved / 1024)}KB`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
