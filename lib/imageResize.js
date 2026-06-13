const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const { applyStaticCacheHeaders } = require('./staticCache');
const { findAlternateUpload, uploadPlaceholderSvg } = require('./legacyUploadWebp');

const publicDir = path.join(__dirname, '../public');
const cacheDir = path.join(publicDir, '.cache', 'media');
const ALLOWED_PREFIXES = ['/uploads/', '/images/'];

function parseMediaRequest(urlPath) {
  const m = String(urlPath || '').match(/^\/media\/w(\d+)\/(.+)$/);
  if (!m) return null;
  const width = Math.min(Math.max(parseInt(m[1], 10), 32), 1920);
  const rel = '/' + m[2].replace(/^\/+/, '').split('?')[0];
  if (rel.includes('..')) return null;
  if (!ALLOWED_PREFIXES.some((prefix) => rel.startsWith(prefix))) return null;
  return { width, rel };
}

function sourceAbsPath(rel) {
  return path.join(publicDir, rel.replace(/^\//, ''));
}

async function resizeToCache(absInput, width, cachedPath) {
  await sharp(absInput, { failOn: 'none' })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toFile(cachedPath);
}

function mediaResizeMiddleware() {
  return async function mediaResize(req, res, next) {
    const parsed = parseMediaRequest(req.path);
    if (!parsed) return next();

    const relKey = parsed.rel.replace(/^\//, '');
    let absInput = sourceAbsPath(parsed.rel);
    if (!fs.existsSync(absInput)) {
      const hit = findAlternateUpload(relKey);
      if (hit) absInput = hit.abs;
      else {
        applyStaticCacheHeaders(res, { immutable: false, maxAgeSec: 3600 });
        res.type('image/svg+xml');
        return res.status(200).send(uploadPlaceholderSvg());
      }
    }

    try {
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      const key = crypto.createHash('sha1').update(`${parsed.width}:${parsed.rel}`).digest('hex');
      const cachedPath = path.join(cacheDir, `${key}.webp`);

      if (!fs.existsSync(cachedPath)) {
        await resizeToCache(absInput, parsed.width, cachedPath);
      }

      applyStaticCacheHeaders(res, { immutable: false });
      res.type('image/webp');
      return res.sendFile(cachedPath);
    } catch (err) {
      console.warn('media resize failed', parsed.rel, err.message);
      return next();
    }
  };
}

function mediaUrl(src, width) {
  const u = String(src || '').trim();
  if (!u || /^https?:\/\//i.test(u)) return u;
  const rel = u.startsWith('/') ? u : `/${u}`;
  if (!ALLOWED_PREFIXES.some((prefix) => rel.startsWith(prefix))) return rel;
  const w = Math.min(Math.max(Number(width) || 800, 32), 1920);
  return `/media/w${w}${rel}`;
}

module.exports = {
  mediaResizeMiddleware,
  mediaUrl,
  parseMediaRequest,
};
