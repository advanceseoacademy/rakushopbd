/**
 * Client-side image delivery helpers (WebP + responsive /media/ variants).
 */
(function () {
  function assetBase() {
    const base = String(window.RAKU_ASSET_BASE || window.RAKU_SHOP_ORIGIN || '').trim();
    return base ? base.replace(/\/$/, '') : '';
  }

  function normalizeUrl(url) {
    const u = String(url || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    const path = u.startsWith('/') ? u : `/${u}`;
    const base = assetBase();
    if (base && path.startsWith('/')) return base + path;
    return path;
  }

  function preferWebpUrl(url) {
    const u = normalizeUrl(url);
    if (!u.startsWith('/uploads/')) return u;
    if (/\.webp$/i.test(u)) return u;
    if (/\.(jpe?g|png|gif)$/i.test(u)) return u.replace(/\.(jpe?g|png|gif)$/i, '.webp');
    return u;
  }

  function isResizableUpload(url) {
    const u = preferWebpUrl(normalizeUrl(url));
    return u.startsWith('/uploads/') && /\.(webp|jpe?g|png|gif)$/i.test(u);
  }

  function variantUrl(url, width) {
    const u = preferWebpUrl(normalizeUrl(url));
    if (!isResizableUpload(u)) return u;
    const raw = Number(width);
    if (!Number.isFinite(raw) || raw <= 0) return u;
    const w = Math.max(48, Math.min(2560, Math.round(raw)));
    return `/media/${w}${u}`;
  }

  function srcset(url, widths, sizes) {
    const u = preferWebpUrl(normalizeUrl(url));
    if (!isResizableUpload(u)) {
      return { src: u, srcset: '', sizes: sizes || '' };
    }
    const list = (widths || [320, 480, 640, 960])
      .map((w) => `${variantUrl(u, w)} ${w}w`)
      .join(', ');
    return {
      src: variantUrl(u, widths[widths.length - 1] || 640),
      srcset: list,
      sizes: sizes || '(max-width: 480px) 50vw, (max-width: 768px) 33vw, 320px',
    };
  }

  function productCardSizes() {
    return '(max-width: 480px) 46vw, (max-width: 768px) 33vw, 240px';
  }

  function productDetailSizes() {
    return '(max-width: 768px) 100vw, 600px';
  }

  function heroBannerSizes() {
    return '(max-width: 768px) 100vw, 1200px';
  }

  function imgAttrs(url, opts) {
    opts = opts || {};
    const built = srcset(url, opts.widths, opts.sizes);
    const src = opts.srcWidth ? variantUrl(url, opts.srcWidth) : built.src;
    return {
      src,
      srcset: built.srcset,
      sizes: built.sizes,
    };
  }

  function imgTag(url, opts) {
    opts = opts || {};
    const attrs = imgAttrs(url, opts);
    const alt = String(opts.alt || '').replace(/"/g, '&quot;');
    const loading = opts.loading || 'lazy';
    const cls = opts.className ? ` class="${opts.className}"` : '';
    const style = opts.style ? ` style="${opts.style}"` : '';
    const w = opts.width ? ` width="${opts.width}"` : ' width="240"';
    const h = opts.height ? ` height="${opts.height}"` : ' height="240"';
    const srcsetAttr = attrs.srcset ? ` srcset="${attrs.srcset.replace(/"/g, '&quot;')}"` : '';
    const sizesAttr = attrs.sizes ? ` sizes="${attrs.sizes.replace(/"/g, '&quot;')}"` : '';
    return `<img src="${attrs.src.replace(/"/g, '&quot;')}" alt="${alt}"${srcsetAttr}${sizesAttr}${cls}${style}${w}${h} loading="${loading}" decoding="async">`;
  }

  window.rakuPreferWebpUrl = preferWebpUrl;
  window.rakuImageVariantUrl = variantUrl;
  window.rakuImageSrcset = srcset;
  window.rakuImageAttrs = imgAttrs;
  window.rakuImageTag = imgTag;
  window.rakuImageSizes = {
    productCard: productCardSizes,
    productDetail: productDetailSizes,
    heroBanner: heroBannerSizes,
  };
})();
