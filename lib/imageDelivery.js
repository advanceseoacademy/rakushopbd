const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const { uploadDir, webpUrlForUploadUrl } = require('./imageOptimize');
const { findAlternateUpload } = require('./legacyUploadWebp');

const VARIANT_CACHE_DIR = path.join(uploadDir, '.variants');
const DEFAULT_WIDTHS = [320, 480, 640, 960, 1280];
const MAX_VARIANT_WIDTH = Number(process.env.IMAGE_MAX_WIDTH) || 1920;
const VARIANT_QUALITY = Number(process.env.IMAGE_VARIANT_QUALITY) || 78;

if (!fs.existsSync(VARIANT_CACHE_DIR)) fs.mkdirSync(VARIANT_CACHE_DIR, { recursive: true });

function normalizeUploadUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return u.startsWith('/') ? u : `/${u}`;
}

/** Prefer WebP path for /uploads/ raster URLs (fallback middleware serves PNG/JPG if WebP missing). */
function preferWebpUrl(url) {
  const u = normalizeUploadUrl(url);
  if (!u.startsWith('/uploads/')) return u;
  return webpUrlForUploadUrl(u) || u;
}

function isResizableUpload(url) {
  const u = preferWebpUrl(normalizeUploadUrl(url));
  if (!u.startsWith('/uploads/')) return false;
  return /\.(webp|jpe?g|png|gif)$/i.test(u);
}

function variantPublicPath(uploadPath, width) {
  const u = preferWebpUrl(normalizeUploadUrl(uploadPath));
  if (!u.startsWith('/uploads/')) return u;
  const raw = Number(width);
  if (!Number.isFinite(raw) || raw <= 0) return u;
  const w = Math.min(MAX_VARIANT_WIDTH, Math.max(48, Math.round(raw)));
  if (!w) return u;
  const rel = u.replace(/^\//, '');
  return `/media/${w}/${rel}`;
}

function variantCacheKey(relPath, width) {
  const hash = crypto.createHash('sha1').update(`${width}:${relPath}`).digest('hex').slice(0, 16);
  return path.join(VARIANT_CACHE_DIR, `w${width}-${hash}.webp`);
}

function resolveUploadAbsPath(urlPath) {
  const rel = decodeURIComponent(String(urlPath || '').replace(/^\//, ''));
  if (!rel || rel.includes('..') || !rel.startsWith('uploads/')) return null;
  const uploadRel = rel.replace(/^uploads\//, '');
  const hit = findAlternateUpload(uploadRel);
  if (!hit) return null;
  return hit.abs;
}

async function getOrCreateVariant(absSource, width) {
  const targetW = Math.min(MAX_VARIANT_WIDTH, Math.max(48, Math.round(width)));
  const meta = await sharp(absSource, { failOn: 'none' }).metadata();
  // Serve the original file when no downscale is needed — avoids lossy re-encode blur.
  if (!meta.width || meta.width <= targetW) {
    const ext = path.extname(absSource).toLowerCase();
    const mime =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.gif'
            ? 'image/gif'
            : 'image/webp';
    return { abs: absSource, mime };
  }

  const relKey = path.relative(uploadDir, absSource).replace(/\\/g, '/');
  const cachePath = variantCacheKey(relKey, targetW);
  if (fs.existsSync(cachePath)) {
    return { abs: cachePath, mime: 'image/webp' };
  }

  await sharp(absSource, { failOn: 'none' })
    .rotate()
    .resize({ width: targetW, withoutEnlargement: true })
    .webp({ quality: VARIANT_QUALITY, effort: 4 })
    .toFile(cachePath);

  return { abs: cachePath, mime: 'image/webp' };
}

function buildSrcset(url, widths, sizes) {
  const u = preferWebpUrl(normalizeUploadUrl(url));
  if (!isResizableUpload(u)) {
    return { src: u, srcset: '', sizes: sizes || '' };
  }
  const list = (widths || DEFAULT_WIDTHS)
    .map((w) => `${variantPublicPath(u, w)} ${w}w`)
    .join(', ');
  return {
    src: variantPublicPath(u, widths[widths.length - 1] || 640),
    srcset: list,
    sizes: sizes || '(max-width: 480px) 50vw, (max-width: 768px) 33vw, 320px',
  };
}

function buildImgAttributes(url, opts = {}) {
  const u = preferWebpUrl(normalizeUploadUrl(url));
  if (!u) return { src: '', srcset: '', sizes: '' };
  if (!isResizableUpload(u)) {
    return {
      src: u,
      srcset: '',
      sizes: '',
      width: opts.width || '',
      height: opts.height || '',
    };
  }
  const widths = opts.widths || DEFAULT_WIDTHS;
  const built = buildSrcset(u, widths, opts.sizes);
  return {
    src: opts.srcWidth ? variantPublicPath(u, opts.srcWidth) : built.src,
    srcset: built.srcset,
    sizes: built.sizes,
    width: opts.width || '',
    height: opts.height || '',
  };
}

module.exports = {
  preferWebpUrl,
  normalizeUploadUrl,
  isResizableUpload,
  variantPublicPath,
  resolveUploadAbsPath,
  getOrCreateVariant,
  buildSrcset,
  buildImgAttributes,
  DEFAULT_WIDTHS,
};
