const { resolveUploadAbsPath, getOrCreateVariant } = require('./imageDelivery');
const { applyStaticAssetCache } = require('./httpCache');

/** On-demand resized WebP variants: GET /media/:width/uploads/foo.webp */
async function imageVariantMiddleware(req, res, next) {
  const m = req.path.match(/^\/(\d+)\/(.+)$/);
  if (!m) return next();

  const width = Number(m[1]);
  const relPath = m[2];
  if (!Number.isFinite(width) || width < 48 || width > 2560) {
    return res.status(400).send('Invalid width');
  }
  if (!relPath || relPath.includes('..')) return next();

  const abs = resolveUploadAbsPath(`/${relPath}`);
  if (!abs) return next();

  try {
    const hit = await getOrCreateVariant(abs, width);
    applyStaticAssetCache(res);
    res.type(hit.mime || 'image/webp');
    return res.sendFile(hit.abs);
  } catch (err) {
    console.warn('image variant', relPath, err.message);
    return next();
  }
}

module.exports = { imageVariantMiddleware };
