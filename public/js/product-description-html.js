/**
 * Normalize Quill / pasted product descriptions so line breaks render on the storefront.
 * Quill often saves an entire description as one <p> with literal \n characters.
 */
(function () {
  function isHtmlContent(s) {
    return /<[a-z][\s\S]*>/i.test(String(s || ''));
  }

  function normalizeProductDescriptionHtml(html) {
    const raw = String(html || '').trim();
    if (!raw) return '';

    if (!isHtmlContent(raw)) {
      return raw;
    }

    if (!/\n/.test(raw)) {
      return raw;
    }

    const normalized = raw.replace(/\r\n/g, '\n');
    const d = document.createElement('div');
    d.innerHTML = normalized;

    const onlyOneP =
      d.children.length === 1 &&
      d.firstElementChild &&
      d.firstElementChild.tagName === 'P';

    if (onlyOneP) {
      const inner = d.firstElementChild.innerHTML;
      const paragraphs = inner.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
      if (paragraphs.length > 1) {
        return paragraphs.map((part) => `<p>${part.replace(/\n/g, '<br>')}</p>`).join('');
      }
      return `<p>${inner.trim().replace(/\n/g, '<br>')}</p>`;
    }

    return normalized.replace(/\n/g, '<br>');
  }

  window._rakuNormalizeProductDescriptionHtml = normalizeProductDescriptionHtml;
})();
