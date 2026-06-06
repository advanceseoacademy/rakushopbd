const { query } = require('../config/db');
const { ensureProductImagesTable } = require('./ensureProductImagesTable');

const MAX_GALLERY = 12;

async function getProductImages(productId) {
  await ensureProductImagesTable();
  try {
    return await query(
      'SELECT id, image_url, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC',
      [productId]
    );
  } catch {
    return [];
  }
}

function normalizeGalleryUrls(urls) {
  const out = [];
  for (const raw of urls || []) {
    const u = String(raw || '').trim();
    if (!u || out.includes(u)) continue;
    out.push(u);
    if (out.length >= MAX_GALLERY) break;
  }
  return out;
}

async function attachGalleryToProduct(product) {
  if (!product?.id) return product;
  const rows = await getProductImages(product.id);
  let gallery = rows.map((r) => r.image_url).filter(Boolean);
  if (product.image_url && !gallery.includes(product.image_url)) {
    gallery.unshift(product.image_url);
  }
  gallery = normalizeGalleryUrls(gallery);
  product.gallery_urls = gallery;
  product.gallery = rows;
  if (!product.image_url && gallery[0]) product.image_url = gallery[0];
  return product;
}

async function syncProductGallery(productId, galleryUrls, primaryUrl) {
  await ensureProductImagesTable();
  let urls = normalizeGalleryUrls(galleryUrls);
  const primary = String(primaryUrl || '').trim();
  if (primary && !urls.includes(primary)) urls.unshift(primary);
  if (primary && urls.includes(primary)) {
    urls = [primary, ...urls.filter((u) => u !== primary)];
  }
  urls = normalizeGalleryUrls(urls);

  await query('DELETE FROM product_images WHERE product_id = ?', [productId]);
  for (let i = 0; i < urls.length; i++) {
    await query(
      'INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)',
      [productId, urls[i], i]
    );
  }
  return urls;
}

module.exports = {
  MAX_GALLERY,
  getProductImages,
  attachGalleryToProduct,
  syncProductGallery,
  normalizeGalleryUrls,
};
