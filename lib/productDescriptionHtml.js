/** Server-side product description HTML (matches public/js/product-description-html.js). */
function isHtmlContent(s) {
  return /<[a-z][\s\S]*>/i.test(String(s || ''));
}

function normalizeProductDescriptionHtml(html) {
  const raw = String(html || '').trim();
  if (!raw) return '';
  if (!isHtmlContent(raw)) return raw;
  if (!/\n/.test(raw)) return raw;

  const normalized = raw.replace(/\r\n/g, '\n');

  const pMatch = normalized.match(/^<p[^>]*>([\s\S]*)<\/p>$/i);
  if (pMatch) {
    const inner = pMatch[1];
    const paragraphs = inner
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (paragraphs.length > 1) {
      return paragraphs.map((part) => `<p>${part.replace(/\n/g, '<br>')}</p>`).join('');
    }
    return `<p>${inner.trim().replace(/\n/g, '<br>')}</p>`;
  }

  return normalized.replace(/\n/g, '<br>');
}

function renderProductDescriptionBody(product) {
  const longDesc = String(product?.description_bn || product?.descriptionBn || '').trim();
  if (!longDesc) return '';
  const html = normalizeProductDescriptionHtml(longDesc);
  if (html.indexOf('<') >= 0) {
    return `<div class="product-desc-rich">${html}</div>`;
  }
  return `<p class="product-desc-prose">${html}</p>`;
}

module.exports = { normalizeProductDescriptionHtml, renderProductDescriptionBody };
