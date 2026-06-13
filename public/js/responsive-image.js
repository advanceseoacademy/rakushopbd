/**
 * Responsive local image URLs via /media/w{width}/path
 */
(function () {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizePath(url) {
    const u = String(url || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return u.startsWith('/') ? u : `/${u}`;
  }

  function isLocalMediaPath(url) {
    const path = normalizePath(url);
    return path.startsWith('/uploads/') || path.startsWith('/images/');
  }

  function mediaUrl(src, width) {
    const path = normalizePath(src);
    if (!path || /^https?:\/\//i.test(path)) return path;
    if (!isLocalMediaPath(path)) return path;
    const w = Math.min(Math.max(Number(width) || 800, 32), 1920);
    return `/media/w${w}${path}`;
  }

  function responsiveImgHtml(src, opts) {
    opts = opts || {};
    const path = normalizePath(src);
    if (!path) return '';

    const alt = escapeHtml(opts.alt || '');
    const cls = opts.className ? ` class="${escapeHtml(opts.className)}"` : '';
    const loading = opts.loading ? ` loading="${escapeHtml(opts.loading)}"` : '';
    const decoding = opts.decoding ? ` decoding="${escapeHtml(opts.decoding)}"` : '';
    const style = opts.style ? ` style="${escapeHtml(opts.style)}"` : '';
    const widthAttr = opts.width ? ` width="${Number(opts.width)}"` : '';
    const heightAttr = opts.height ? ` height="${Number(opts.height)}"` : '';
    const onerror = opts.onerror ? ` onerror="${opts.onerror}"` : '';

    if (!isLocalMediaPath(path)) {
      return `<img src="${escapeHtml(path)}" alt="${alt}"${cls}${loading}${decoding}${style}${widthAttr}${heightAttr}${onerror}>`;
    }

    const widths = Array.isArray(opts.widths) && opts.widths.length ? opts.widths : [400, 800];
    const sizes = escapeHtml(opts.sizes || '100vw');
    const main = mediaUrl(path, widths[0]);
    const srcset = widths.map((w) => `${escapeHtml(mediaUrl(path, w))} ${w}w`).join(', ');
    return `<img src="${escapeHtml(main)}" srcset="${srcset}" sizes="${sizes}" alt="${alt}"${cls}${loading}${decoding}${style}${widthAttr}${heightAttr}${onerror}>`;
  }

  window._rakuMediaUrl = mediaUrl;
  window._rakuResponsiveImgHtml = responsiveImgHtml;
})();
