/** Fields stored on products but never sent to the storefront. */
const INTERNAL_PRODUCT_KEYS = ['buy_price', 'buyPrice'];

/** SQL columns for homepage / grid cards (no long HTML descriptions). */
const CARD_PRODUCT_SQL = `p.id, p.category_id, p.slug, p.sku, p.name_bn,
  p.price, p.old_price, p.rating, p.review_count,
  p.icon, p.icon_color, p.bg_color, p.image_url, p.image_alt,
  p.tag_type, p.tag_text, p.discount_percent, p.stock, p.is_featured,
  p.today_selling_slot,
  c.slug AS category_slug, c.name_bn AS category_name`;

const CARD_PRODUCT_KEYS = new Set([
  'id',
  'category_id',
  'slug',
  'sku',
  'name_bn',
  'price',
  'old_price',
  'rating',
  'review_count',
  'icon',
  'icon_color',
  'bg_color',
  'image_url',
  'image_alt',
  'tag_type',
  'tag_text',
  'discount_percent',
  'stock',
  'is_featured',
  'today_selling_slot',
  'category_slug',
  'category_name',
  'sold_qty',
]);

function stripInternalProductFields(product) {
  if (!product || typeof product !== 'object') return product;
  const out = { ...product };
  for (const key of INTERNAL_PRODUCT_KEYS) {
    delete out[key];
  }
  return out;
}

function stripInternalProductList(products) {
  if (!Array.isArray(products)) return products;
  return products.map(stripInternalProductFields);
}

/** Compact card object — drops descriptions/SEO and camelCase duplicates from pg-row. */
function toCardProduct(product) {
  if (!product || typeof product !== 'object') return product;
  const out = {};
  for (const key of CARD_PRODUCT_KEYS) {
    if (product[key] != null && product[key] !== '') out[key] = product[key];
  }
  if (product.id != null) out.id = product.id;
  if (product.name_bn != null) out.name_bn = product.name_bn;
  if (product.price != null) out.price = product.price;
  if (product.stock != null) out.stock = product.stock;
  return out;
}

function toCardProductList(products) {
  if (!Array.isArray(products)) return products;
  return products.map(toCardProduct);
}

/** Drop heavy legal HTML from homepage bootstrap settings (loaded on demand elsewhere). */
const HEAVY_SETTING_KEYS = [
  'legal_privacy_content',
  'legal_terms_content',
  'legal_return_content',
  'legal_preorder_content',
  'legal_points_content',
  'rewards_page_content',
];

function slimStorefrontSettings(settings) {
  if (!settings || typeof settings !== 'object') return settings;
  const out = { ...settings };
  for (const key of HEAVY_SETTING_KEYS) {
    if (key in out) delete out[key];
  }
  return out;
}

module.exports = {
  CARD_PRODUCT_SQL,
  stripInternalProductFields,
  stripInternalProductList,
  toCardProduct,
  toCardProductList,
  slimStorefrontSettings,
};
