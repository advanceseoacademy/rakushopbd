/**
 * Homepage hero sidebar — Today Selling (single featured product).
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
      const color = esc(p.icon_color || '#2D6B32');
      return `<img class="hero-today-product-photo" src="${esc(src)}" alt="${esc(p.name_bn)}" width="320" height="320" loading="eager" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false;"><i class="${icon}" style="color:${color};" hidden></i>`;
    }
    return `<i class="${esc(p.icon || 'ti ti-package')}" style="color:${esc(p.icon_color || '#2D6B32')}"></i>`;
  }

  function formatPrice(amount) {
    if (window.formatPrice) return window.formatPrice(amount);
    return `৳${Number(amount || 0).toLocaleString('en-BD')}`;
  }

  function getDiscount(p) {
    if (window.discountPercent) return window.discountPercent(p);
    const pct = Number(p.discount_percent);
    return Number.isFinite(pct) && pct > 0 && pct < 100 ? Math.round(pct) : null;
  }

  function heroTodayProductHtml(p) {
    const slug = encodeURIComponent(p.slug || p.id);
    const pct = getDiscount(p);
    const oldVal =
      pct && Number(p.price) > 0
        ? p.old_price || Math.round(Number(p.price) / (1 - pct / 100))
        : null;
    const oldHtml = oldVal ? `<span class="hero-today-product-old">${formatPrice(oldVal)}</span>` : '';
    const discHtml = pct ? `<span class="hero-today-product-disc">-${pct}%</span>` : '';
    const category = esc(p.category_name || '');

    return `<a href="/product/${slug}" class="hero-today-product hero-today-product--solo" data-product-id="${p.id}">
      <span class="hero-today-product-badge"><i class="ti ti-flame" aria-hidden="true"></i> Hot Deal</span>
      <div class="hero-today-product-img">
        <div class="hero-today-product-img-inner">${productImgHtml(p)}</div>
      </div>
      <div class="hero-today-product-body">
        ${category ? `<div class="hero-today-product-category">${category}</div>` : ''}
        <div class="hero-today-product-name">${esc(p.name_bn)}</div>
        <div class="hero-today-product-pricing">
          <span class="hero-today-product-price">${formatPrice(p.price)}</span>
          ${oldHtml}
          ${discHtml}
        </div>
        <span class="hero-today-product-cta">Shop Now <i class="ti ti-arrow-right" aria-hidden="true"></i></span>
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
      main.style.minHeight = '';
      return;
    }

    side.style.height = '';
    main.style.minHeight = '';

    const measure = () => {
      const mainH = Math.ceil(main.getBoundingClientRect().height);
      const sideH = Math.ceil(side.getBoundingClientRect().height);
      const targetH = Math.max(mainH, sideH, 260);
      if (targetH < 120) return;

      side.style.height = `${targetH}px`;
      if (main.classList.contains('hero-main--has-bg-photo')) {
        main.style.minHeight = `${targetH}px`;
      }
    };

    requestAnimationFrame(() => {
      measure();
      requestAnimationFrame(measure);
    });
  }

  function bindHeroSideHeightSync() {
    const main = document.getElementById('hero-main');
    const side = document.getElementById('hero-today-selling');
    if (!main || main._rakuHeroSideBound) return;
    main._rakuHeroSideBound = true;

    const onMainImageChange = () => syncHeroSideHeight();

    main.addEventListener('load', onMainImageChange, true);

    const img = main.querySelector('img.hero-main-photo');
    if (img) {
      img.addEventListener('load', syncHeroSideHeight, { once: false });
      img.addEventListener('error', syncHeroSideHeight, { once: false });
    }

    if (typeof ResizeObserver !== 'undefined') {
      const obs = new ResizeObserver(() => syncHeroSideHeight());
      obs.observe(main);
      if (side) obs.observe(side);
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
    const featured = products.find((p) => Number(p.today_selling_slot) === 1) || products[0];

    if (!enabled || !featured) {
      section.hidden = true;
      listEl.innerHTML = '';
      syncHeroSideHeight();
      return;
    }

    section.hidden = false;
    if (titleEl) titleEl.textContent = title;
    listEl.innerHTML = heroTodayProductHtml(featured);
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
