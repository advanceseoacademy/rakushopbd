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

  function partitionCategories(categories) {
    const all = categories || [];
    const catParentId = (c) => {
      const p = c?.parent_id;
      return p == null || p === '' ? null : Number(p);
    };
    const catId = (c) => Number(c?.id);
    const topLevel = all.filter((c) => catParentId(c) == null);
    const childrenOf = (parentId) => all.filter((c) => catParentId(c) === Number(parentId));
    const withTotals = topLevel.map((c) => {
      const subs = childrenOf(c.id);
      const direct = Number(c.product_count) || 0;
      const subTotal = subs.reduce((sum, ch) => sum + (Number(ch.product_count) || 0), 0);
      return { ...c, product_count: direct + subTotal };
    });
    return { all, topLevel: withTotals, childrenOf };
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
    if (window.RakuSEO) window.RakuSEO.apply(window.RakuSEO.forHome());
    else document.title = `${name} — Best Online Shopping`;

    if (window._rakuApplyFooterSettings) window._rakuApplyFooterSettings(settings);

    const supportLink = document.getElementById('header-support');
    const supportPhone = document.getElementById('header-support-phone');
    const phone = (settings.contact_phone || '').trim();
    if (supportPhone && phone) {
      supportPhone.textContent = phone;
      if (supportLink) supportLink.href = `tel:${phone.replace(/\s/g, '')}`;
    }

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
      if (window._rakuStopHomeScrollAuto) window._rakuStopHomeScrollAuto('trust-bar');
      if (window._rakuInitHomeScrollAuto) {
        setTimeout(() => window._rakuInitHomeScrollAuto('trust-bar', 4000), 120);
      }
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

  let categoriesShowAll = false;

  function syncCategoryAutoScroll(isMobile, itemCount) {
    const stop = window._rakuStopHomeScrollAuto;
    const start = window._rakuInitHomeScrollAuto;
    if (!stop || !start) return;

    if (!isMobile || categoriesShowAll || itemCount < 2) {
      stop('home-category-track');
      return;
    }

    const bootAuto = (attempt) => {
      const track = document.getElementById('home-category-track');
      if (!track) return;
      const canScroll = track.scrollWidth > track.clientWidth + 4;
      if (canScroll || attempt >= 10) {
        start('home-category-track', 3400);
        return;
      }
      requestAnimationFrame(() => bootAuto(attempt + 1));
    };

    requestAnimationFrame(() => bootAuto(0));
  }

  function renderCategoryGridHome(categories, opts = {}) {
    const track = document.getElementById('home-category-track');
    const wrap = document.querySelector('#categories .category-scroll-wrap');
    if (!track) return;
    const { topLevel } = partitionCategories(categories || window._rakuCategories || []);
    const list = topLevel;
    if (opts.showAll != null) categoriesShowAll = Boolean(opts.showAll);
    const mobileScroll = window.matchMedia('(max-width: 768px)').matches;
    const show = categoriesShowAll ? list : mobileScroll ? list : list.slice(0, 6);

    track.classList.toggle('category-grid--all', categoriesShowAll);
    if (wrap) wrap.classList.toggle('category-scroll-wrap--home', !categoriesShowAll);
    track.innerHTML = show.length
      ? show
          .map((c, i) => {
            const pal = palette(i);
            const count = Number(c.product_count) || 0;
            return `<a href="/category/${encodeURIComponent(c.slug)}" class="cat-card" data-cat-slug="${escapeHtml(c.slug)}">
        <div class="cat-icon" style="background:${pal.bg};"><i class="ti ${escapeHtml(c.icon)}" style="color:${pal.color};"></i></div>
        <div class="cat-name">${escapeHtml(c.name_bn)}</div>
        <div class="cat-count">${count} product${count !== 1 ? 's' : ''}</div>
      </a>`;
          })
          .join('')
      : '<p class="category-scroll-empty">No categories yet.</p>';

    track.querySelectorAll('.cat-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const slug = card.dataset.catSlug;
        if (window.openCategory) window.openCategory(slug);
      });
    });

    syncCategoryAutoScroll(mobileScroll, show.length);

    const titleEl = document.getElementById('categories-section-title');
    if (titleEl) {
      titleEl.textContent = categoriesShowAll ? 'All Categories' : 'Shop by Category';
    }

    const seeAll = document.getElementById('see-all-categories');
    if (seeAll) {
      seeAll.innerHTML = categoriesShowAll
        ? 'Show less <i class="ti ti-arrow-left"></i>'
        : 'All Categories <i class="ti ti-arrow-right"></i>';
      if (!seeAll._rakuCatBound) {
        seeAll._rakuCatBound = true;
        seeAll.onclick = (e) => {
          e.preventDefault();
          categoriesShowAll = !categoriesShowAll;
          renderCategoryGridHome(window._rakuCategories, { showAll: categoriesShowAll });
          const section = document.getElementById('categories');
          if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
      }
    }
  }

  if (!window._rakuCatResizeBound) {
    window._rakuCatResizeBound = true;
    let catResizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(catResizeTimer);
      catResizeTimer = setTimeout(() => {
        if (window._rakuCategories?.length) {
          renderCategoryGridHome(window._rakuCategories);
        }
      }, 150);
    });
  }

  window._rakuShowAllCategories = function () {
    categoriesShowAll = true;
    renderCategoryGridHome(window._rakuCategories, { showAll: true });
    document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  function bindCategoryLink(link, onNavigate) {
    link.addEventListener('click', (e) => {
      if (window.RAKU_STANDALONE) {
        const href = link.getAttribute('href');
        if (href && href !== '#') window.location.href = href;
        if (typeof onNavigate === 'function') onNavigate();
        return;
      }
      e.preventDefault();
      const slug = link.dataset.navSlug;
      if (slug && window.openCategory) window.openCategory(slug);
      else if (window.showPage) window.showPage('home');
      if (typeof onNavigate === 'function') onNavigate();
    });
  }

  function renderGlobalCatNav(categories) {
    const dropdown = document.getElementById('header-cat-dropdown-list');
    const legacyNav = document.getElementById('global-cat-nav');
    const inner = dropdown || legacyNav?.querySelector('.cat-nav-inner') || legacyNav;
    if (!inner) return;
    const { topLevel, childrenOf } = partitionCategories(categories);
    let html = `<a href="/" class="cat-link" data-nav="home"><i class="ti ti-home"></i> Home</a>`;
    topLevel.forEach((c) => {
      html += `<a href="/category/${encodeURIComponent(c.slug)}" class="cat-link" data-nav-slug="${escapeHtml(c.slug)}"><i class="ti ${escapeHtml(c.icon)}"></i> ${escapeHtml(c.name_bn)}</a>`;
      childrenOf(c.id).forEach((sub) => {
        html += `<a href="/category/${encodeURIComponent(sub.slug)}" class="cat-link cat-link--sub" data-nav-slug="${escapeHtml(sub.slug)}"><i class="ti ${escapeHtml(sub.icon || c.icon)}"></i> ${escapeHtml(sub.name_bn)}</a>`;
      });
    });
    html += `<a href="/" class="cat-link" data-nav="sale"><i class="ti ti-discount"></i> Sale & Offers</a>`;
    inner.innerHTML = html;
    inner.querySelectorAll('.cat-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        if (window._rakuCloseCatDropdown) window._rakuCloseCatDropdown();
        if (window.RAKU_STANDALONE) {
          const href = link.getAttribute('href');
          if (href && href !== '#') window.location.href = href;
          return;
        }
        e.preventDefault();
        inner.querySelectorAll('.cat-link').forEach((l) => l.classList.remove('active'));
        link.classList.add('active');
        const slug = link.dataset.navSlug;
        if (slug && window.openCategory) window.openCategory(slug);
        else if (window.showPage) window.showPage('home');
      });
    });
  }

  function renderMobileCatNav(categories) {
    const list = document.getElementById('mobile-cat-menu-list');
    if (!list) return;
    const { topLevel, childrenOf } = partitionCategories(categories);
    let html = `<a href="/" class="mobile-cat-link" data-nav="home"><i class="ti ti-home"></i> Home</a>`;
    topLevel.forEach((c) => {
      const subs = childrenOf(c.id);
      if (subs.length) {
        html += `<div class="mobile-menu-group">
          <button type="button" class="mobile-menu-group-toggle" aria-expanded="false">
            <span><i class="ti ${escapeHtml(c.icon)}"></i> ${escapeHtml(c.name_bn)}</span>
            <i class="ti ti-chevron-down"></i>
          </button>
          <div class="mobile-menu-sub">
            <a href="/category/${encodeURIComponent(c.slug)}" class="mobile-cat-link mobile-cat-link--sub" data-nav-slug="${escapeHtml(c.slug)}"><i class="ti ${escapeHtml(c.icon)}"></i> All ${escapeHtml(c.name_bn)}</a>`;
        subs.forEach((sub) => {
          html += `<a href="/category/${encodeURIComponent(sub.slug)}" class="mobile-cat-link mobile-cat-link--sub" data-nav-slug="${escapeHtml(sub.slug)}"><i class="ti ${escapeHtml(sub.icon || c.icon)}"></i> ${escapeHtml(sub.name_bn)}</a>`;
        });
        html += `</div></div>`;
      } else {
        html += `<a href="/category/${encodeURIComponent(c.slug)}" class="mobile-cat-link" data-nav-slug="${escapeHtml(c.slug)}"><i class="ti ${escapeHtml(c.icon)}"></i> ${escapeHtml(c.name_bn)}</a>`;
      }
    });
    html += `<a href="/" class="mobile-cat-link" data-nav="sale"><i class="ti ti-discount"></i> Sale & Offers</a>`;
    list.innerHTML = html;
    list.querySelectorAll('.mobile-cat-link').forEach((link) => {
      bindCategoryLink(link, () => {
        if (window._rakuCloseMobileCatMenu) window._rakuCloseMobileCatMenu();
      });
    });
    list.querySelectorAll('.mobile-menu-group-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.closest('.mobile-menu-group');
        if (!group) return;
        group.classList.toggle('open');
        btn.setAttribute('aria-expanded', group.classList.contains('open') ? 'true' : 'false');
      });
    });
  }

  function renderHomeFilterTabs(categories) {
    const tabs = document.getElementById('cat-filter-tabs');
    if (!tabs) return;
    const { topLevel, childrenOf } = partitionCategories(categories);
    let html = `<button class="cat-filter-btn active" data-cat="all" type="button">All Products</button>`;
    topLevel.forEach((c) => {
      html += `<button class="cat-filter-btn" data-cat="${escapeHtml(c.slug)}" type="button">${escapeHtml(c.name_bn)}</button>`;
      childrenOf(c.id).forEach((sub) => {
        html += `<button class="cat-filter-btn cat-filter-btn--sub" data-cat="${escapeHtml(sub.slug)}" type="button">${escapeHtml(sub.name_bn)}</button>`;
      });
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
    const { topLevel, childrenOf } = partitionCategories(categories);
    sel.innerHTML = '<option value="all">All Products</option>';
    topLevel.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.slug;
      opt.textContent = c.name_bn;
      sel.appendChild(opt);
      childrenOf(c.id).forEach((sub) => {
        const subOpt = document.createElement('option');
        subOpt.value = sub.slug;
        subOpt.textContent = `↳ ${sub.name_bn}`;
        sel.appendChild(subOpt);
      });
    });
  }

  function bindFooterLinks() {
    document.querySelectorAll('.footer-links a[data-footer-page]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const page = a.dataset.footerPage;
        e.preventDefault();
        if (page === 'track' && window.showPage) {
          window.showPage('track');
          return;
        }
        if (page === 'faq' && window.showPage) {
          window.showPage('faq');
          return;
        }
        if (page === 'contact' && window.showPage) {
          window.showPage('contact');
          return;
        }
        if (page === 'home' && window.showPage) window.showPage('home');
        else if (page === 'account' && window.showPage) window.showPage('account');
        else if (page === 'cart' && window.showPage) {
          window.showPage('cart');
          if (window.renderCart) void window.renderCart();
        } else if (page === 'appointment' && window.showPage) window.showPage('appointment');
      });
    });
  }
  window._rakuBindFooterLinks = bindFooterLinks;

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

  function parseSpecLineWords(trimmed) {
    const words = trimmed.split(/\s+/);
    if (words.length < 2) return null;
    for (let i = Math.min(4, words.length - 1); i >= 1; i -= 1) {
      const label = words.slice(0, i).join(' ');
      const value = words.slice(i).join(' ');
      if (value.length < 1 || label.length < 2) continue;
      if (/[,;]/.test(label)) continue;
      return { label, value };
    }
    return null;
  }

  function parseSpecLine(line, loose) {
    const trimmed = String(line || '').trim();
    if (!trimmed) return null;

    const tabIdx = trimmed.indexOf('\t');
    if (tabIdx > 0) {
      const label = trimmed.slice(0, tabIdx).trim();
      const value = trimmed.slice(tabIdx + 1).trim();
      if (label && value) return { label, value };
    }

    const pipeMatch = trimmed.match(/^([^|]{1,80})\|\s*(.+)$/);
    if (pipeMatch) {
      const label = pipeMatch[1].trim();
      const value = pipeMatch[2].trim();
      if (label && value) return { label, value };
    }

    const colonMatch = trimmed.match(/^([^:]{1,80}):\s*(.+)$/);
    if (colonMatch) {
      const label = colonMatch[1].trim();
      const value = colonMatch[2].trim();
      if (label && value) return { label, value };
    }

    const multiSpace = trimmed.match(/^(.{2,60}?)\s{2,}(.+)$/);
    if (multiSpace) {
      const label = multiSpace[1].trim();
      const value = multiSpace[2].trim();
      if (label && value) return { label, value };
    }

    return loose ? parseSpecLineWords(trimmed) : null;
  }

  function parseProductDescription(text, opts = {}) {
    const loose = Boolean(opts.loose);
    const lines = String(text || '').split(/\r?\n/);
    const specs = [];
    const prose = [];

    lines.forEach((line) => {
      if (!String(line).trim()) return;
      const spec = parseSpecLine(line, loose);
      if (spec) specs.push(spec);
      else prose.push(String(line).trim());
    });

    return { specs, prose };
  }

  function getProductSpecs(p) {
    const short = String(p.short_description || '').trim();
    if (!short) return [];

    const strict = parseProductDescription(short, { loose: false });
    if (strict.specs.length && !strict.prose.length) return strict.specs;
    if (strict.specs.length) return strict.specs;

    const loose = parseProductDescription(short, { loose: true });
    if (loose.prose.length) return [];

    if (loose.specs.length >= 2) return loose.specs;

    if (loose.specs.length === 1) {
      const line = short.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
      if (/\t/.test(line) || /:\s/.test(line) || /\|/.test(line) || /\s{2,}/.test(line)) {
        return loose.specs;
      }
    }

    return [];
  }

  function productShortDescription(p) {
    const short = String(p.short_description || '').trim();
    if (short) {
      const { specs, prose } = parseProductDescription(short, { loose: true });
      if (specs.length && !prose.length) return '';
      if (prose.length) {
        const line = prose[0];
        return line.length > 240 ? `${line.slice(0, 237)}…` : line;
      }
      if (specs.length) return '';
      return short.length > 240 ? `${short.slice(0, 237)}…` : short;
    }
    const desc = String(p.description_bn || '').trim();
    if (!desc) return '';
    const { prose, specs } = parseProductDescription(desc);
    if (prose.length) {
      const line = prose[0];
      return line.length > 240 ? `${line.slice(0, 237)}…` : line;
    }
    if (specs.length) {
      const preview = specs
        .slice(0, 3)
        .map((row) => `${row.label}: ${row.value}`)
        .join(' · ');
      return preview.length > 240 ? `${preview.slice(0, 237)}…` : preview;
    }
    const first = desc.split(/\n+/).find((line) => line.trim()) || desc;
    const line = first.trim();
    return line.length > 240 ? `${line.slice(0, 237)}…` : line;
  }

  function renderSpecTable(specs) {
    if (!specs.length) return '';
    const rows = specs
      .map(
        (row) =>
          `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td></tr>`
      )
      .join('');
    return `<div class="product-desc-spec"><table class="spec-table"><tbody>${rows}</tbody></table></div>`;
  }

  function renderProductDescriptionHtml(p) {
    const longText = String(p.description_bn || '').trim();
    if (longText) {
      const lines = longText.split(/\r?\n/).filter(Boolean);
      if (lines.length > 1) {
        return lines.map((line) => `<p class="product-desc-prose">${escapeHtml(line)}</p>`).join('');
      }
      return `<p class="product-desc-prose">${escapeHtml(longText)}</p>`;
    }

    return `<p class="product-desc-prose">${escapeHtml(p.name_bn)} — quality product from ${escapeHtml(p.category_name || 'RakuShopBD')}.</p>`;
  }

  function setProductSpecUiVisible(show) {
    const specTabBtn = document.querySelector('.tab-btn[data-tab="tab-spec"]');
    const specPane = document.getElementById('tab-spec');
    if (specTabBtn) specTabBtn.hidden = !show;
    if (specPane && !show) {
      specPane.style.display = 'none';
      const descBtn = document.querySelector('.tab-btn[data-tab="tab-desc"]');
      const descPane = document.getElementById('tab-desc');
      if (descBtn && descPane && specTabBtn?.classList.contains('active')) {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        descBtn.classList.add('active');
        descPane.style.display = '';
      }
    }
  }

  window._rakuEnhanceProductPageSync = function (p) {
    if (!p) return;

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

    const specsInline = document.getElementById('pv-specs-inline');
    const specs = getProductSpecs(p);
    if (specsInline) {
      if (specs.length) {
        specsInline.innerHTML = renderSpecTable(specs);
        specsInline.hidden = false;
      } else {
        specsInline.innerHTML = '';
        specsInline.hidden = true;
      }
    }

    setProductSpecUiVisible(specs.length > 0);

    const discBadge = document.querySelector('#page-product .pv-discount-badge');
    const pct = window.discountPercent ? window.discountPercent(p) : Number(p.discount_percent) || null;
    if (discBadge) {
      if (pct) {
        discBadge.textContent = `${pct}% OFF`;
        discBadge.style.display = '';
      } else discBadge.style.display = 'none';
    }

    const badgeRow = document.getElementById('pv-badge-row');
    if (badgeRow) {
      let bh = '';
      if (pct) bh += `<span class="pv-badge">-${pct}%</span>`;
      if (p.tag_text && (!pct || p.tag_type !== 'discount')) {
        bh += `<span class="pv-badge pv-badge-new"><i class="ti ti-bolt" style="font-size:10px;"></i> ${escapeHtml(p.tag_text)}</span>`;
      }
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

    if (window.updateProductPurchaseButtons) window.updateProductPurchaseButtons(p);

    const sku = document.getElementById('pv-sku');
    if (sku) {
      const val = String(p.sku || '').trim();
      sku.textContent = val || `SKU-${p.id}`;
    }

    const desc = document.getElementById('tab-desc-content');
    if (desc) {
      desc.innerHTML = renderProductDescriptionHtml(p);
    }

    const spec = document.getElementById('tab-spec-content');
    if (spec) {
      if (specs.length) {
        spec.innerHTML = renderSpecTable(specs);
      } else {
        spec.innerHTML = '';
      }
    }
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
    renderMobileCatNav(categories);
    renderHomeFilterTabs(categories);
    renderSearchCategories(categories);
  }

  window._rakuPartitionCategories = partitionCategories;

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
