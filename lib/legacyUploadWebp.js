const fs = require('fs');
const path = require('path');
const { uploadDir } = require('./imageOptimize');
const { applyStaticCacheHeaders } = require('./staticCache');

const RASTER_EXT = ['.jpg', '.jpeg', '.png', '.gif'];
const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg)$/i;

function uploadPlaceholderSvg() {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" role="img" aria-label="Image unavailable">' +
    '<rect width="400" height="400" fill="#f3f4f6"/>' +
    '<path d="M120 280l60-80 50 60 40-50 70 90H120z" fill="#d1d5db"/>' +
    '<circle cx="160" cy="150" r="28" fill="#d1d5db"/></svg>'
  );
}

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
  applyStaticCacheHeaders(res, { immutable: false });
  return res.sendFile(hit.abs);
}

/**
 * Missing upload paths return a neutral placeholder (200) instead of 404 console noise.
 */
function uploadMissingFallback(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const rel = decodeURIComponent(String(req.path || '').replace(/^\//, ''));
  if (!rel || rel.includes('..')) return next();
  if (!IMAGE_EXT.test(rel)) return next();

  const absOrig = path.join(uploadDir, rel);
  if (fs.existsSync(absOrig)) return next();

  const hit = findAlternateUpload(rel);
  if (hit && hit.abs !== absOrig) {
    const mime = MIME[hit.ext];
    if (mime) res.type(mime);
    applyStaticCacheHeaders(res, { immutable: false });
    return res.sendFile(hit.abs);
  }

  applyStaticCacheHeaders(res, { immutable: false, maxAgeSec: 3600 });
  res.type('image/svg+xml');
  return res.status(200).send(uploadPlaceholderSvg());
}

module.exports = {
  legacyUploadWebpFallback,
  uploadMissingFallback,
  findAlternateUpload,
  uploadPlaceholderSvg,
};
