/**
 * RakuShopBD — Dynamic storefront UI (categories, stats, footer, product detail)
 * Loaded after api.js; uses globals from api.js IIFE.
 */
(function () {
  const CAT_PALETTE = [
    { bg: '#e8f5e8', color: '#2d8a2d' },
    { bg: '#fdf0f3', color: '#d48696' },
    { bg: '#faf3e0', color: '#8a6914' },
    { bg: '#fce8ec', color: '#9e5568' },
    { bg: '#e8f5e8', color: '#206020' },
    { bg: '#f0f8ff', color: '#2d8a2d' },
  ];

  function palette(i) {
    return CAT_PALETTE[i % CAT_PALETTE.length];
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function starsHtml(rating) {
    const r = Math.round(Number(rating) || 0);
    let h = '';
    for (let i = 1; i <= 5; i++) {
      h += i <= r ? '★' : '☆';
    }
    return h;
  }

  function applySiteBranding(settings) {
    if (!settings) return;
    const name = settings.site_name || 'RakuShopBD';
    document.title = `${name} — Best Online Shopping`;
    const fd = document.querySelector('.footer-desc');
    if (fd && settings.footer_desc) fd.textContent = settings.footer_desc;
    else if (fd && settings.site_tagline) fd.textContent = settings.site_tagline;

    const phone = document.getElementById('footer-phone');
    if (phone && settings.contact_phone) {
      phone.href = `tel:${settings.contact_phone.replace(/\s/g, '')}`;
      phone.innerHTML = `<i class="ti ti-phone"></i>${escapeHtml(settings.contact_phone)}`;
    }
    const email = document.getElementById('footer-email');
    if (email && settings.contact_email) {
      email.href = `mailto:${settings.contact_email}`;
      email.innerHTML = `<i class="ti ti-mail"></i>${escapeHtml(settings.contact_email)}`;
    }
    const addr = document.getElementById('footer-address');
    if (addr && settings.contact_address) {
      addr.innerHTML = `<i class="ti ti-map-pin"></i>${escapeHtml(settings.contact_address)}`;
    }
    const hours = document.getElementById('footer-hours');
    if (hours && settings.store_hours) {
      hours.innerHTML = `<i class="ti ti-clock"></i>${escapeHtml(settings.store_hours)}`;
    }
    const copy = document.getElementById('footer-copyright');
    if (copy) copy.textContent = `© ${new Date().getFullYear()} ${name} — All rights reserved`;

    const freeMin = settings.free_delivery_min || '500';
    const trust = [
      {
        icon: 'ti-truck-delivery',
        color: '#2d8a2d',
        title: settings.trust_1_title || 'Free & fast delivery',
        sub: settings.trust_1_sub || `Nationwide on orders over ৳${freeMin}`,
      },
      {
        icon: 'ti-shield-check',
        color: '#2d8a2d',
        title: settings.trust_2_title || '100% authentic products',
        sub: settings.trust_2_sub || 'Full refund on counterfeit items',
      },
      {
        icon: 'ti-refresh',
        color: '#8a6914',
        title: settings.trust_3_title || 'Easy returns policy',
        sub: settings.trust_3_sub || 'No-questions return within 7 days',
      },
      {
        icon: 'ti-headset',
        color: '#d48696',
        title: settings.trust_4_title || '24/7 customer support',
        sub: settings.trust_4_sub || 'Call or chat anytime',
      },
    ];
    const trustBar = document.getElementById('trust-bar');
    if (trustBar) {
      trustBar.innerHTML = trust
        .map(
          (t) => `<div class="trust-item">
        <i class="ti ${t.icon} trust-icon" style="color:${t.color};"></i>
        <div><div class="trust-title">${escapeHtml(t.title)}</div><div class="trust-sub">${escapeHtml(t.sub)}</div></div>
      </div>`
        )
        .join('');
    }

    const delBox = document.getElementById('pv-delivery-list');
    if (delBox) {
      delBox.innerHTML = `
        <div class="pv-delivery-item"><i class="ti ti-circle-check-filled"></i> Delivery in 1–2 days within Dhaka</div>
        <div class="pv-delivery-item"><i class="ti ti-circle-check-filled"></i> Nationwide delivery in 3–5 days</div>
        <div class="pv-delivery-item"><i class="ti ti-circle-check-filled"></i> Free delivery on orders over ৳${escapeHtml(freeMin)}</div>
        <div class="pv-delivery-item"><i class="ti ti-circle-check-filled"></i> 7-day return policy</div>`;
    }
  }

  function renderStats(stats) {
    const grid = document.getElementById('stats-grid');
    if (!grid || !stats) return;
    const fmt = (n) => {
      const x = Number(n) || 0;
      if (x >= 10000) return `${Math.floor(x / 1000)}k+`;
      if (x >= 1000) return `${(x / 1000).toFixed(1).replace('.0', '')}k+`;
      return `${x}+`;
    };
    const items = [
      { icon: 'ti-box', bg: '#e8f5e8', color: '#2d8a2d', num: `${stats.productCount}+`, label: 'Total Products' },
      { icon: 'ti-users', bg: '#e8f5e8', color: '#2d8a2d', num: '500+', label: 'Happy Customers' },
      { icon: 'ti-truck', bg: '#faf3e0', color: '#8a6914', num: `${stats.districts} Districts`, label: 'Delivery Coverage' },
      { icon: 'ti-star', bg: '#fce8ec', color: '#9e5568', num: `${stats.avgRating} ⭐`, label: 'Average Rating' },
    ];
    grid.innerHTML = items
      .map(
        (s) => `<div class="stat-card">
      <div class="stat-icon" style="background:${s.bg};"><i class="ti ${s.icon}" style="color:${s.color};"></i></div>
      <div><div class="stat-num">${escapeHtml(s.num)}</div><div class="stat-label">${escapeHtml(s.label)}</div></div>
    </div>`
      )
      .join('');
  }

  function renderCategoryGridHome(categories) {
    const grid = document.querySelector('#categories .category-grid');
    if (!grid) return;
    const show = categories.slice(0, 6);
    grid.innerHTML = show
      .map((c, i) => {
        const pal = palette(i);
        const count = Number(c.product_count) || 0;
        return `<a href="/category/${encodeURIComponent(c.slug)}" class="cat-card" data-cat-slug="${escapeHtml(c.slug)}">
        <div class="cat-icon" style="background:${pal.bg};"><i class="ti ${escapeHtml(c.icon)}" style="color:${pal.color};"></i></div>
        <div class="cat-name">${escapeHtml(c.name_bn)}</div>
        <div class="cat-count">${count} product${count !== 1 ? 's' : ''}</div>
      </a>`;
      })
      .join('');
    grid.querySelectorAll('.cat-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const slug = card.dataset.catSlug;
        if (window.openCategory) window.openCategory(slug);
      });
    });
    const seeAll = document.querySelector('#categories .see-all');
    if (seeAll) {
      seeAll.onclick = (e) => {
        e.preventDefault();
        if (show[0] && window.openCategory) window.openCategory(show[0].slug);
      };
    }
  }

  function renderGlobalCatNav(categories) {
    const nav = document.getElementById('global-cat-nav');
    if (!nav) return;
    const inner = nav.querySelector('.cat-nav-inner') || nav;
    let html = `<a href="/" class="cat-link" data-nav="home"><i class="ti ti-home"></i> Home</a>`;
    categories.forEach((c) => {
      html += `<a href="/category/${encodeURIComponent(c.slug)}" class="cat-link" data-nav-slug="${escapeHtml(c.slug)}"><i class="ti ${escapeHtml(c.icon)}"></i> ${escapeHtml(c.name_bn)}</a>`;
    });
    html += `<a href="/" class="cat-link" data-nav="sale"><i class="ti ti-discount"></i> Sale & Offers</a>`;
    inner.innerHTML = html;
    inner.querySelectorAll('.cat-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        inner.querySelectorAll('.cat-link').forEach((l) => l.classList.remove('active'));
        link.classList.add('active');
        const slug = link.dataset.navSlug;
        if (slug && window.openCategory) window.openCategory(slug);
        else if (window.showPage) window.showPage('home');
      });
    });
  }

  function renderHomeFilterTabs(categories) {
    const tabs = document.getElementById('cat-filter-tabs');
    if (!tabs) return;
    let html = `<button class="cat-filter-btn active" data-cat="all" type="button">All Products</button>`;
    categories.forEach((c) => {
      html += `<button class="cat-filter-btn" data-cat="${escapeHtml(c.slug)}" type="button">${escapeHtml(c.name_bn)}</button>`;
    });
    tabs.innerHTML = html;
    tabs.querySelectorAll('.cat-filter-btn').forEach((btn) => {
      btn.addEventListener('click', function () {
        const cat = this.dataset.cat;
        if (cat !== 'all' && window.openCategory) {
          window.openCategory(cat);
          return;
        }
        document.querySelectorAll('.cat-filter-btn').forEach((b) => b.classList.remove('active'));
        this.classList.add('active');
        const grid = document.getElementById('main-product-grid');
        if (!grid) return;
        grid.querySelectorAll('.product-card[data-cat]').forEach((card) => {
          card.classList.toggle('hidden', cat !== 'all' && card.dataset.cat !== cat);
        });
        const titleEl = document.getElementById('products-section-title');
        if (titleEl) titleEl.textContent = cat === 'all' ? 'Popular Products' : this.textContent.trim();
      });
    });
  }

  function renderSearchCategories(categories) {
    const sel = document.getElementById('search-category');
    if (!sel) return;
    sel.innerHTML = '<option value="all">All Products</option>';
    categories.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.slug;
      opt.textContent = c.name_bn;
      sel.appendChild(opt);
    });
  }

  function bindFooterLinks() {
    document.querySelectorAll('.footer-links a[data-footer-page]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const page = a.dataset.footerPage;
        if (page === 'track') {
          e.preventDefault();
          window.location.href = '/track';
          return;
        }
        e.preventDefault();
        if (page === 'home' && window.showPage) window.showPage('home');
        else if (page === 'account' && window.showPage) window.showPage('account');
        else if (page === 'cart' && window.showPage) window.showPage('cart');
      });
    });
  }

  window._rakuRenderSuccessOrder = function (result) {
    const box = document.getElementById('success-order-summary');
    if (!box || !result) return;
    const lines = (result.items || [])
      .map(
        (item) =>
          `<div style="display:flex; justify-content:space-between;"><span>${escapeHtml(item.name)} ×${item.qty}</span><span style="color:var(--text); font-weight:600;">${window.formatPrice ? window.formatPrice(item.lineTotal) : item.lineTotal}</span></div>`
      )
      .join('');
    box.innerHTML = `${lines}
      <div style="display:flex; justify-content:space-between; border-top:1px solid var(--border); padding-top:8px; margin-top:4px; font-size:14px; font-weight:700; color:var(--text);"><span>Total</span><span style="color:var(--accent);">${result.totalFormatted || ''}</span></div>`;
    const orderBox = document.querySelector('.order-id-box');
    if (orderBox && result.orderNumber) {
      orderBox.innerHTML = `<i class="ti ti-receipt"></i> Order ID: #${escapeHtml(result.orderNumber)}`;
    }
  };

  window._rakuEnhanceProductPageSync = function (p) {
    if (!p) return;
    const fmt = window.formatPrice || ((n) => n);

    const bcCat = document.getElementById('pv-breadcrumb-cat');
    const bcName = document.getElementById('pv-breadcrumb-name');
    if (bcCat) {
      bcCat.textContent = p.category_name || '';
      bcCat.style.cursor = 'pointer';
      bcCat.onclick = () => p.category_slug && window.openCategory && window.openCategory(p.category_slug);
    }
    if (bcName) bcName.textContent = p.name_bn;

    const stars = document.querySelector('#page-product .pv-stars');
    if (stars) stars.textContent = starsHtml(p.rating);
    const rNum = document.querySelector('#page-product .pv-rating-num');
    if (rNum) rNum.textContent = Number(p.rating).toFixed(1);
    const rev = document.querySelector('#page-product .pv-reviews');
    if (rev) rev.textContent = `(${Number(p.review_count) || 0} Reviews)`;
    const sold = document.querySelector('#page-product .pv-sold');
    if (sold) sold.style.display = 'none';

    const discBadge = document.querySelector('#page-product .pv-discount-badge');
    if (discBadge) {
      if (p.discount_percent) {
        discBadge.textContent = `${p.discount_percent}% saved`;
        discBadge.style.display = '';
      } else discBadge.style.display = 'none';
    }

    const badgeRow = document.getElementById('pv-badge-row');
    if (badgeRow) {
      let bh = '';
      if (p.discount_percent) bh += `<span class="pv-badge">-${p.discount_percent}%</span>`;
      if (p.tag_text) bh += `<span class="pv-badge pv-badge-new"><i class="ti ti-bolt" style="font-size:10px;"></i> ${escapeHtml(p.tag_text)}</span>`;
      badgeRow.innerHTML = bh;
      badgeRow.style.display = bh ? '' : 'none';
    }

    const stock = document.querySelector('#page-product .pv-stock');
    if (stock) {
      const s = Number(p.stock) || 0;
      stock.innerHTML =
        s > 0
          ? `<i class="ti ti-circle-check-filled"></i> In stock (${s} left)`
          : `<i class="ti ti-alert-circle"></i> Out of stock`;
      stock.style.color = s > 0 ? 'var(--green)' : 'var(--accent)';
    }

    const sku = document.getElementById('pv-sku');
    if (sku) sku.textContent = (p.slug || `SKU-${p.id}`).toUpperCase();

    const desc = document.getElementById('tab-desc-content');
    if (desc) {
      const text = (p.description_bn || '').trim();
      if (text) {
        const parts = text.split(/\n+/).filter(Boolean);
        if (parts.length > 1) {
          desc.innerHTML = `<p style="font-size:14px;color:var(--text-muted);line-height:1.8;margin-bottom:12px;"><strong style="color:var(--text);">${escapeHtml(p.name_bn)}</strong></p><ul style="font-size:13px;color:var(--text-muted);line-height:2;padding-left:20px;">${parts.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
        } else {
          desc.innerHTML = `<p style="font-size:14px;color:var(--text-muted);line-height:1.8;">${escapeHtml(text)}</p>`;
        }
      } else {
        desc.innerHTML = `<p style="font-size:14px;color:var(--text-muted);line-height:1.8;">${escapeHtml(p.name_bn)} — quality product from ${escapeHtml(p.category_name || 'RakuShopBD')}.</p>`;
      }
    }

    const spec = document.getElementById('tab-spec-content');
    if (spec) {
      spec.innerHTML = `<table class="spec-table">
        <tr><td>Category</td><td>${escapeHtml(p.category_name || '—')}</td></tr>
        <tr><td>Rating</td><td>${Number(p.rating).toFixed(1)} / 5 (${Number(p.review_count) || 0} reviews)</td></tr>
        <tr><td>Stock</td><td>${Number(p.stock) || 0} units</td></tr>
        <tr><td>Price</td><td>${fmt(p.price)}${p.old_price ? ` (was ${fmt(p.old_price)})` : ''}</td></tr>
      </table>`;
    }

    const thumbRow = document.querySelector('#page-product .thumb-row');
    if (thumbRow) thumbRow.style.display = 'none';
  };

  window._rakuEnhanceProductPageRelated = async function (p) {
    if (!p) return;
    const grid = document.getElementById('related-product-grid');
    if (!grid || !p.category_slug) return;
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);">Loading...</p>';
    try {
      const data = await window._rakuApiFetch(
        `/products?category=${encodeURIComponent(p.category_slug)}&limit=4&exclude=${p.id}`
      );
      if (data.ok && data.products.length) {
        grid.innerHTML = data.products.map((rp) => window.productCardHtml(rp)).join('');
        window.bindProductGridEvents();
      } else {
        grid.innerHTML = '<p style="grid-column:1/-1;color:var(--text-muted);">No related products.</p>';
      }
    } catch {
      grid.innerHTML = '';
    }
    const relSee = document.getElementById('related-see-all');
    if (relSee) {
      relSee.onclick = (e) => {
        e.preventDefault();
        if (window.openCategory) window.openCategory(p.category_slug);
      };
    }
  };

  window._rakuEnhanceProductPage = window._rakuEnhanceProductPageSync;

  function applyCategories(categories) {
    if (!categories?.length) return;
    window._rakuCategories = categories;
    if (window._rakuSetCategoryLabels) window._rakuSetCategoryLabels(categories);
    renderCategoryGridHome(categories);
    renderGlobalCatNav(categories);
    renderHomeFilterTabs(categories);
    renderSearchCategories(categories);
  }

  function initFromBootstrap(boot) {
    if (!boot?.ok) return;
    if (boot.categories?.length) applyCategories(boot.categories);
    if (boot.stats) renderStats(boot.stats);
    if (boot.settings) applySiteBranding(boot.settings);
    bindFooterLinks();
  }

  async function initDynamicStorefront() {
    const api = window._rakuApiFetch;
    if (!api) return;

    try {
      const [catRes, statsRes] = await Promise.all([api('/categories'), api('/stats')]);
      if (catRes.ok && catRes.categories) applyCategories(catRes.categories);
      if (statsRes.ok && statsRes.stats) renderStats(statsRes.stats);
    } catch (e) {
      console.warn('Dynamic storefront init', e);
    }

    if (window._rakuStoreSettings) applySiteBranding(window._rakuStoreSettings);
    bindFooterLinks();
  }

  document.addEventListener('raku:bootstrap', (e) => initFromBootstrap(e.detail));

  document.addEventListener('raku:ready', () => {
    if (!window.__RAKU_BOOTSTRAP?.ok) setTimeout(initDynamicStorefront, 0);
  });

  document.addEventListener('raku:settings-loaded', (e) => {
    applySiteBranding(e.detail || window._rakuStoreSettings);
  });
})();
