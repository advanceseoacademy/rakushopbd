/** Fields stored on products but never sent to the storefront. */
const INTERNAL_PRODUCT_KEYS = ['buy_price'];

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

module.exports = { stripInternalProductFields, stripInternalProductList };
