/** SEO-friendly product URLs: /product/smartwatch-pro */

function isNumericProductRef(ref) {
  return /^\d+$/.test(String(ref || '').trim());
}

function productPathSegment(productOrRef) {
  if (productOrRef && typeof productOrRef === 'object') {
    if (productOrRef.slug) return encodeURIComponent(String(productOrRef.slug));
    if (productOrRef.id != null) return String(productOrRef.id);
    return '';
  }
  const ref = String(productOrRef || '').trim();
  return isNumericProductRef(ref) ? ref : encodeURIComponent(ref);
}

function productPublicPath(productOrRef) {
  const seg = productPathSegment(productOrRef);
  return seg ? `/product/${seg}` : '/';
}

module.exports = {
  isNumericProductRef,
  productPathSegment,
  productPublicPath,
};
