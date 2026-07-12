/**
 * URL slug from title — keeps Latin + Bengali letters/marks (matras), not only a-z.
 * Pure Bangla titles used to collapse to the fallback "item".
 */
function slugify(text) {
  const s = String(text || '')
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/[\s_/\\|]+/g, '-')
    // Letters + combining marks (Bengali matras) + digits
    .replace(/[^\p{L}\p{M}\p{N}-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return s || 'item';
}

/** True when slug is the empty-title fallback (item, item-1, item-2, …). */
function isPlaceholderSlug(slug) {
  return /^item(-\d+)?$/i.test(String(slug || '').trim());
}

module.exports = { slugify, isPlaceholderSlug };
