const fs = require('fs');
const path = require('path');
const { uploadDir } = require('./imageOptimize');
const { applyStaticAssetCache } = require('./httpCache');

const RASTER_EXT = ['.jpg', '.jpeg', '.png', '.gif'];
const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

function extOf(rel) {
  return path.extname(rel).toLowerCase();
}

function findAlternateUpload(rel) {
  const absOrig = path.join(uploadDir, rel);
  if (fs.existsSync(absOrig)) return { abs: absOrig, ext: extOf(rel) };

  const ext = extOf(rel);
  const base = rel.slice(0, -ext.length);

  if (RASTER_EXT.includes(ext)) {
    const webpRel = `${base}.webp`;
    const absWebp = path.join(uploadDir, webpRel);
    if (fs.existsSync(absWebp)) return { abs: absWebp, ext: '.webp' };
  }

  if (ext === '.webp') {
    for (const alt of RASTER_EXT) {
      const altRel = `${base}${alt}`;
      const absAlt = path.join(uploadDir, altRel);
      if (fs.existsSync(absAlt)) return { abs: absAlt, ext: alt };
    }
  }

  return null;
}

/**
 * Serve alternate format when DB path and disk file differ (WebP migration safe).
 * - /uploads/foo.png → foo.webp if png missing
 * - /uploads/foo.webp → foo.png if webp missing (VPS not migrated yet)
 */
function legacyUploadWebpFallback(req, res, next) {
  const rel = decodeURIComponent(String(req.path || '').replace(/^\//, ''));
  if (!rel || rel.includes('..')) return next();

  const hit = findAlternateUpload(rel);
  if (!hit) return next();
  if (path.join(uploadDir, rel) === hit.abs) return next();

  const mime = MIME[hit.ext];
  if (mime) res.type(mime);
  applyStaticAssetCache(res);
  return res.sendFile(hit.abs);
}

module.exports = { legacyUploadWebpFallback, findAlternateUpload };
