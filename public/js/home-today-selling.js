/**
 * Homepage hero sidebar — Today Selling products.
 */
(function () {
  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function productImgHtml(p) {
    if (p.image_url) {
      const src = window.productImageSrc ? window.productImageSrc(p.image_url) : p.image_url;
      const icon = esc(p.icon || 'ti ti-package');
      const color = esc(p.icon_color || '#2d8a2d');
      return `<img class="hero-today-product-photo" src="${esc(src)}" alt="${esc(p.name_bn)}" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false;"><i class="${icon}" style="color:${color};" hidden></i>`;
    }
    return `<i class="${esc(p.icon || 'ti ti-package')}" style="color:${esc(p.icon_color || '#2d8a2d')}"></i>`;
  }

  function formatPrice(amount) {
    if (window.formatPrice) return window.formatPrice(amount);
    return `৳${Number(amount || 0).toLocaleString('en-BD')}`;
  }

  function heroTodayProductHtml(p) {
    const slug = encodeURIComponent(p.slug || p.id);
    return `<a href="/product/${slug}" class="hero-today-product" data-product-id="${p.id}">
      <div class="hero-today-product-img" style="background:${esc(p.bg_color || '#f3f4f6')}">${productImgHtml(p)}</div>
      <div class="hero-today-product-body">
        <div class="hero-today-product-name">${esc(p.name_bn)}</div>
        <div class="hero-today-product-price">${formatPrice(p.price)}</div>
      </div>
    </a>`;
  }

  function bindTodaySellingLinks(root) {
    if (!root || window.RAKU_STANDALONE) return;
    root.querySelectorAll('.hero-today-product').forEach((link) => {
      link.addEventListener('click', (e) => {
        if (!window.openProduct) return;
        e.preventDefault();
        const id = Number(link.dataset.productId);
        if (id) void window.openProduct(id);
      });
    });
  }

  function syncHeroSideHeight() {
    const main = document.getElementById('hero-main');
    const side = document.getElementById('hero-today-selling');
    if (!main || !side) return;

    if (side.hidden || window.matchMedia('(max-width: 900px)').matches) {
      side.style.height = '';
      return;
    }

    const img = main.querySelector('img.hero-main-photo');
    if (img && !img.complete) return;

    const h = main.offsetHeight;
    if (h > 120) side.style.height = `${h}px`;
    else side.style.height = '';
  }

  function bindHeroSideHeightSync() {
    const main = document.getElementById('hero-main');
    if (!main || main._rakuHeroSideBound) return;
    main._rakuHeroSideBound = true;

    const img = main.querySelector('img.hero-main-photo');
    if (img) {
      img.addEventListener('load', syncHeroSideHeight, { once: false });
      img.addEventListener('error', syncHeroSideHeight, { once: false });
    }

    if (typeof ResizeObserver !== 'undefined') {
      const obs = new ResizeObserver(() => syncHeroSideHeight());
      obs.observe(main);
      main._rakuHeroSideObs = obs;
    }
  }

  window.syncHeroSideHeight = syncHeroSideHeight;

  let heroSideResizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(heroSideResizeTimer);
    heroSideResizeTimer = setTimeout(syncHeroSideHeight, 100);
  });

  window.applyTodaySellingData = function applyTodaySellingData(boot) {
    const section = document.getElementById('hero-today-selling');
    const titleEl = document.getElementById('hero-today-selling-title');
    const listEl = document.getElementById('hero-today-selling-list');
    if (!section || !listEl) return;

    const meta = boot?.todaySellingMeta || {};
    const enabled = meta.enabled !== false;
    const products = boot?.todaySelling || [];
    const title = meta.title || 'Today Selling';

    if (!enabled || !products.length) {
      section.hidden = true;
      listEl.innerHTML = '';
      syncHeroSideHeight();
      return;
    }

    section.hidden = false;
    if (titleEl) titleEl.textContent = title;
    listEl.innerHTML = products.slice(0, 2).map(heroTodayProductHtml).join('');
    bindTodaySellingLinks(listEl);
    bindHeroSideHeightSync();
    requestAnimationFrame(() => {
      syncHeroSideHeight();
      requestAnimationFrame(syncHeroSideHeight);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindHeroSideHeightSync);
  } else {
    bindHeroSideHeightSync();
  }
})();
