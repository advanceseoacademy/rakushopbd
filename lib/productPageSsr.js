const { formatPrice, starsFromRating } = require('./format');
const { renderProductDescriptionBody } = require('./productDescriptionHtml');
const { productPublicPath } = require('./productUrl');
const { buildImgAttributes, preferWebpUrl } = require('./imageDelivery');

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function discountPercent(product) {
  const pct = Number(product.discount_percent ?? product.discountPercent);
  if (pct > 0) return Math.round(pct);
  const price = Number(product.price) || 0;
  const old = Number(product.old_price ?? product.oldPrice) || 0;
  if (old > price && price > 0) return Math.round(((old - price) / old) * 100);
  return 0;
}

function resolveImageUrl(product) {
  const url = String(product.image_url || product.imageUrl || '').trim();
  if (!url) return '';
  if (url.startsWith('/') || /^https?:\/\//i.test(url)) return preferWebpUrl(url);
  return preferWebpUrl(`/${url}`);
}

function buildProductPageVm(product, settings = {}) {
  if (!product) return null;
  const name = product.name_bn || product.nameBn || product.name || 'Product';
  const reviewCount = Number(product.review_count ?? product.reviewCount) || 0;
  const rating = Number(product.rating) || 0;
  const pct = discountPercent(product);
  const oldRaw = Number(product.old_price ?? product.oldPrice) || 0;
  const priceRaw = Number(product.price) || 0;
  const stock = Number(product.stock) || 0;
  const descBody = renderProductDescriptionBody(product);
  const imageUrl = resolveImageUrl(product);
  const imageAlt = String(product.image_alt || product.imageAlt || name).trim();
  const imageAttrs = imageUrl
    ? buildImgAttributes(imageUrl, {
        widths: [320, 480, 640, 960, 1280],
        sizes: '(max-width: 768px) 100vw, 600px',
        srcWidth: 1280,
        width: 600,
        height: 600,
      })
    : { src: '', srcset: '', sizes: '' };

  return {
    id: product.id,
    slug: product.slug,
    path: productPublicPath(product),
    name: escapeHtml(name),
    nameRaw: name,
    price: formatPrice(priceRaw),
    priceRaw,
    oldPrice: oldRaw > priceRaw ? formatPrice(oldRaw) : '',
    discountPercent: pct,
    discountLabel: pct ? `${pct}% OFF` : '',
    sku: escapeHtml(String(product.sku || '').trim() || `SKU-${product.id}`),
    stock,
    inStock: stock > 0,
    stockLabel: stock > 0 ? 'In stock' : 'Out of stock',
    categoryName: escapeHtml(product.category_name || product.categoryName || ''),
    categorySlug: product.category_slug || product.categorySlug || '',
    stars: starsFromRating(rating),
    rating: rating > 0 ? rating.toFixed(1) : '0.0',
    reviewCount,
    reviewsLabel:
      reviewCount > 0
        ? `(${reviewCount} Review${reviewCount !== 1 ? 's' : ''})`
        : '(No reviews yet)',
    hasReviews: reviewCount > 0,
    imageUrl: escapeHtml(imageUrl || imageAttrs.src),
    imageSrcset: escapeHtml(imageAttrs.srcset || ''),
    imageSizes: escapeHtml(imageAttrs.sizes || ''),
    imageAlt: escapeHtml(imageAlt),
    bgColor: escapeHtml(product.bg_color || product.bgColor || '#E8F3EA'),
    descriptionHtml: descBody
      ? `<h3 class="pv-additional-details-heading">Additional Details</h3>${descBody}`
      : '<p style="color:var(--text-muted);">Product details will appear here.</p>',
    siteName: escapeHtml(settings.site_name || 'RakuShopBD'),
  };
}

module.exports = { buildProductPageVm, escapeHtml };
