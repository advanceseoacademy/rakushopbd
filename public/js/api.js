/**
 * RakuShopBD — Backend API integration (MySQL + session cart)
 */
(function () {
  const API = (window.RAKU_API_BASE || '') + '/api';
  let products = [];
  let currentProduct = null;
  let wishlistIds = new Set();

  function fmtNum(n) {
    return Number(n).toLocaleString('en-US');
  }

  function formatPrice(amount) {
    return '৳' + fmtNum(Math.round(amount));
  }

  function stars(rating) {
    const r = Math.round(Number(rating) || 0);
    return '★'.repeat(Math.min(5, r)) + '☆'.repeat(Math.max(0, 5 - r));
  }

  function tagHtml(p) {
    if (p.tag_type === 'discount' && p.discount_percent) {
      return `<span class="prod-discount">-${fmtNum(p.discount_percent)}%</span>`;
    }
    if (p.tag_type === 'bestseller' && p.tag_text) {
      return `<span class="prod-tag" style="background:#EAF3DE;color:#3B6D11;">${p.tag_text}</span>`;
    }
    if (p.tag_type === 'hot' && p.tag_text) {
      return `<span class="prod-tag" style="background:#FAEEDA;color:#854F0B;">${p.tag_text}</span>`;
    }
    if (p.tag_type === 'new' && p.tag_text) {
      return `<span class="prod-tag" style="background:#e8f5e8;color:#2d8a2d;">${p.tag_text}</span>`;
    }
    return '';
  }

  function discountPercent(p) {
    if (p.discount_percent) return p.discount_percent;
    if (p.old_price && Number(p.old_price) > Number(p.price)) {
      return Math.round((1 - Number(p.price) / Number(p.old_price)) * 100);
    }
    return null;
  }

  function productImageAlt(p) {
    const alt = (p.image_alt || p.name_bn || p.name_en || 'Product').trim();
    return escapeHtml(alt || 'Product');
  }

  function productMediaHtml(p) {
    if (p.image_url) {
      const alt = productImageAlt(p);
      return `<img src="${p.image_url}" alt="${alt}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:contain;padding:8px;border-radius:inherit;">`;
    }
    return `<i class="${p.icon}" style="color:${p.icon_color};"></i>`;
  }

  function normalizeIconClass(icon) {
    const raw = String(icon || '').trim();
    if (!raw) return 'ti ti-package';
    if (raw.startsWith('ti ')) return raw;
    if (raw.startsWith('ti-')) return `ti ${raw}`;
    return raw;
  }

  function cartThumbHtml(item, cls) {
    if (item.imageUrl) {
      return `<img src="${item.imageUrl}" alt="${item.name || ''}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
    }
    return `<i class="${normalizeIconClass(item.icon)} ${cls || ''}" style="color:${item.iconColor || '#2d8a2d'};"></i>`;
  }

  function productCardHtml(p, opts = {}) {
    const oldPrice = p.old_price
      ? `<span class="prod-old">${formatPrice(p.old_price)}</span>`
      : '';
    const pct = discountPercent(p);
    const pctHtml = opts.showDiscountPct && pct
      ? `<span class="discount-pct">(-${pct}%)</span>`
      : '';
    return `
      <div class="product-card" data-cat="${p.category_slug}" data-id="${p.id}" data-price="${p.price}">
        <div class="prod-img" style="background:${p.bg_color};">
          ${tagHtml(p)}
          <button class="prod-wish" type="button" data-id="${p.id}" aria-label="Add to wishlist"><i class="ti ti-heart"></i></button>
          ${productMediaHtml(p)}
        </div>
        <div class="prod-info">
          <div class="prod-category">${p.category_name}</div>
          <div class="prod-name">${p.name_bn}</div>
          <div class="prod-rating"><span class="stars">${stars(p.rating)}</span><span class="rating-count">(${fmtNum(p.review_count)})</span></div>
          <div class="prod-foot">
            <div><span class="prod-price">${formatPrice(p.price)}</span>${oldPrice}${pctHtml}</div>
            <button class="add-cart-btn" type="button" data-id="${p.id}"><i class="ti ti-shopping-cart-plus"></i> Add to Cart</button>
          </div>
        </div>
      </div>`;
  }

  async function apiFetch(url, options) {
    const res = await fetch(API + url, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...options,
    });
    return res.json();
  }

  window._rakuApiFetch = apiFetch;
  window.formatPrice = formatPrice;

  const productDetailCache = new Map();
  const productFetchInflight = new Map();

  function mergeProductRecord(p) {
    if (!p?.id) return;
    productDetailCache.set(p.id, p);
    const idx = products.findIndex((x) => x.id === p.id);
    if (idx >= 0) products[idx] = p;
    else products.push(p);
  }

  async function fetchProductDetail(ref) {
    const raw = String(ref ?? '').trim();
    if (!raw) return null;
    const byId = /^\d+$/.test(raw);
    const cacheKey = byId ? Number(raw) : `slug:${raw}`;
    if (productDetailCache.has(cacheKey)) return productDetailCache.get(cacheKey);
    if (productFetchInflight.has(cacheKey)) return productFetchInflight.get(cacheKey);
    const apiPath = byId ? `/products/${raw}` : `/products/${encodeURIComponent(raw)}`;
    const job = apiFetch(apiPath)
      .then((data) => {
        productFetchInflight.delete(cacheKey);
        if (data.ok && data.product) {
          mergeProductRecord(data.product);
          productDetailCache.set(data.product.id, data.product);
          if (data.product.slug) productDetailCache.set(`slug:${data.product.slug}`, data.product);
          return data.product;
        }
        return null;
      })
      .catch(() => {
        productFetchInflight.delete(cacheKey);
        return null;
      });
    productFetchInflight.set(cacheKey, job);
    return job;
  }

  function prefetchProduct(id) {
    const n = Number(id);
    if (!n || productDetailCache.has(n) || productFetchInflight.has(n)) return;
    void fetchProductDetail(n);
  }
  window._rakuPrefetchProduct = prefetchProduct;

  function bootHomeSections(boot) {
    const best = boot.bestSelling?.length
      ? boot.bestSelling
      : boot.products || [];
    let newest = boot.newArrivals || [];
    if (!newest.length) {
      const seen = new Set();
      const pool = [...(boot.products || []), ...best];
      newest = pool
        .filter((p) => {
          if (!p?.id || seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        })
        .sort((a, b) => Number(b.id) - Number(a.id));
    }
    return { bestSelling: best, newArrivals: newest };
  }

  async function refreshHomeProductSections(boot) {
    if (!document.getElementById('track-new-arrivals')) return;
    try {
      const data = await apiFetch('/products/home-sections?limit=24');
      if (data?.ok) {
        paintHomeProductSections(data);
        return;
      }
    } catch (e) {
      console.warn('Home sections unavailable', e);
    }
    if (boot?.ok) paintHomeProductSections(bootHomeSections(boot));
  }

  async function syncCartBadge() {
    try {
      const data = await apiFetch('/cart');
      if (data.ok && window._rakuSetCartCount) {
        window._rakuSetCartCount(data.count);
      }
    } catch (_) {}
  }

  async function syncWishlist() {
    try {
      const data = await apiFetch('/wishlist');
      if (!data.ok) return;
      wishlistIds = new Set(data.ids || []);
      if (window._rakuSetWishCount) window._rakuSetWishCount(data.count);
      applyWishlistUI();
    } catch (_) {}
  }

  function setWishBtnState(btn, active) {
    if (!btn) return;
    btn.classList.toggle('active', active);
    const icon = btn.querySelector('i');
    if (!icon) return;
    icon.classList.toggle('ti-heart-filled', active);
    icon.classList.toggle('ti-heart', !active);
  }

  function applyWishlistUI() {
    document.querySelectorAll('.prod-wish[data-id]').forEach((btn) => {
      setWishBtnState(btn, wishlistIds.has(Number(btn.dataset.id)));
    });
    const btnWishLg = document.querySelector('.btn-wish-lg');
    if (btnWishLg && currentProduct) {
      setWishBtnState(btnWishLg, wishlistIds.has(currentProduct.id));
    }
  }

  async function toggleWishlist(productId) {
    const data = await apiFetch('/wishlist/toggle', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    });
    if (!data.ok) return data;
    wishlistIds = new Set(data.ids || []);
    if (window._rakuSetWishCount) window._rakuSetWishCount(data.count);
    applyWishlistUI();
    const wlPage = document.getElementById('page-wishlist');
    if (wlPage && wlPage.style.display !== 'none') await renderWishlist();
    return data;
  }

  function wishlistCardHtml(item) {
    return `
      <article class="wl-card" data-id="${item.productId}">
        <div class="wl-card-img" style="background:${item.bgColor};">
          <button type="button" class="wl-card-remove" data-id="${item.productId}" aria-label="Remove from wishlist"><i class="ti ti-x"></i></button>
          ${cartThumbHtml(item)}
        </div>
        <div class="wl-card-body">
          <div class="wl-card-cat">${item.category}</div>
          <div class="wl-card-name">${item.name}</div>
          <div class="wl-card-price">${formatPrice(item.price)}</div>
          <div class="wl-card-actions">
            <button type="button" class="wl-card-cart" data-id="${item.productId}"><i class="ti ti-shopping-cart-plus"></i> Add to Cart</button>
            <button type="button" class="wl-card-view" data-id="${item.productId}" aria-label="View product"><i class="ti ti-eye"></i></button>
          </div>
        </div>
      </article>`;
  }

  async function hydrateWishlistImages(items) {
    if (!Array.isArray(items) || !items.length) return items || [];
    const jobs = items.map(async (item) => {
      if (item?.imageUrl) return item;
      const detail = await fetchProductDetail(item.productId);
      if (!detail) return item;
      return {
        ...item,
        imageUrl: detail.image_url || null,
        icon: item.icon || detail.icon,
        iconColor: item.iconColor || detail.icon_color,
        bgColor: item.bgColor || detail.bg_color,
      };
    });
    return Promise.all(jobs);
  }

  function bindWishlistPageEvents() {
    const grid = document.getElementById('wishlist-grid');
    if (!grid) return;

    grid.querySelectorAll('.wl-card-remove').forEach((btn) => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        await toggleWishlist(Number(btn.dataset.id));
      };
    });

    grid.querySelectorAll('.wl-card-cart').forEach((btn) => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        await addToCart(Number(btn.dataset.id));
        flashBtn(btn, '<i class="ti ti-check"></i> Added', '<i class="ti ti-shopping-cart-plus"></i> Add to Cart');
      };
    });

    grid.querySelectorAll('.wl-card-view').forEach((btn) => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        await openProduct(Number(btn.dataset.id));
      };
    });

    grid.querySelectorAll('.wl-card').forEach((card) => {
      card.onclick = (e) => {
        if (e.target.closest('button')) return;
        openProduct(Number(card.dataset.id));
      };
    });
  }

  async function renderWishlist() {
    const data = await apiFetch('/wishlist');
    if (!data.ok) return;
    const wishlist = await hydrateWishlistImages(data.wishlist);

    const page = document.getElementById('page-wishlist');
    const empty = document.getElementById('wishlist-empty');
    const grid = document.getElementById('wishlist-grid');
    const countEl = document.getElementById('wishlist-item-count');
    const isEmpty = !wishlist.length;

    if (page) page.classList.toggle('wishlist-is-empty', isEmpty);
    if (empty) empty.hidden = !isEmpty;
    if (grid) {
      grid.hidden = isEmpty;
      grid.innerHTML = isEmpty ? '' : wishlist.map(wishlistCardHtml).join('');
    }
    if (countEl) {
      const n = data.count;
      countEl.textContent = `${fmtNum(n)} item${n === 1 ? '' : 's'}`;
    }

    bindWishlistPageEvents();
  }

  async function openWishlist() {
    await renderWishlist();
    if (window.showPage) window.showPage('wishlist');
    window.scrollTo(0, 0);
  }

  window.openWishlist = openWishlist;

  async function addToCart(productId, qty = 1) {
    const data = await apiFetch('/cart/add', {
      method: 'POST',
      body: JSON.stringify({ productId, qty }),
    });
    if (data.ok && window._rakuSetCartCount) {
      window._rakuSetCartCount(data.count);
    }
    return data;
  }

  function flashBtn(btn, okHtml, restoreHtml) {
    const orig = btn.innerHTML;
    btn.classList.add('added');
    btn.innerHTML = okHtml;
    setTimeout(() => {
      btn.classList.remove('added');
      btn.innerHTML = restoreHtml || orig;
    }, 1200);
  }

  function bindWishlist() {
    document.querySelectorAll('.prod-wish[data-id]').forEach((btn) => {
      btn.onclick = async function (e) {
        e.stopPropagation();
        await toggleWishlist(Number(this.dataset.id));
      };
    });
  }

  function bindProductWishButton() {
    const btnWishLg = document.querySelector('.btn-wish-lg');
    if (!btnWishLg || !currentProduct) return;
    btnWishLg.dataset.id = currentProduct.id;
    setWishBtnState(btnWishLg, wishlistIds.has(currentProduct.id));
    btnWishLg.onclick = async (e) => {
      e.stopPropagation();
      await toggleWishlist(currentProduct.id);
    };
  }

  function bindProductGridEvents() {
    bindWishlist();

    document.querySelectorAll('.add-cart-btn[data-id]').forEach((btn) => {
      btn.onclick = async function (e) {
        e.stopPropagation();
        await addToCart(Number(this.dataset.id));
        flashBtn(this, '<i class="ti ti-check"></i> Added', '<i class="ti ti-shopping-cart-plus"></i> Add to Cart');
      };
    });

    document
      .querySelectorAll(
        '#page-home .product-card[data-id], #page-category .product-card[data-id], #related-product-grid .product-card[data-id]'
      )
      .forEach((card) => {
        const pid = Number(card.dataset.id);
        card.addEventListener('mouseenter', () => prefetchProduct(pid), { passive: true });
        card.onclick = function (e) {
          if (e.target.closest('.add-cart-btn, .prod-wish')) return;
          void openProduct(pid);
        };
      });
  }

  const CATEGORY_LABELS = {
    all: 'All Products',
    'best-selling': 'Best Selling Products',
    'new-arrivals': 'New Arrivals',
  };

  const HOME_COLLECTIONS = {
    'best-selling': { title: 'Best Selling Products', api: '/products?sort=best-selling&limit=100' },
    'new-arrivals': { title: 'New Arrivals', api: '/products?sort=new-arrivals&limit=100' },
  };

  window._rakuSetCategoryLabels = function (categories) {
    categories.forEach((c) => {
      CATEGORY_LABELS[c.slug] = c.name_bn;
    });
  };

  const categoryState = {
    slug: 'electronics',
    items: [],
    filtered: [],
  };

  function priceInRange(price, range) {
    const p = Number(price);
    if (!range) return true;
    if (range === '10000+') return p >= 10000;
    const [min, max] = range.split('-').map(Number);
    return p >= min && p <= max;
  }

  function productMatchesBrand(p, brands) {
    if (!brands.length) return true;
    const name = (p.name_bn || '').toLowerCase();
    return brands.some((b) => name.includes(b.toLowerCase()));
  }

  function productMatchesRating(p, ratings) {
    if (!ratings.length) return true;
    const r = Number(p.rating) || 0;
    return ratings.some((min) => r >= Number(min));
  }

  function sortProducts(list, sortBy) {
    const arr = [...list];
    switch (sortBy) {
      case 'price-asc':
        return arr.sort((a, b) => a.price - b.price);
      case 'price-desc':
        return arr.sort((a, b) => b.price - a.price);
      case 'rating':
        return arr.sort((a, b) => b.rating - a.rating || b.review_count - a.review_count);
      case 'newest':
        return arr.sort((a, b) => Number(b.id) - Number(a.id));
      case 'best-selling':
        return arr.sort(
          (a, b) => (Number(b.sold_qty) || 0) - (Number(a.sold_qty) || 0) || b.id - a.id
        );
      default:
        return arr.sort((a, b) => b.review_count - a.review_count);
    }
  }

  function getCategoryFilters() {
    const priceEl = document.querySelector('input[name="cat-price"]:checked');
    const priceRange = priceEl ? priceEl.value : '';
    const ratings = [...document.querySelectorAll('input[name="cat-rating"]:checked')].map((el) => el.value);
    const brands = [...document.querySelectorAll('input[name="cat-brand"]:checked')].map((el) => el.value);
    const sortBy = document.getElementById('cat-sort-select')?.value || 'popular';
    return { priceRange, ratings, brands, sortBy };
  }

  function applyCategoryFilters() {
    const { priceRange, ratings, brands, sortBy } = getCategoryFilters();
    let list = categoryState.items.filter(
      (p) => priceInRange(p.price, priceRange) && productMatchesRating(p, ratings) && productMatchesBrand(p, brands)
    );
    list = sortProducts(list, sortBy);
    categoryState.filtered = list;
    renderCategoryGrid();
    updateCategoryCounts();
  }

  function renderCategoryGrid() {
    const grid = document.getElementById('category-product-grid');
    const countEl = document.getElementById('cat-result-count');
    if (!grid) return;

    const label = CATEGORY_LABELS[categoryState.slug] || 'Products';
    const n = categoryState.filtered.length;

    if (countEl) {
      countEl.innerHTML = `<strong>${n}</strong> product${n === 1 ? '' : 's'} found in <strong>${label}</strong>`;
    }

    if (!n) {
      grid.innerHTML = '<p class="cat-empty">No products match your filters. Try adjusting filters.</p>';
      return;
    }

    grid.innerHTML = categoryState.filtered.map((p) => productCardHtml(p, { showDiscountPct: true })).join('');
    bindProductGridEvents();
  }

  function updateCategoryCounts() {
    const items = categoryState.items;
    [5, 4, 3].forEach((min) => {
      const el = document.querySelector(`[data-rating-count="${min}"]`);
      if (!el) return;
      const c = items.filter((p) => Number(p.rating) >= min).length;
      el.textContent = c ? `(${c})` : '';
    });
  }

  function deriveBrandsFromProducts(items) {
    const counts = {};
    items.forEach((p) => {
      const word = (p.name_bn || '').split(/[\s—\-–]+/)[0]?.trim();
      if (word && word.length > 2) counts[word] = (counts[word] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
  }

  function renderBrandFilters() {
    const list = document.getElementById('cat-brand-list');
    if (!list) return;
    const brands = deriveBrandsFromProducts(categoryState.items);
    if (!brands.length) {
      list.innerHTML = '<p style="font-size:12px;color:var(--text-muted);">No brand filters</p>';
      return;
    }
    list.innerHTML = brands
      .map(
        (b) => `
      <label class="filter-option">
        <input type="checkbox" name="cat-brand" value="${b}">
        ${b}
        <span class="count brand-count" data-brand="${b}"></span>
      </label>`
      )
      .join('');

    brands.forEach((b) => {
      const el = list.querySelector(`[data-brand="${b}"]`);
      if (!el) return;
      const c = categoryState.items.filter((p) =>
        (p.name_bn || '').toLowerCase().includes(b.toLowerCase())
      ).length;
      el.textContent = c ? `(${c})` : '';
    });
  }

  function resetCategoryFilters() {
    document.querySelectorAll('input[name="cat-price"]').forEach((el) => {
      el.checked = el.value === '';
    });
    document.querySelectorAll('input[name="cat-rating"], input[name="cat-brand"]').forEach((el) => {
      el.checked = false;
    });
    const sort = document.getElementById('cat-sort-select');
    if (sort) sort.value = 'popular';
  }

  function bindCategoryFilterEvents() {
    document.querySelectorAll('input[name="cat-price"], input[name="cat-rating"]').forEach((el) => {
      el.onchange = applyCategoryFilters;
    });
    const sort = document.getElementById('cat-sort-select');
    if (sort) sort.onchange = applyCategoryFilters;

    const brandList = document.getElementById('cat-brand-list');
    if (brandList) {
      brandList.onclick = (e) => {
        if (e.target.matches('input[name="cat-brand"]')) applyCategoryFilters();
      };
    }
  }

  async function openCategory(slug, opts = {}) {
    const collection = HOME_COLLECTIONS[slug];
    const fallback = window._rakuCategories?.[0]?.slug || 'all';
    categoryState.slug = slug || (collection ? slug : fallback);
    const label = collection?.title || CATEGORY_LABELS[categoryState.slug] || 'Products';

    const crumb = document.getElementById('cat-breadcrumb-current');
    if (crumb) crumb.textContent = label;

    document.querySelectorAll('#global-cat-nav .cat-link').forEach((link) => {
      const navSlug = link.dataset.navSlug;
      link.classList.toggle('active', navSlug === categoryState.slug);
    });

    const grid = document.getElementById('category-product-grid');
    if (grid) grid.innerHTML = '<p class="cat-loading">Loading products...</p>';

    if (window.showPage) {
      window.showPage('category', { categorySlug: categoryState.slug, skipUrl: opts.skipUrl });
    }

    resetCategoryFilters();
    const sortEl = document.getElementById('cat-sort-select');
    if (sortEl) {
      if (slug === 'best-selling') sortEl.value = 'best-selling';
      else if (slug === 'new-arrivals') sortEl.value = 'newest';
    }

    const apiUrl = collection
      ? collection.api
      : `/products?category=${encodeURIComponent(categoryState.slug)}`;

    try {
      const data = await apiFetch(apiUrl);
      if (data.ok) {
        categoryState.items = data.products;
        products = [...new Map([...products, ...data.products].map((p) => [p.id, p])).values()];
      } else {
        categoryState.items = collection
          ? []
          : products.filter((p) => p.category_slug === categoryState.slug);
      }
    } catch {
      categoryState.items = collection
        ? []
        : products.filter((p) => p.category_slug === categoryState.slug);
    }

    renderBrandFilters();
    bindCategoryFilterEvents();
    categoryState.filtered = [...categoryState.items];
    applyCategoryFilters();

    if (window.RakuSEO) {
      const cats = window._rakuCategories || [];
      const cat =
        cats.find((c) => c.slug === categoryState.slug) ||
        { slug: categoryState.slug, name_bn: label };
      window.RakuSEO.apply(window.RakuSEO.forCategory(cat));
    }
  }

  window.openCategory = openCategory;
  window.renderCart = renderCart;
  window.renderCheckout = renderCheckout;
  window.productCardHtml = productCardHtml;
  window.bindProductGridEvents = bindProductGridEvents;

  function paintProductCore(p) {
    if (!p) return;
    const titleEl = document.querySelector('#page-product .pv-title');
    if (titleEl) titleEl.textContent = p.name_bn || 'Loading...';

    const priceEl = document.querySelector('#page-product .pv-price');
    if (priceEl) priceEl.textContent = formatPrice(p.price);

    const oldEl = document.querySelector('#page-product .pv-old-price');
    if (oldEl) {
      oldEl.textContent = p.old_price ? formatPrice(p.old_price) : '';
      oldEl.style.display = p.old_price ? '' : 'none';
    }

    const catEl = document.querySelector('#page-product .pv-cat');
    if (catEl) catEl.textContent = `${p.category_name || ''} › ${p.name_bn || ''}`.replace(/^ › /, '');

    const mainImg = document.querySelector('.main-product-img');
    if (mainImg) {
      mainImg.style.background = p.bg_color;
      let imgEl = mainImg.querySelector('img.product-photo');
      if (p.image_url) {
        if (!imgEl) {
          imgEl = document.createElement('img');
          imgEl.className = 'product-photo';
          imgEl.style.cssText = 'width:100%;height:100%;object-fit:contain;';
          imgEl.loading = 'eager';
          imgEl.decoding = 'async';
          mainImg.innerHTML = '';
          mainImg.appendChild(imgEl);
        }
        if (imgEl.src !== p.image_url) imgEl.src = p.image_url;
        imgEl.alt = (p.image_alt || p.name_bn || 'Product').trim();
      } else {
        if (imgEl) imgEl.remove();
        let mainIcon = mainImg.querySelector('i');
        if (!mainIcon) {
          mainIcon = document.createElement('i');
          mainImg.appendChild(mainIcon);
        }
        mainIcon.className = p.icon;
        mainIcon.style.color = p.icon_color;
      }
    }

    document.querySelectorAll('.thumb-img').forEach((t, i) => {
      if (i === 0) {
        t.style.background = p.bg_color;
        t.classList.add('active');
      }
    });
  }

  function bindProductActions(p) {
    const btnAdd = document.getElementById('btn-add-to-cart-main');
    if (btnAdd) {
      btnAdd.onclick = async () => {
        await addToCart(p.id);
        if (window.showPage) window.showPage('cart');
        renderCart();
      };
    }
    const btnBuy = document.getElementById('btn-buy-now');
    if (btnBuy) {
      btnBuy.onclick = async () => {
        await addToCart(p.id);
        await syncCartBadge();
        if (window.openCheckoutModal) await window.openCheckoutModal();
        else if (window.showPage) window.showPage('checkout');
      };
    }
    bindProductWishButton();
  }

  function finishProductPage(p) {
    if (window.RakuSEO && p?.id) window.RakuSEO.apply(window.RakuSEO.forProduct(p));
    const reviewMsg = document.getElementById('review-submit-msg');
    if (reviewMsg) reviewMsg.className = 'reviews-submit-msg';
    loadProductReviews(p.id);
    bindReviewSubmit(p.id);
    setReviewRating(5);
    if (window._rakuEnhanceProductPageSync) window._rakuEnhanceProductPageSync(p);
    void window._rakuEnhanceProductPageRelated?.(p);
  }

  async function openProduct(idOrSlug, opts = {}) {
    const raw = String(idOrSlug ?? '').trim();
    if (!raw) return;
    const byId = /^\d+$/.test(raw);
    const n = byId ? Number(raw) : null;

    let p =
      (byId && products.find((x) => x.id === n)) ||
      products.find((x) => x.slug === raw) ||
      (byId && productDetailCache.get(n)) ||
      productDetailCache.get(`slug:${raw}`) ||
      (window.__RAKU_PRELOAD_PRODUCT?.ok &&
      (byId
        ? window.__RAKU_PRELOAD_PRODUCT.product?.id === n
        : window.__RAKU_PRELOAD_PRODUCT.product?.slug === raw)
        ? window.__RAKU_PRELOAD_PRODUCT.product
        : null);

    if (!p) {
      paintProductCore({ name_bn: 'Loading...', price: 0, bg_color: '#f5f5f5' });
      p = await fetchProductDetail(raw);
      if (!p) return;
    }

    mergeProductRecord(p);
    currentProduct = p;
    paintProductCore(p);
    bindProductActions(p);
    finishProductPage(p);

    if (window.showPage) {
      window.showPage('product', {
        productId: p.id,
        productSlug: p.slug,
        skipUrl: opts.skipUrl,
      });
    }

    if ('category_slug' in p && 'stock' in p) return;

    const full = await fetchProductDetail(p.slug || p.id);
    if (!full || full.id !== p.id) return;
    mergeProductRecord(full);
    currentProduct = full;
    paintProductCore(full);
    bindProductActions(full);
    if (window.RakuSEO) window.RakuSEO.apply(window.RakuSEO.forProduct(full));
    if (window._rakuEnhanceProductPageSync) window._rakuEnhanceProductPageSync(full);
    void window._rakuEnhanceProductPageRelated?.(full);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderStarIcons(rating, max = 5) {
    let html = '';
    for (let i = 1; i <= max; i++) {
      html +=
        i <= rating
          ? '<i class="ti ti-star-filled star-filled"></i>'
          : '<i class="ti ti-star star-empty"></i>';
    }
    return `<div class="review-stars-row">${html}</div>`;
  }

  function setReviewRating(value) {
    const v = Math.min(5, Math.max(1, Number(value) || 5));
    const hidden = document.getElementById('review-rating');
    const picker = document.getElementById('review-star-picker');
    if (hidden) hidden.value = String(v);
    if (picker) picker.dataset.rating = String(v);
    document.querySelectorAll('.reviews-star-btn').forEach((btn) => {
      const n = Number(btn.dataset.star);
      btn.classList.toggle('active', n <= v);
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = n <= v ? 'ti ti-star-filled' : 'ti ti-star';
      }
    });
  }

  function bindStarPicker() {
    const picker = document.getElementById('review-star-picker');
    if (!picker || picker._rakuBound) return;
    picker._rakuBound = true;
    picker.querySelectorAll('.reviews-star-btn').forEach((btn) => {
      btn.addEventListener('click', () => setReviewRating(btn.dataset.star));
      btn.addEventListener('mouseenter', () => {
        const hover = Number(btn.dataset.star);
        picker.querySelectorAll('.reviews-star-btn').forEach((b) => {
          const n = Number(b.dataset.star);
          b.classList.toggle('active', n <= hover);
          const icon = b.querySelector('i');
          if (icon) icon.className = n <= hover ? 'ti ti-star-filled' : 'ti ti-star';
        });
      });
    });
    picker.addEventListener('mouseleave', () => setReviewRating(picker.dataset.rating || 5));
  }

  function showReviewMsg(text, type) {
    const msg = document.getElementById('review-submit-msg');
    if (!msg) return;
    msg.textContent = text;
    msg.className = 'reviews-submit-msg show ' + (type || '');
  }

  function bindReviewSubmit(productId) {
    bindStarPicker();
    const btn = document.getElementById('btn-submit-review');
    if (!btn) return;
    if (btn._rakuProductId === productId) return;
    btn._rakuProductId = productId;
    btn.onclick = async () => {
      const rating = Number(document.getElementById('review-rating')?.value) || 5;
      const customerName = document.getElementById('review-name')?.value?.trim();
      const comment = document.getElementById('review-comment')?.value?.trim();
      if (!comment) {
        showReviewMsg('Please write a few words about the product.', 'error');
        return;
      }
      btn.disabled = true;
      const data = await apiFetch(`/products/${productId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating, customerName, comment }),
      });
      btn.disabled = false;
      if (data.ok) {
        showReviewMsg(data.message, 'success');
        document.getElementById('review-comment').value = '';
        setReviewRating(5);
        if (data.status === 'approved') loadProductReviews(productId);
      } else {
        showReviewMsg(data.error || 'Could not submit', 'error');
      }
    };
  }

  async function prefillReviewName() {
    const nameInput = document.getElementById('review-name');
    const nameField = document.getElementById('review-name-field');
    if (nameInput) {
      nameInput.readOnly = false;
      nameInput.value = '';
    }
    if (nameField) nameField.style.display = '';
    try {
      const res = await fetch((window.RAKU_API_BASE || '') + '/api/auth/me', { credentials: 'same-origin' });
      const data = await res.json();
      if (nameInput && data.ok && data.user?.fullName) {
        nameInput.value = data.user.fullName;
        nameInput.readOnly = true;
        if (nameField) nameField.style.display = 'none';
      }
    } catch (_) {}
  }

  function reviewDistribution(reviews) {
    const counts = [0, 0, 0, 0, 0];
    reviews.forEach((r) => {
      const i = Math.min(5, Math.max(1, Number(r.rating))) - 1;
      counts[i]++;
    });
    return counts;
  }

  function renderReviewsSummary(reviews) {
    const panel = document.getElementById('reviews-summary-panel');
    if (!panel) return;
    const total = reviews.length;
    const avg = total ? reviews.reduce((s, r) => s + Number(r.rating), 0) / total : 0;
    const counts = reviewDistribution(reviews);
    const maxCount = Math.max(...counts, 1);
    const bars = [5, 4, 3, 2, 1]
      .map((star) => {
        const c = counts[star - 1];
        const pct = total ? Math.round((c / total) * 100) : 0;
        const w = Math.round((c / maxCount) * 100);
        return `<div class="reviews-bar-row">
          <span class="reviews-bar-label">${star} ★</span>
          <div class="reviews-bar-track"><div class="reviews-bar-fill" style="width:${w}%;"></div></div>
          <span class="reviews-bar-count">${c}</span>
        </div>`;
      })
      .join('');
    panel.innerHTML = `
      <div class="reviews-score-block">
        <div class="reviews-score-num">${avg.toFixed(1)}</div>
        <div class="reviews-score-stars">${renderStarIcons(Math.round(avg))}</div>
        <div class="reviews-score-count">${total} review${total !== 1 ? 's' : ''}</div>
      </div>
      <div class="reviews-bars-block">${bars}</div>`;
    panel.style.display = total ? '' : 'none';
  }

  function reviewCardHtml(r) {
    const initials = (r.customer_name || 'U')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const date = new Date(r.created_at).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const comment = escapeHtml(r.comment || '');
    return `<article class="review-card">
      <div class="review-head">
        <div class="reviewer-avatar">${escapeHtml(initials)}</div>
        <div class="reviewer-meta">
          <div class="reviewer-name">${escapeHtml(r.customer_name)}</div>
          <div class="reviewer-date">${date}</div>
        </div>
        ${renderStarIcons(Number(r.rating))}
      </div>
      <p class="review-text">${comment}</p>
      <span class="review-verified"><i class="ti ti-rosette-discount-check"></i> Verified buyer</span>
    </article>`;
  }

  async function loadProductReviews(productId) {
    const list = document.getElementById('product-reviews-list');
    if (!list) return;
    try {
      const data = await apiFetch(`/products/${productId}/reviews`);
      const reviews = data.reviews || [];
      const tabBtn = document.querySelector('.tab-btn[data-tab="tab-reviews"]');
      const pvRev = document.querySelector('.pv-reviews');
      const countLabel = reviews.length ? `(${reviews.length} Reviews)` : '(No reviews yet)';
      if (tabBtn) tabBtn.textContent = reviews.length ? `Reviews (${reviews.length})` : 'Reviews';
      if (pvRev) pvRev.textContent = countLabel;

      renderReviewsSummary(reviews);

      if (!reviews.length) {
        list.innerHTML = `
          <div class="reviews-empty">
            <i class="ti ti-message-circle"></i>
            <p>No reviews yet. Be the first to share your experience!</p>
          </div>`;
        return;
      }

      list.innerHTML =
        `<div class="reviews-list-header"><i class="ti ti-messages"></i> Customer reviews (${reviews.length})</div>` +
        reviews.map(reviewCardHtml).join('');
    } catch (_) {
      list.innerHTML = '';
    }
  }

  function applyBannersData(banners) {
    const list = banners || [];
    const main = list.find((b) => b.position === 'hero');
    const promos = list.filter((b) => b.position === 'promo');
    if (main) {
      const title = document.getElementById('hero-title');
      const sub = document.getElementById('hero-sub');
      const heroMain = document.getElementById('hero-main');
      if (title) title.textContent = main.title;
      if (sub) sub.textContent = main.link_url ? 'Tap Shop Now to explore this offer' : sub?.textContent;
      if (heroMain) heroMain.style.background = main.bg_gradient;
      const shopBtn = document.querySelector('#hero-grid .btn-primary');
      if (shopBtn && main.link_url) shopBtn.href = main.link_url;
    }
    const cardA = document.getElementById('hero-card-a');
    const cardB = document.getElementById('hero-card-b');
    [cardA, cardB].forEach((card, i) => {
      const b = promos[i];
      if (!card || !b) return;
      card.style.background = b.bg_gradient;
      const label = card.querySelector('.hero-card-label');
      const t = card.querySelector('.hero-card-title');
      if (label) label.textContent = 'Offer';
      if (t) t.textContent = b.title;
      card.style.cursor = 'pointer';
      card.onclick = () => {
        if (!b.link_url) return;
        let url = b.link_url;
        if (url.startsWith('#/')) url = url.slice(1);
        else if (url.startsWith('#')) url = '/' + url.slice(1);
        if (url.startsWith('/')) history.pushState(null, '', url);
        else window.location.href = url;
        if (window._rakuRestoreRoute) window._rakuRestoreRoute();
      };
    });
  }

  async function loadHeroSection() {
    try {
      const data = await apiFetch('/banners');
      applyBannersData(data.banners || []);
    } catch (_) {}
  }

  function cartItemHtml(item) {
    return `
      <div class="c-item" data-price="${item.price}" data-product-id="${item.productId}">
        <div class="c-item-thumb" style="background:${item.bgColor};">${cartThumbHtml(item)}</div>
        <div class="c-item-info">
          <div class="c-item-cat">${item.category}</div>
          <div class="c-item-name">${item.name}</div>
          <div class="c-item-price">${formatPrice(item.price)}</div>
        </div>
        <div class="c-item-right">
          <div class="c-qty">
            <button class="c-qty-btn qty-btn" type="button" data-dir="down">−</button>
            <input class="c-qty-input qty-input" type="number" value="${item.qty}" min="1" max="99" readonly>
            <button class="c-qty-btn qty-btn" type="button" data-dir="up">+</button>
          </div>
          <button class="c-item-remove-btn cart-item-remove" type="button" data-id="${item.productId}"><i class="ti ti-trash"></i></button>
        </div>
      </div>`;
  }

  async function renderCart() {
    const data = await apiFetch('/cart');
    if (!data.ok) return;

    const wrap = document.querySelector('#page-cart .cart-items-col');
    if (!wrap) return;

    const isEmpty = !data.cart.length;
    const itemQty = data.cart.reduce((s, i) => s + i.qty, 0);
    const pageCart = document.getElementById('page-cart');
    if (pageCart) pageCart.classList.toggle('cart-is-empty', isEmpty);

    const summaryCol = document.getElementById('cart-summary-col');
    if (summaryCol) summaryCol.hidden = isEmpty;

    const emptyEl = document.getElementById('cart-empty-state');
    if (emptyEl) emptyEl.hidden = !isEmpty;

    const emptyBadge = document.querySelector('.cart-empty-badge');
    if (emptyBadge) emptyBadge.textContent = fmtNum(itemQty);

    const countEl = document.getElementById('cart-item-count');
    if (countEl) {
      const label = itemQty === 1 ? 'item' : 'items';
      countEl.textContent = `${fmtNum(itemQty)} ${label}`;
    }

    wrap.querySelectorAll('.c-item').forEach((el) => el.remove());

    const header = wrap.querySelector('.cart-page-header');
    const backBtn = document.getElementById('btn-back-home');
    if (!isEmpty && header) {
      header.insertAdjacentHTML('afterend', data.cart.map(cartItemHtml).join(''));
    }

    if (backBtn) backBtn.hidden = isEmpty;

    if (data.totals && !isEmpty) {
      document.querySelectorAll('.summary-subtotal').forEach((el) => {
        el.textContent = data.totals.subtotalFormatted;
      });
      document.querySelectorAll('.summary-delivery').forEach((el) => {
        el.textContent = data.totals.deliveryFormatted;
        el.style.color = data.totals.delivery === 0 ? 'var(--green)' : 'var(--text)';
      });
      let discRow = document.getElementById('cart-discount-row');
      if (data.totals.discount > 0) {
        if (!discRow) {
          const delRow = document.querySelector('#page-cart .c-summary-row .summary-delivery')?.closest('.c-summary-row');
          if (delRow) {
            discRow = document.createElement('div');
            discRow.id = 'cart-discount-row';
            discRow.className = 'c-summary-row';
            discRow.innerHTML = '<span class="c-summary-label">Discount</span><span class="c-summary-val summary-discount" style="color:var(--green);"></span>';
            delRow.insertAdjacentElement('afterend', discRow);
          }
        }
        if (discRow) {
          discRow.hidden = false;
          discRow.querySelector('.summary-discount').textContent = '-' + data.totals.discountFormatted;
        }
      } else if (discRow) {
        discRow.hidden = true;
      }
      document.querySelectorAll('.summary-total, .c-total-val').forEach((el) => {
        el.textContent = data.totals.totalFormatted;
      });
      const couponInput = document.querySelector('.c-coupon-input');
      if (couponInput && data.totals.couponCode) couponInput.value = data.totals.couponCode;
    }

    const checkoutBtn = document.getElementById('btn-cart-checkout');
    if (checkoutBtn) checkoutBtn.disabled = isEmpty;

    bindCartEvents();
    if (backBtn && !backBtn._bound) {
      backBtn._bound = true;
      backBtn.onclick = () => window.showPage && window.showPage('home');
    }
  }

  function bindCartEvents() {
    document.querySelectorAll('#page-cart .qty-btn').forEach((btn) => {
      btn.onclick = async function () {
        const item = this.closest('.c-item');
        const id = Number(item.dataset.productId);
        const input = item.querySelector('.qty-input');
        let v = parseInt(input.value, 10) || 1;
        v = this.dataset.dir === 'up' ? Math.min(v + 1, 99) : Math.max(v - 1, 1);
        await apiFetch(`/cart/${id}`, { method: 'PATCH', body: JSON.stringify({ qty: v }) });
        await renderCart();
        await syncCartBadge();
      };
    });

    document.querySelectorAll('#page-cart .cart-item-remove').forEach((btn) => {
      btn.onclick = async function () {
        const id = Number(this.dataset.id);
        await apiFetch(`/cart/${id}`, { method: 'DELETE' });
        await renderCart();
        await syncCartBadge();
      };
    });
  }

  async function renderCheckout() {
    const data = await apiFetch('/cart');
    if (!data.ok) return;
    if (!data.cart.length) {
      if (window.showPage) window.showPage('cart');
      return;
    }

    const box = document.querySelector('#page-checkout .checkout-summary-box');
    if (!box) return;

    box.querySelectorAll('.checkout-product-row').forEach((r) => r.remove());

    const anchor = box.querySelector('.summary-title') || box;
    data.cart.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'checkout-product-row';
      row.innerHTML = `
        <div class="checkout-prod-img" style="background:${item.bgColor};">${cartThumbHtml(item)}</div>
        <span class="checkout-prod-name">${escapeHtml(item.name)} ×${item.qty}</span>
        <span class="checkout-prod-price">${formatPrice(item.price * item.qty)}</span>`;
      anchor.insertAdjacentElement('afterend', row);
    });

    if (data.totals) {
      applyTotalsToSummary(data.totals, '#page-checkout');
    }
  }

  function applyTotalsToSummary(totals, scope) {
    const root = scope ? document.querySelector(scope) : document;
    if (!root || !totals) return;
    root.querySelectorAll('.summary-subtotal').forEach((el) => {
      el.textContent = totals.subtotalFormatted;
    });
    root.querySelectorAll('.summary-delivery').forEach((el) => {
      el.textContent = totals.deliveryFormatted;
      el.style.color = totals.delivery === 0 ? 'var(--green)' : 'var(--text)';
    });
    let discRow = root.querySelector('#checkout-discount-row');
    if (totals.discount > 0) {
      if (!discRow) {
        const delRow = root.querySelector('.summary-delivery')?.closest('.c-summary-row, .checkout-summary-row');
        if (delRow) {
          discRow = document.createElement('div');
          discRow.id = 'checkout-discount-row';
          discRow.className = delRow.className || 'c-summary-row';
          discRow.innerHTML =
            '<span class="c-summary-label">Discount</span><span class="c-summary-val summary-discount" style="color:var(--green);"></span>';
          delRow.insertAdjacentElement('afterend', discRow);
        }
      }
      if (discRow) {
        discRow.hidden = false;
        discRow.querySelector('.summary-discount').textContent = '-' + totals.discountFormatted;
      }
    } else if (discRow) {
      discRow.hidden = true;
    }
    root.querySelectorAll('.summary-total, .c-total-val').forEach((el) => {
      el.textContent = totals.totalFormatted;
    });
  }

  async function updateCheckoutDistrict(district) {
    if (!district || district.includes('Select')) return;
    const data = await apiFetch('/cart/district', { method: 'POST', body: JSON.stringify({ district }) });
    if (data.ok && data.totals) {
      applyTotalsToSummary(data.totals, '#page-checkout');
      applyTotalsToSummary(data.totals, '#checkout-modal');
    }
  }

  const PAYMENT_UI = {
    bkash: {
      instruct: (num) =>
        `Pay via bKash (Send Money / Payment) to the number below:`,
      hint: 'After payment, enter your Transaction ID (TrxID) below.',
      needsTrx: true,
    },
    nagad: {
      instruct: (num) => `Pay via Nagad to the number below:`,
      hint: 'After payment, enter your Transaction ID (TrxID) below.',
      needsTrx: true,
    },
    rocket: {
      instruct: (num) => `Pay via Rocket (DBBL) to the number below:`,
      hint: 'After payment, enter your Transaction ID (TrxID) below.',
      needsTrx: true,
    },
    cod: {
      instruct: () => 'Pay in cash when your order is delivered.',
      hint: 'No advance payment required for Cash on Delivery.',
      needsTrx: false,
    },
  };

  function formatMerchantPhone(raw) {
    const d = String(raw || '').replace(/\D/g, '');
    const n = d.length >= 11 ? d.slice(-11) : d;
    if (n.length === 11) return `${n.slice(0, 5)}-${n.slice(5)}`;
    return raw || '01533-802804';
  }

  function getMerchantNumbers() {
    const unified = formatMerchantPhone('01533802804');
    return {
      bkash: unified,
      nagad: unified,
      rocket: unified,
    };
  }

  function getSelectedPaymentMethod() {
    return document.getElementById('cm-paymethod-value')?.value || 'bkash';
  }

  function updatePaymentMethodUI(method) {
    const cfg = PAYMENT_UI[method] || PAYMENT_UI.bkash;
    const numbers = getMerchantNumbers();
    const hidden = document.getElementById('cm-paymethod-value');
    if (hidden) hidden.value = method;

    document.querySelectorAll('#cm-pay-grid .cm-pay-tile').forEach((t) => {
      t.classList.toggle('selected', t.dataset.method === method);
    });

    const textEl = document.getElementById('cm-pay-instruct-text');
    const numEl = document.getElementById('cm-pay-number');
    const hintEl = document.getElementById('cm-pay-instruct-hint');
    const trxWrap = document.getElementById('cm-trx-wrap');
    const trxInput = document.getElementById('cm-trxid');

    if (textEl) textEl.textContent = cfg.instruct(numbers[method]);
    if (hintEl) hintEl.textContent = cfg.hint;

    if (cfg.needsTrx && numEl) {
      numEl.hidden = false;
      numEl.textContent = numbers[method] || numbers.bkash;
    } else if (numEl) {
      numEl.hidden = true;
    }

    if (trxWrap) {
      trxWrap.classList.toggle('hidden', !cfg.needsTrx);
    }
    if (trxInput) {
      trxInput.required = cfg.needsTrx;
      if (!cfg.needsTrx) trxInput.value = '';
    }
  }

  function collectCheckoutFormData(scope) {
    const root = document.querySelector(scope);
    if (!root) return null;
    const method =
      scope === '#checkout-modal' ? getSelectedPaymentMethod() : root.querySelector('input[name="paymethod"]:checked')?.value;
    const trxId =
      scope === '#checkout-modal' ? document.getElementById('cm-trxid')?.value?.trim() || '' : '';
    let notes = root.querySelector('[name="notes"]')?.value?.trim() || '';
    if (trxId && method && method !== 'cod') {
      notes = [notes, `TrxID (${method}): ${trxId}`].filter(Boolean).join(' | ');
    }
    return {
      name: root.querySelector('[name="name"]')?.value?.trim(),
      phone: root.querySelector('[name="phone"]')?.value?.trim(),
      address: root.querySelector('[name="address"]')?.value?.trim(),
      paymentMethod: method,
      trxId,
      notes,
    };
  }

  async function placeOrder(btn, scope) {
    const form = collectCheckoutFormData(scope);
    if (!form?.paymentMethod) {
      alert('Please select a payment method!');
      return;
    }
    if (!form.name || !form.phone || !form.address) {
      alert('Please enter name, mobile number and address!');
      return;
    }
    if (scope === '#checkout-modal') {
      const payCfg = PAYMENT_UI[form.paymentMethod];
      if (payCfg?.needsTrx && !form.trxId) {
        alert('Please enter your payment Transaction ID (TrxID)!');
        return;
      }
    }
    btn.disabled = true;
    const result = await apiFetch('/orders', { method: 'POST', body: JSON.stringify(form) });
    btn.disabled = false;
    if (!result.ok) {
      alert(result.error || 'Order failed');
      return;
    }
    if (window._rakuRenderSuccessOrder) window._rakuRenderSuccessOrder(result);
    closeCheckoutModal();
    if (window._rakuSetCartCount) window._rakuSetCartCount(0);
    await renderCart();
    await syncCartBadge();
    if (window.showPage) window.showPage('success');
  }

  function bindCheckoutModalPayments() {
    const grid = document.getElementById('cm-pay-grid');
    if (!grid || grid._rakuBound) return;
    grid._rakuBound = true;
    grid.querySelectorAll('.cm-pay-tile').forEach((tile) => {
      tile.addEventListener('click', () => updatePaymentMethodUI(tile.dataset.method));
    });
    updatePaymentMethodUI(getSelectedPaymentMethod());
  }

  async function prefillCheckoutModal() {
    try {
      const res = await fetch((window.RAKU_API_BASE || '') + '/api/auth/me', { credentials: 'same-origin' });
      const data = await res.json();
      if (!data.ok || !data.user) return;
      const u = data.user;
      const name = document.getElementById('cm-name');
      const phone = document.getElementById('cm-phone');
      if (name && !name.value) name.value = u.fullName || '';
      if (phone && !phone.value) phone.value = u.phone || '';
    } catch (_) {}
  }

  async function renderCheckoutModalSummary() {
    const data = await apiFetch('/cart');
    if (!data.ok) return;
    const itemsEl = document.getElementById('checkout-modal-items');
    if (itemsEl) {
      itemsEl.innerHTML = data.cart
        .map(
          (item) => `<div class="cm-summary-item">
            <div class="cm-summary-thumb" style="background:${item.bgColor};">${cartThumbHtml(item)}</div>
            <span class="cm-summary-name">${item.name} ×${item.qty}</span>
            <span class="cm-summary-price">${formatPrice(item.price * item.qty)}</span>
          </div>`
        )
        .join('');
    }
    if (data.totals) applyTotalsToSummary(data.totals, '#checkout-modal');
  }

  function closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('checkout-modal-open');
  }

  async function openCheckoutModal() {
    const data = await apiFetch('/cart');
    if (!data.ok || !data.cart.length) {
      alert('Your cart is empty!');
      return false;
    }
    await renderCheckoutModalSummary();
    await prefillCheckoutModal();
    const modal = document.getElementById('checkout-modal');
    if (!modal) return false;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('checkout-modal-open');
    updatePaymentMethodUI(getSelectedPaymentMethod());
    document.getElementById('cm-name')?.focus();
    return true;
  }

  async function proceedToCheckoutFromCart() {
    const data = await apiFetch('/cart');
    if (!data.ok || !data.cart.length) {
      alert('Your cart is empty. Add products before checkout.');
      return;
    }
    const opened = await openCheckoutModal();
    if (!opened && window.showPage) {
      window.showPage('checkout');
      await renderCheckout();
    }
  }

  window.openCheckoutModal = openCheckoutModal;
  window.proceedToCheckoutFromCart = proceedToCheckoutFromCart;
  window.closeCheckoutModal = closeCheckoutModal;

  function bindCheckoutModal() {
    bindCheckoutModalPayments();
    const closeBtn = document.getElementById('checkout-modal-close');
    const overlay = document.getElementById('checkout-modal');
    if (closeBtn && !closeBtn._rakuBound) {
      closeBtn._rakuBound = true;
      closeBtn.onclick = closeCheckoutModal;
    }
    if (overlay && !overlay._rakuOverlayBound) {
      overlay._rakuOverlayBound = true;
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeCheckoutModal();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay?.classList.contains('open')) closeCheckoutModal();
    });
    const btnModal = document.getElementById('btn-place-order-modal');
    if (btnModal && !btnModal._rakuBound) {
      btnModal._rakuBound = true;
      btnModal.onclick = () => placeOrder(btnModal, '#checkout-modal');
    }
  }

  function bindCheckout() {
    bindCheckoutModal();
    const btn = document.getElementById('btn-place-order');
    if (btn && !btn._rakuBound) {
      btn._rakuBound = true;
      btn.onclick = () => placeOrder(btn, '#page-checkout');
    }
  }

  function patchCheckoutForm() {
    const checkout = document.getElementById('page-checkout');
    if (!checkout) return;

    const cards = checkout.querySelectorAll('.section-card');
    cards.forEach((card) => {
      const title = card.querySelector('.section-card-title');
      if (!title) return;
      const text = title.textContent;
      if (text.includes('Delivery')) {
        const fields = card.querySelectorAll('input.form-input, textarea.form-input');
        const names = ['name', 'phone', 'address'];
        fields.forEach((f, idx) => {
          if (names[idx]) f.name = names[idx];
        });
      }
      if (text.includes('Order Notes')) {
        const ta = card.querySelector('textarea');
        if (ta) ta.name = 'notes';
      }
    });
  }

  function hookNavigation() {
    const btnCartCheckout = document.getElementById('btn-cart-checkout');
    if (btnCartCheckout && !btnCartCheckout._rakuBound) {
      btnCartCheckout._rakuBound = true;
      btnCartCheckout.addEventListener('click', async (e) => {
        e.preventDefault();
        if (btnCartCheckout.disabled) {
          alert('Your cart is empty. Add products first.');
          return;
        }
        try {
          await proceedToCheckoutFromCart();
        } catch (err) {
          console.error('Checkout failed', err);
          alert('Could not open checkout. Please try again.');
        }
      });
    }

    const navWish = document.getElementById('nav-wishlist-btn');
    if (navWish && !navWish._rakuBound) {
      navWish._rakuBound = true;
      navWish.addEventListener('click', async (e) => {
        e.preventDefault();
        await openWishlist();
      });
    }

    document.querySelectorAll('.nav-cart-btn').forEach((btn) => {
      if (btn._rakuNavBound) return;
      btn._rakuNavBound = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (window._rakuOpenCart) window._rakuOpenCart();
        else if (window.showPage) {
          window.showPage('cart');
          if (window.renderCart) void window.renderCart();
        } else {
          window.location.href = '/cart';
        }
      });
    });

    const btnWishShop = document.getElementById('btn-wishlist-shop');
    if (btnWishShop && !btnWishShop._rakuBound) {
      btnWishShop._rakuBound = true;
      btnWishShop.addEventListener('click', () => {
        if (window.showPage) window.showPage('home');
      });
    }

  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDatePretty(d) {
    try {
      return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return d || '';
    }
  }

  function openTrackOrderModal(prefill) {
    const modal = document.getElementById('track-modal');
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('trk-open');
    const input = document.getElementById('trk-order-id');
    const result = document.getElementById('trk-result');
    if (result) result.hidden = true;
    if (input) {
      if (prefill) input.value = String(prefill).trim();
      input.focus();
      input.select();
    }
  }

  function closeTrackOrderModal() {
    const modal = document.getElementById('track-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('trk-open');
  }

  async function trackOrderById(orderNumber) {
    const id = String(orderNumber || '').trim();
    if (!id) return { ok: false, error: 'Enter your Order ID' };
    return await apiFetch(`/orders/track?orderNumber=${encodeURIComponent(id)}`);
  }

  function renderTrackResult(data) {
    const box = document.getElementById('trk-result');
    if (!box) return;
    if (!data?.ok || !data.order) {
      box.hidden = false;
      box.innerHTML = `<div class="trk-r-body" style="color:var(--accent-dark);font-weight:800;">${escapeHtml(
        data?.error || 'Order not found'
      )}</div>`;
      return;
    }
    const o = data.order;
    const status = String(o.status || 'pending');
    const items = o.items || [];
    box.hidden = false;
    box.innerHTML = `
      <div class="trk-r-head">
        <div class="trk-r-title">Order <span style="color:var(--primary);">#${escapeHtml(o.orderNumber)}</span></div>
        <div class="trk-status ${escapeHtml(status)}">${escapeHtml(status)}</div>
      </div>
      <div class="trk-r-body">
        <div class="trk-meta">
          <div class="m"><b>Name:</b> ${escapeHtml(o.customerName || '—')}</div>
          <div class="m"><b>Date:</b> ${escapeHtml(formatDatePretty(o.createdAt))}</div>
          <div class="m"><b>District:</b> ${escapeHtml(o.district || '—')}</div>
          <div class="m"><b>Payment:</b> ${escapeHtml(o.paymentMethod || '—')}</div>
        </div>
        <div class="trk-items">
          ${items
            .map(
              (it) =>
                `<div class="trk-item"><span>${escapeHtml(it.product_name)} <b>×${escapeHtml(
                  it.quantity
                )}</b></span><span><b>${formatPrice(it.line_total)}</b></span></div>`
            )
            .join('')}
          <div class="trk-total"><span>Total</span><span>${escapeHtml(o.totalFormatted || formatPrice(o.total))}</span></div>
        </div>
      </div>
    `;
  }

  function bindTrackOrderModal() {
    const modal = document.getElementById('track-modal');
    if (!modal || modal._rakuBound) return;
    modal._rakuBound = true;

    const closeBtn = document.getElementById('trk-close');
    const submit = document.getElementById('trk-submit');
    const input = document.getElementById('trk-order-id');

    if (closeBtn) closeBtn.onclick = closeTrackOrderModal;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeTrackOrderModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeTrackOrderModal();
    });

    async function run() {
      if (!submit) return;
      submit.disabled = true;
      const res = await trackOrderById(input?.value);
      submit.disabled = false;
      renderTrackResult(res);
    }
    if (submit) submit.onclick = run;
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') run();
      });
    }

    const btnSuccessTrack = document.getElementById('btn-track-order');
    if (btnSuccessTrack && !btnSuccessTrack._rakuBound) {
      btnSuccessTrack._rakuBound = true;
      btnSuccessTrack.addEventListener('click', (e) => {
        e.preventDefault();
        const txt = document.querySelector('.order-id-box')?.textContent || '';
        const m = txt.match(/RKS-\\d{4}-\\d{6,}/i);
        window.location.href = m ? `/track?id=${encodeURIComponent(m[0])}` : '/track';
      });
    }
  }

  window._rakuOpenTrackOrder = () => {
    window.location.href = '/track';
  };

  function applySettingsData(settings) {
    if (!settings) return;
    const ann = document.querySelector('.announcement span');
    if (ann && settings.announcement_text) ann.innerHTML = settings.announcement_text;
    const badge = document.getElementById('hero-badge');
    if (badge && settings.feature_flash_sale === '0') badge.style.display = 'none';
    window._rakuStoreSettings = settings;
    document.dispatchEvent(new CustomEvent('raku:settings-loaded', { detail: settings }));
  }

  const homeAutoScrollTimers = new Map();

  function stopHomeScrollAuto(trackId) {
    const t = homeAutoScrollTimers.get(trackId);
    if (t) {
      clearInterval(t);
      homeAutoScrollTimers.delete(trackId);
    }
  }

  function initHomeScrollAuto(trackId, intervalMs = 3200) {
    stopHomeScrollAuto(trackId);
    const track = document.getElementById(trackId);
    if (!track) return;

    const cards = () => track.querySelectorAll('.product-card, .home-review-card');
    if (cards().length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let paused = false;
    if (!track._rakuAutoScrollBound) {
      track._rakuAutoScrollBound = true;
      track.addEventListener('mouseenter', () => {
        paused = true;
      });
      track.addEventListener('mouseleave', () => {
        paused = false;
      });
      track.addEventListener(
        'touchstart',
        () => {
          paused = true;
        },
        { passive: true }
      );
      track.addEventListener(
        'touchend',
        () => {
          setTimeout(() => {
            paused = false;
          }, 4000);
        },
        { passive: true }
      );
    }

    function scrollStep() {
      if (paused) return;
      const list = cards();
      if (list.length < 2) return;

      const gap = Number.parseFloat(getComputedStyle(track).gap) || 16;
      const stepPx = list[0].offsetWidth + gap;
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (maxScroll <= 4) return;

      const next = track.scrollLeft + stepPx;
      if (next >= maxScroll - 4) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        track.scrollTo({ left: next, behavior: 'smooth' });
      }
    }

    const timer = setInterval(scrollStep, intervalMs);
    homeAutoScrollTimers.set(trackId, timer);
  }

  function initAllHomeScrollAuto() {
    initHomeScrollAuto('track-best-selling', 3200);
    initHomeScrollAuto('track-new-arrivals', 3600);
    initHomeScrollAuto('track-customer-reviews', 3800);
  }

  window._rakuInitHomeScrollAuto = initHomeScrollAuto;

  function paintHomeScrollTrack(trackId, list) {
    const track = document.getElementById(trackId);
    if (!track) return;
    stopHomeScrollAuto(trackId);
    if (!list?.length) {
      track.innerHTML = '<p class="home-scroll-empty">No products in this section yet.</p>';
      return;
    }
    track.innerHTML = list.map(productCardHtml).join('');
  }

  function bindHomeSeeAll(btnId, collectionSlug) {
    const seeAll = document.getElementById(btnId);
    if (!seeAll || seeAll._rakuBound) return;
    seeAll._rakuBound = true;
    seeAll.onclick = (e) => {
      e.preventDefault();
      if (collectionSlug && window.openCategory) {
        window.openCategory(collectionSlug);
        return;
      }
      if (window.openCategory) window.openCategory('all');
      else if (window.showPage) window.showPage('home');
    };
  }

  function paintHomeProductSections(data) {
    const best = data.bestSelling || [];
    const newest = data.newArrivals || [];
    const merged = [];
    const seen = new Set();
    [...best, ...newest].forEach((p) => {
      if (p?.id && !seen.has(p.id)) {
        seen.add(p.id);
        merged.push(p);
      }
    });
    products = merged;
    paintHomeScrollTrack('track-best-selling', best);
    paintHomeScrollTrack('track-new-arrivals', newest);
    bindProductGridEvents();
    bindHomeSeeAll('see-all-best-selling', 'best-selling');
    bindHomeSeeAll('see-all-new-arrivals', 'new-arrivals');
    requestAnimationFrame(() => {
      setTimeout(initAllHomeScrollAuto, 150);
    });
  }

  async function adminCanBypassMaintenance() {
    try {
      const token =
        localStorage.getItem('rakushopbd_admin_token') ||
        sessionStorage.getItem('rakushopbd_admin_token') ||
        '';
      const headers = {};
      if (token) headers['X-Admin-Token'] = token;
      const res = await fetch((window.RAKU_API_BASE || '') + '/api/admin/me', {
        credentials: 'same-origin',
        headers,
      });
      const data = await res.json();
      return Boolean(data.ok && data.admin);
    } catch (_) {
      return false;
    }
  }

  async function applyBootstrap(boot) {
    if (!boot?.ok) return false;
    if (boot.maintenance && !(await adminCanBypassMaintenance())) {
      if (window.showMaintenancePage) window.showMaintenancePage(boot.settings);
      else location.reload();
      return true;
    }
    applySettingsData(boot.settings);
    applyBannersData(boot.banners || []);
    paintHomeProductSections(bootHomeSections(boot));
    document.dispatchEvent(new CustomEvent('raku:bootstrap', { detail: boot }));
    return true;
  }

  async function loadStoreSettings() {
    try {
      const data = await apiFetch('/settings');
      if (!data.ok) return;
      if (data.maintenance && !(await adminCanBypassMaintenance())) {
        if (window.showMaintenancePage) window.showMaintenancePage(data.settings);
        else location.reload();
        return;
      }
      applySettingsData(data.settings);
    } catch (_) {}
  }

  function bindCouponApply() {
    const btn = document.querySelector('.c-coupon-btn');
    const input = document.querySelector('.c-coupon-input');
    if (!btn || btn._rakuBound) return;
    btn._rakuBound = true;
    btn.onclick = async () => {
      const code = input?.value?.trim();
      if (!code) return alert('Enter a coupon code');
      const data = await apiFetch('/cart/coupon', { method: 'POST', body: JSON.stringify({ code }) });
      if (data.ok) {
        await renderCart();
        alert(`Coupon ${data.code} applied!`);
      } else {
        alert(data.error || 'Invalid coupon');
      }
    };
  }

  document.addEventListener('raku:ready', async () => {
    patchCheckoutForm();
    bindCheckout();
    bindTrackOrderModal();
    bindCouponApply();
    hookNavigation();

    const boot = window.__RAKU_BOOTSTRAP;
    const pathParts = (location.pathname || '/').split('/').filter(Boolean);
    const isHome = pathParts.length === 0;

    let blocked = false;
    if (boot) blocked = await applyBootstrap(boot);
    else {
      try {
        blocked = await applyBootstrap(await apiFetch('/bootstrap'));
      } catch (_) {
        await loadStoreSettings();
        await Promise.all([loadHeroSection(), refreshHomeProductSections(null)]);
      }
    }
    if (blocked) return;

    if (isHome) {
      await refreshHomeProductSections(boot || window.__RAKU_BOOTSTRAP);
    }

    if (isHome && window.showPage) window.showPage('home', { skipUrl: true });

    bindCategoryFilterEvents();

    const onCart = /^\/cart\/?$/.test(location.pathname);
    const onCheckout = /^\/checkout\/?$/.test(location.pathname);
    const sessionTasks = [syncCartBadge(), syncWishlist()];
    if (onCart) sessionTasks.push(renderCart());
    if (onCheckout) sessionTasks.push(renderCheckout());
    void Promise.all(sessionTasks);

    if (window.requestIdleCallback) {
      requestIdleCallback(() => prefillReviewName(), { timeout: 3000 });
    } else {
      setTimeout(() => prefillReviewName(), 200);
    }

    if (window._rakuRestoreRoute) {
      await window._rakuRestoreRoute();
    } else if (!isHome && window.showPage) {
      window.showPage('home');
    }
  });
})();
