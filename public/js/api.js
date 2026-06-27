/**
 * RakuShopBD — Backend API integration (MySQL + session cart)
 */
(function () {
  const API = (window.RAKU_API_BASE || '') + '/api';
  let products = [];
  let currentProduct = null;
  let wishlistIds = new Set();
  let cartProductIds = new Set();

  function fmtNum(n) {
    return Number(n).toLocaleString('en-US');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPrice(amount) {
    return '৳' + fmtNum(Math.round(amount));
  }

  function trackFacebookConversion(event, params) {
    if (typeof window.rakuTrackFacebook === 'function') {
      window.rakuTrackFacebook(event, params);
    }
  }

  function stars(rating) {
    const r = Math.round(Number(rating) || 0);
    return '★'.repeat(Math.min(5, r)) + '☆'.repeat(Math.max(0, 5 - r));
  }

  function tagHtml(p) {
    const pct = discountPercent(p);
    const discountBadge = pct
      ? `<span class="prod-discount">-${fmtNum(pct)}%</span>`
      : '';
    if (discountBadge) return discountBadge;
    if (p.tag_type === 'bestseller' && p.tag_text) {
      return `<span class="prod-tag" style="background:#EAF3DE;color:#3B6D11;">${p.tag_text}</span>`;
    }
    if (p.tag_type === 'hot' && p.tag_text) {
      return `<span class="prod-tag" style="background:#FAEEDA;color:#854F0B;">${p.tag_text}</span>`;
    }
    if (p.tag_type === 'new' && p.tag_text) {
      return `<span class="prod-tag" style="background:#E8F3EA;color:#2D6B32;">${p.tag_text}</span>`;
    }
    return '';
  }

  function discountPercent(p) {
    const pct = Number(p.discount_percent);
    if (Number.isFinite(pct) && pct > 0 && pct < 100) return Math.round(pct);
    return null;
  }

  function productImageAlt(p) {
    const alt = (p.image_alt || p.name_bn || p.name_en || 'Product').trim();
    return escapeHtml(alt || 'Product');
  }

  function productMediaHtml(p) {
    if (p.image_url) {
      const alt = productImageAlt(p);
      const attrs = productImageAttrs(p.image_url, {
        widths: [320, 480, 640],
        sizes: window.rakuImageSizes ? window.rakuImageSizes.productCard() : '(max-width: 480px) 46vw, 240px',
        srcWidth: 480,
      });
      const src = attrs.src.replace(/"/g, '&quot;');
      const srcset = attrs.srcset ? ` srcset="${attrs.srcset.replace(/"/g, '&quot;')}" sizes="${attrs.sizes.replace(/"/g, '&quot;')}"` : '';
      const icon = normalizeIconClass(p.icon);
      const color = p.icon_color || '#2D6B32';
      return `<img src="${src}"${srcset} alt="${alt}" width="240" height="240" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:contain;padding:8px;border-radius:inherit;" onerror="this.hidden=true;this.nextElementSibling.hidden=false;"><i class="${icon}" style="color:${color};" hidden></i>`;
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
    const icon = normalizeIconClass(item.icon || 'ti-package');
    const color = item.iconColor || '#2D6B32';
    if (item.imageUrl) {
      const alt = String(item.name || '').replace(/"/g, '&quot;');
      const src = String(item.imageUrl).replace(/"/g, '&quot;');
      return `<img class="cart-thumb-img" src="${src}" alt="${alt}" width="88" height="88" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false;"><i class="${icon} ${cls || ''}" style="color:${color};" hidden></i>`;
    }
    return `<i class="${icon} ${cls || ''}" style="color:${color};"></i>`;
  }

  function productStockMax(p) {
    if (!p || !Object.prototype.hasOwnProperty.call(p, 'stock')) return 99;
    const s = Number(p.stock);
    if (!Number.isFinite(s) || s <= 0) return 1;
    return Math.min(99, s);
  }

  function resetProductPageQty() {
    const input = document.querySelector('#page-product .qty-input');
    if (input) input.value = '1';
    paintProductRewardPoints(1);
  }

  function getProductPageQty(p) {
    const ref = p || currentProduct;
    const input = document.querySelector('#page-product .qty-input');
    const max = productStockMax(ref);
    let v = parseInt(input?.value, 10) || 1;
    v = Math.max(1, Math.min(max, v));
    if (input) input.value = String(v);
    return v;
  }

  window._rakuProductStockMax = () => productStockMax(currentProduct);
  window._rakuGetProductPageQty = () => getProductPageQty(currentProduct);

  function productIsOutOfStock(p) {
    if (!p || !Object.prototype.hasOwnProperty.call(p, 'stock')) return false;
    const n = Number(p.stock);
    return Number.isFinite(n) ? n <= 0 : true;
  }

  function productInStock(p) {
    return !productIsOutOfStock(p);
  }

  function productCardActionBtn(p) {
    if (!productIsOutOfStock(p)) {
      return `<button class="add-cart-btn" type="button" data-id="${p.id}"><i class="ti ti-shopping-cart-plus"></i> Add to Cart</button>`;
    }
    return `<button class="preorder-btn" type="button" data-id="${p.id}"><i class="ti ti-clock-hour-4"></i> Pre-order</button>`;
  }

  function openPreOrderFlow(p) {
    if (!p) return;
    const payload = {
      name: p.name_bn || 'Product',
      sku: String(p.sku || '').trim() || `SKU-${p.id}`,
      productId: p.id,
    };
    if (window._rakuPrefillContactPreOrder) window._rakuPrefillContactPreOrder(payload);
    if (window.showPage) window.showPage('contact');
    (window.rakuScrollToTop || (() => window.scrollTo(0, 0)))();
  }

  window.productInStock = productInStock;
  window.openPreOrderFlow = openPreOrderFlow;

  function productCardHtml(p, opts = {}) {
    const pct = discountPercent(p);
    const oldVal =
      pct && Number(p.price) > 0
        ? p.old_price || Math.round(Number(p.price) / (1 - pct / 100))
        : null;
    const oldPrice = oldVal ? `<span class="prod-old">${formatPrice(oldVal)}</span>` : '';
    return `
      <div class="product-card" data-cat="${escapeHtml(p.category_slug || '')}" data-id="${p.id}" data-price="${p.price}">
        <div class="prod-img" style="background:${p.bg_color};">
          ${tagHtml(p)}
          <button class="prod-wish" type="button" data-id="${p.id}" aria-label="Add to wishlist"><i class="ti ti-heart"></i></button>
          ${productMediaHtml(p)}
        </div>
        <div class="prod-info">
          <div class="prod-category">${escapeHtml(p.category_name || '')}</div>
          <div class="prod-name">${escapeHtml(p.name_bn || '')}</div>
          <div class="prod-rating"><span class="stars">${stars(p.rating)}</span><span class="rating-count">(${fmtNum(p.review_count)})</span></div>
          <div class="prod-foot">
            <div><span class="prod-price">${formatPrice(p.price)}</span>${oldPrice}</div>
            ${productCardActionBtn(p)}
          </div>
        </div>
      </div>`;
  }

  async function apiFetch(url, options) {
    try {
      const res = await fetch(API + url, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        ...options,
      });
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        return { ok: false, error: res.ok ? 'Invalid response' : `Request failed (${res.status})` };
      }
      if (!res.ok && data.ok !== false) {
        data.ok = false;
        data.error = data.error || `Request failed (${res.status})`;
      }
      return data;
    } catch {
      return { ok: false, error: 'Network error' };
    }
  }

  window._rakuApiFetch = apiFetch;
  window.formatPrice = formatPrice;
  window.discountPercent = discountPercent;
  window.productImageSrc = productImageSrc;
  window.productMediaHtml = productMediaHtml;

  const productDetailCache = new Map();
  const productFetchInflight = new Map();

  function mergeProductRecord(p) {
    if (!p?.id) return;
    const prev = productDetailCache.get(p.id);
    if (prev) {
      if (!p.image_url && prev.image_url) p.image_url = prev.image_url;
      if (!p.imageUrl && prev.imageUrl) p.imageUrl = prev.imageUrl;
      if ((!p.gallery_urls || !p.gallery_urls.length) && prev.gallery_urls?.length) {
        p.gallery_urls = prev.gallery_urls;
      }
      if ((!p.gallery || !p.gallery.length) && prev.gallery?.length) {
        p.gallery = prev.gallery;
      }
    }
    productDetailCache.set(p.id, p);
    const idx = products.findIndex((x) => x.id === p.id);
    if (idx >= 0) products[idx] = p;
    else products.push(p);
  }

  function productGalleryFromApi(p) {
    if (Array.isArray(p?.gallery_urls)) return p.gallery_urls.filter(Boolean);
    if (Array.isArray(p?.gallery)) {
      return p.gallery
        .map((row) => row?.image_url || row?.imageUrl)
        .filter(Boolean);
    }
    return null;
  }

  async function fetchProductDetail(ref, opts = {}) {
    const raw = String(ref ?? '').trim();
    if (!raw) return null;
    const byId = /^\d+$/.test(raw);
    const cacheKey = byId ? Number(raw) : `slug:${raw}`;
    const bypassCache = Boolean(opts.bypassCache);
    if (!bypassCache && productDetailCache.has(cacheKey)) {
      const cached = productDetailCache.get(cacheKey);
      const gallery = productGalleryFromApi(cached);
      if (gallery !== null && gallery.length > 1) return cached;
    }
    if (!bypassCache && productFetchInflight.has(cacheKey)) return productFetchInflight.get(cacheKey);
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

  async function fetchHomeSectionsFallback(limit = 24) {
    const lim = Math.min(48, Math.max(4, Number(limit) || 24));
    try {
      const data = await apiFetch(`/products/home-sections?limit=${lim}`);
      if (data?.ok && (data.bestSelling?.length || data.newArrivals?.length)) return data;
    } catch (e) {
      console.warn('Home sections unavailable', e);
    }
    try {
      const [bestRes, newRes] = await Promise.all([
        apiFetch(`/products?sort=best-selling&limit=${lim}`),
        apiFetch(`/products?sort=new-arrivals&limit=${lim}`),
      ]);
      const bestSelling = bestRes?.ok ? bestRes.products || [] : [];
      const newArrivals = newRes?.ok ? newRes.products || [] : [];
      if (bestSelling.length || newArrivals.length) {
        return { ok: true, bestSelling, newArrivals };
      }
    } catch (e) {
      console.warn('Home sections fallback unavailable', e);
    }
    return null;
  }

  function homeTrackNeedsPaint(trackId) {
    const track = document.getElementById(trackId);
    if (!track) return false;
    if (track.querySelector('.product-card--skeleton')) return true;
    return !track.querySelector('.product-card:not(.product-card--skeleton)');
  }

  function homePageNeedsProductPaint() {
    return homeTrackNeedsPaint('track-best-selling') || homeTrackNeedsPaint('track-new-arrivals');
  }

  async function refreshHomeProductSections(boot) {
    if (!document.getElementById('track-new-arrivals')) return;
    const needsPaint = homePageNeedsProductPaint();

    if (boot?.ok && (boot.bestSelling?.length || boot.newArrivals?.length)) {
      paintHomeProductSections(bootHomeSections(boot));
      if (!needsPaint || !homePageNeedsProductPaint()) return;
    }

    const data = await fetchHomeSectionsFallback(24);
    if (data?.bestSelling?.length || data?.newArrivals?.length) {
      paintHomeProductSections(data);
      return;
    }
    if (boot?.ok) {
      const fallback = bootHomeSections(boot);
      if (fallback.bestSelling?.length || fallback.newArrivals?.length) {
        paintHomeProductSections(fallback);
      }
    }
  }

  let cartRequestSeq = 0;

  function applyCartState(data) {
    if (!data?.ok) return false;
    const itemQty = (data.cart || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
    applyCartBadgeCount(data.count ?? itemQty);
    applyCartProductIds(data.cart);
    return true;
  }

  async function loadCartState(options = {}) {
    if (options.data?.ok) {
      cartRequestSeq++;
      applyCartState(options.data);
      return options.data;
    }
    const seq = ++cartRequestSeq;
    const data = await apiFetch('/cart');
    if (seq !== cartRequestSeq) return null;
    if (!data.ok) return data;
    applyCartState(data);
    return data;
  }

  async function syncCartBadge() {
    try {
      await loadCartState();
    } catch (_) {}
  }

  function applyCartProductIds(cart) {
    cartProductIds = new Set((cart || []).map((i) => Number(i.productId)));
    applyCartButtonsUI();
    updateProductPageCartBtn();
  }

  function applyCartPaint(data) {
    if (!data?.ok) return false;
    cartRequestSeq++;
    applyCartState(data);
    paintCartPage(data);
    return true;
  }

  function openCartPage(cartData) {
    if (cartData?.ok) window._rakuPendingCartPaint = cartData;
    if (window.showPage) window.showPage('cart');
    else window.location.href = '/cart';
  }

  function applyCartButtonsUI() {
    document.querySelectorAll('.add-cart-btn[data-id]').forEach((btn) => {
      const id = Number(btn.dataset.id);
      const inCart = cartProductIds.has(id);
      btn.classList.toggle('in-cart', inCart);
      btn.disabled = false;
      if (inCart) {
        btn.innerHTML = '<i class="ti ti-shopping-cart"></i> View Cart';
      } else if (!btn.classList.contains('added')) {
        btn.innerHTML = '<i class="ti ti-shopping-cart-plus"></i> Add to Cart';
      }
    });
  }

  function updateProductPageCartBtn() {
    const btn = document.getElementById('btn-add-to-cart-main');
    if (!btn || !currentProduct) return;
    if (!productInStock(currentProduct)) return;
    const inCart = cartProductIds.has(Number(currentProduct.id));
    btn.disabled = false;
    btn.classList.toggle('in-cart', inCart);
    if (inCart) {
      btn.innerHTML = '<i class="ti ti-shopping-cart"></i> View Cart';
    } else {
      btn.innerHTML = '<i class="ti ti-shopping-cart-plus"></i> Add to Cart';
    }
  }

  function applyCartBadgeCount(count) {
    const n = Math.max(0, Number(count) || 0);
    if (window._rakuSetCartCount) {
      window._rakuSetCartCount(n);
      return;
    }
    document.querySelectorAll('.cart-badge').forEach((b) => {
      b.textContent = String(n);
      b.hidden = n === 0;
    });
  }

  window._rakuApplyCartBadgeCount = applyCartBadgeCount;

  async function syncWishlist() {
    try {
      const data = await apiFetch('/wishlist');
      if (!data.ok) return;
      wishlistIds = new Set(data.ids || []);
      if (window._rakuSetWishCount) {
        window._rakuSetWishCount(data.count);
      } else {
        document.querySelectorAll('.wish-badge').forEach((b) => {
          b.textContent = data.count;
          b.hidden = !data.count;
        });
      }
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
    document.dispatchEvent(new CustomEvent('raku:behavior-changed'));
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
        const data = await addToCart(Number(btn.dataset.id));
        if (data.ok) {
          flashBtn(btn, '<i class="ti ti-check"></i> Added', '<i class="ti ti-shopping-cart-plus"></i> Add to Cart');
        }
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
    (window.rakuScrollToTop || (() => window.scrollTo(0, 0)))();
  }

  window.openWishlist = openWishlist;

  async function addToCart(productId, qty = 1) {
    const pid = Number(productId);
    if (cartProductIds.has(pid)) {
      return { ok: false, alreadyInCart: true, error: 'This product is already in your cart' };
    }
    cartRequestSeq++;
    const data = await apiFetch('/cart/add', {
      method: 'POST',
      body: JSON.stringify({ productId: pid, qty }),
    });
    if (data.ok || data.alreadyInCart) {
      applyCartState(data);
      document.dispatchEvent(new CustomEvent('raku:behavior-changed'));
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
        const id = Number(this.dataset.id);
        if (cartProductIds.has(id)) {
          openCartPage();
          return;
        }
        const data = await addToCart(id);
        if (data.alreadyInCart) {
          openCartPage(data);
          return;
        }
        if (data.ok) {
          flashBtn(
            this,
            '<i class="ti ti-check"></i> Added',
            '<i class="ti ti-shopping-cart"></i> View Cart'
          );
          applyCartButtonsUI();
        }
      };
    });

    document.querySelectorAll('.preorder-btn[data-id]').forEach((btn) => {
      btn.onclick = async function (e) {
        e.stopPropagation();
        const id = Number(this.dataset.id);
        let p = productDetailCache.get(id) || products.find((x) => x.id === id);
        if (!p || !('stock' in p)) p = await fetchProductDetail(id);
        if (p) openPreOrderFlow(p);
      };
    });

    document
      .querySelectorAll(
        '#page-home .product-card[data-id], #page-home .today-deals-card[data-id], #page-category .product-card[data-id], #related-product-grid .product-card[data-id]'
      )
      .forEach((card) => {
        const pid = Number(card.dataset.id);
        card.addEventListener('mouseenter', () => prefetchProduct(pid), { passive: true });
        card.onclick = function (e) {
          if (e.target.closest('.add-cart-btn, .preorder-btn, .prod-wish')) return;
          void openProduct(pid);
        };
      });

    applyCartButtonsUI();
    queueSyncAllHomeScrollCardWidths();
  }

  window._rakuBindProductGrid = bindProductGridEvents;

  const HOME_PRODUCT_TRACK_IDS = [
    'track-best-selling',
    'track-new-arrivals',
    'track-recommended-for-you',
  ];

  const HOME_CAROUSEL_TRACKS = [
    { id: 'track-customer-reviews', cardSel: '.home-review-card', minWidth: 140 },
    { id: 'track-messenger-reviews', cardSel: '.home-messenger-card', minWidth: 220 },
  ];

  function visibleHomeScrollCards(trackId) {
    if (trackId === 'track-recommended-for-you') {
      return window.matchMedia('(max-width: 768px)').matches ? 2 : 4;
    }
    if (window.matchMedia('(max-width: 768px)').matches) return 2;
    if (window.matchMedia('(max-width: 1024px)').matches) return 3;
    return 4;
  }

  function visibleHomeCarouselCards() {
    if (window.matchMedia('(max-width: 768px)').matches) return 2;
    if (window.matchMedia('(max-width: 1024px)').matches) return 2;
    return 3;
  }

  function syncHomeCarouselCardWidths(trackId, cardSelector, minWidth = 140) {
    const track = document.getElementById(trackId);
    const measured = measureTrackCards(track, cardSelector, visibleHomeCarouselCards, minWidth);
    if (measured) applyMeasuredWidths(measured);
  }

  function syncAllHomeCarouselCardWidths() {
    const measurements = [];
    HOME_CAROUSEL_TRACKS.forEach(({ id, cardSel, minWidth }) => {
      const measured = measureTrackCards(document.getElementById(id), cardSel, visibleHomeCarouselCards, minWidth);
      if (measured) measurements.push(measured);
    });
    measurements.forEach(applyMeasuredWidths);
  }

  const homeTrackWidthCache = new Map();

  function measureTrackCards(track, cardSelector, visibleCountFn, minWidth) {
    if (!track) return null;
    const cards = track.querySelectorAll(cardSelector);
    if (!cards.length) return null;

    const styles = getComputedStyle(track);
    const gapRaw = styles.columnGap && styles.columnGap !== 'normal' ? styles.columnGap : styles.gap;
    const gap = Number.parseFloat(gapRaw) || 16;
    const trackWidth = track.getBoundingClientRect().width;
    if (trackWidth < 40) return null;

    const visible = visibleCountFn();
    const width = Math.max(minWidth, Math.floor((trackWidth - gap * (visible - 1)) / visible));
    return { track, cards, width };
  }

  function applyMeasuredWidths({ track, cards, width }) {
    const key = track.id || String(track);
    if (homeTrackWidthCache.get(key) === width) return;
    homeTrackWidthCache.set(key, width);
    cards.forEach((card) => {
      card.style.flex = '0 0 auto';
      card.style.width = `${width}px`;
      card.style.minWidth = `${width}px`;
      card.style.maxWidth = `${width}px`;
    });
  }

  function syncHomeScrollCardWidths(trackId) {
    const measured = measureTrackCards(
      document.getElementById(trackId),
      '.product-card',
      () => visibleHomeScrollCards(trackId),
      120
    );
    if (measured) applyMeasuredWidths(measured);
  }

  function syncAllHomeScrollCardWidths() {
    const measurements = [];
    HOME_PRODUCT_TRACK_IDS.forEach((trackId) => {
      const measured = measureTrackCards(
        document.getElementById(trackId),
        '.product-card',
        () => visibleHomeScrollCards(trackId),
        120
      );
      if (measured) measurements.push(measured);
    });
    HOME_CAROUSEL_TRACKS.forEach(({ id, cardSel, minWidth }) => {
      const measured = measureTrackCards(document.getElementById(id), cardSel, visibleHomeCarouselCards, minWidth);
      if (measured) measurements.push(measured);
    });
    measurements.forEach(applyMeasuredWidths);
  }

  let syncHomeWidthsQueued = false;
  function queueSyncAllHomeScrollCardWidths() {
    if (syncHomeWidthsQueued) return;
    syncHomeWidthsQueued = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        syncHomeWidthsQueued = false;
        syncAllHomeScrollCardWidths();
      });
    });
  }

  function queueSyncHomeScrollTrack(trackId) {
    const section =
      document.getElementById(trackId)?.closest('.home-product-section, .home-customer-reviews, .home-messenger-reviews, .trust-bar-wrap') ||
      document.getElementById(trackId);
    const run = () => syncHomeScrollCardWidths(trackId);
    if (window.rakuWhenVisible && section) {
      window.rakuWhenVisible(section, run, { rootMargin: '240px' });
    } else {
      run();
    }
  }

  let homeScrollResizeBound = false;
  function bindHomeScrollResize() {
    bindAllMobileHorizontalTrackScrollFixes();
    if (homeScrollResizeBound) return;
    homeScrollResizeBound = true;
    let timer;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        homeTrackWidthCache.clear();
        queueSyncAllHomeScrollCardWidths();
        if (window.rakuScheduleIdle) {
          window.rakuScheduleIdle(() => initAllHomeScrollAuto(), { timeout: 1200 });
        } else {
          initAllHomeScrollAuto();
        }
      }, 120);
    });
    if (typeof ResizeObserver === 'function') {
      let roTimer;
      const ro = new ResizeObserver(() => {
        clearTimeout(roTimer);
        roTimer = setTimeout(queueSyncAllHomeScrollCardWidths, 80);
      });
      [...HOME_PRODUCT_TRACK_IDS, ...HOME_CAROUSEL_TRACKS.map((t) => t.id)].forEach((id) => {
        const el = document.getElementById(id);
        if (el) ro.observe(el);
      });
    }
  }

  window._rakuSyncHomeScrollCardWidths = queueSyncAllHomeScrollCardWidths;

  const CATEGORY_LABELS = {
    all: 'All Products',
    'best-selling': 'Best Selling Products',
    'new-arrivals': 'New Arrivals',
    'today-deals': 'Today Deals',
  };

  const HOME_COLLECTIONS = {
    all: { title: 'All Products', api: '/products?category=all&limit=200' },
    'best-selling': {
      title: 'Best Selling Products',
      api: '/collections/best-selling?limit=100',
      preserveOrder: true,
    },
    'new-arrivals': { title: 'New Arrivals', api: '/collections/new-arrivals?limit=100', preserveOrder: true },
    'today-deals': { title: 'Today Deals', api: '/today-deals', preserveOrder: true },
  };

  const HOME_COLLECTION_SLUGS = new Set(Object.keys(HOME_COLLECTIONS));

  /** Admin category slugs that should load a homepage collection (e.g. new-arrival → new-arrivals). */
  const HOME_COLLECTION_ALIASES = {
    'new-arrival': 'new-arrivals',
    'best-seller': 'best-selling',
    'best-sellers': 'best-selling',
    'today-deal': 'today-deals',
  };

  function resolveHomeCollectionSlug(slug) {
    const s = String(slug || '').trim();
    if (HOME_COLLECTIONS[s]) return s;
    const alias = HOME_COLLECTION_ALIASES[s.toLowerCase()];
    if (alias && HOME_COLLECTIONS[alias]) return alias;
    return null;
  }

  window._rakuHomeCollections = window._rakuHomeCollections || {};

  window._rakuSetHomeCollectionLabel = function (slug, title) {
    const label = String(title || '').trim();
    if (!label || !HOME_COLLECTIONS[slug]) return;
    CATEGORY_LABELS[slug] = label;
    HOME_COLLECTIONS[slug].title = label;
  };

  window._rakuSetCategoryLabels = function (categories) {
    categories.forEach((c) => {
      if (HOME_COLLECTION_SLUGS.has(c.slug)) return;
      CATEGORY_LABELS[c.slug] = c.name_bn;
    });
  };

  function categorySlugsForFilter(slug) {
    const cats = window._rakuCategories || [];
    const cat = cats.find((c) => c.slug === slug);
    if (!cat) return new Set([slug]);
    const catId = Number(cat.id);
    const childSlugs = cats.filter((c) => Number(c.parent_id) === catId).map((c) => c.slug);
    return new Set([slug, ...childSlugs]);
  }

  function updateCategoryBreadcrumb(slug, label) {
    const nav = document.getElementById('cat-breadcrumb');
    if (!nav) return;
    const cats = window._rakuCategories || [];
    const cat = cats.find((c) => c.slug === slug);
    const parent = cat?.parent_slug ? cats.find((c) => c.slug === cat.parent_slug) : null;
    let html = `<span class="link" data-page="home"><i class="ti ti-home"></i> Home</span>`;
    if (parent) {
      html += `<i class="ti ti-chevron-right" style="font-size:11px;"></i>`;
      html += `<span class="link cat-bc-parent" data-cat-slug="${escapeHtmlCat(parent.slug)}">${escapeHtmlCat(parent.name_bn)}</span>`;
    }
    html += `<i class="ti ti-chevron-right" style="font-size:11px;"></i>`;
    html += `<span class="current">${escapeHtmlCat(label)}</span>`;
    nav.innerHTML = html;
    const homeLink = nav.querySelector('[data-page="home"]');
    if (homeLink) {
      homeLink.onclick = (e) => {
        e.preventDefault();
        if (window.showPage) window.showPage('home');
      };
    }
    const parentLink = nav.querySelector('.cat-bc-parent');
    if (parentLink && parent) {
      parentLink.onclick = (e) => {
        e.preventDefault();
        if (window.openCategory) window.openCategory(parent.slug);
      };
    }
  }

  function escapeHtmlCat(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const categoryState = {
    slug: 'all',
    items: [],
    filtered: [],
  };

  let categoryLoadToken = 0;
  let productLoadToken = 0;

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
    const collectionKey = resolveHomeCollectionSlug(categoryState.slug);
    const collection = collectionKey ? HOME_COLLECTIONS[collectionKey] : null;
    if (!collection?.preserveOrder) {
      list = sortProducts(list, sortBy);
    }
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

    list.querySelectorAll('input[name="cat-brand"]').forEach((el) => {
      el.onchange = applyCategoryFilters;
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
  }

  function bootstrapCollectionProducts(slug) {
    const boot = window._rakuStoreBoot || window.__RAKU_BOOTSTRAP;
    if (!boot) return [];
    if (slug === 'best-selling') return boot.bestSelling || [];
    if (slug === 'new-arrivals') return boot.newArrivals || [];
    if (slug === 'today-deals') return boot.todayDeals || [];
    return [];
  }

  function parseCollectionProducts(slug, data) {
    if (!data?.ok) return null;
    if (Array.isArray(data.products)) return data.products;
    if (slug === 'best-selling' && Array.isArray(data.bestSelling)) return data.bestSelling;
    if (slug === 'new-arrivals' && Array.isArray(data.newArrivals)) return data.newArrivals;
    return null;
  }

  async function loadHomeCollectionProducts(slug, collection) {
    const cached = window._rakuHomeCollections?.[slug];
    if (cached?.length) {
      void (async () => {
        try {
          const data = await apiFetch(collection.api);
          const fresh = parseCollectionProducts(slug, data);
          if (fresh?.length) {
            window._rakuHomeCollections[slug] = fresh;
            if (resolveHomeCollectionSlug(categoryState.slug) === slug || categoryState.slug === slug) {
              categoryState.items = fresh;
              categoryState.filtered = [...fresh];
              applyCategoryFilters();
            }
          }
        } catch (_) {}
      })();
      return cached;
    }

    try {
      const data = await apiFetch(collection.api);
      if (slug === 'today-deals' && data.meta?.title) {
        window._rakuSetHomeCollectionLabel?.('today-deals', data.meta.title);
      }
      const items = parseCollectionProducts(slug, data);
      if (items?.length) {
        window._rakuHomeCollections[slug] = items;
        return items;
      }
    } catch (_) {}

    const bootItems = bootstrapCollectionProducts(slug);
    if (bootItems.length) return bootItems;
    return [];
  }

  function isExternalCategoryLink(slug) {
    const s = window.rakuNormalizeStoreUrl ? window.rakuNormalizeStoreUrl(slug) : String(slug || '').trim();
    return window.rakuIsExternalStoreUrl
      ? window.rakuIsExternalStoreUrl(s)
      : /^https?:\/\//i.test(s);
  }

  function categoryNavHref(slug) {
    if (window.rakuCategoryHref) return window.rakuCategoryHref(slug);
    const s = String(slug || '').trim();
    if (isExternalCategoryLink(s)) return s;
    return `/category/${encodeURIComponent(s)}`;
  }

  async function openCategory(slug, opts = {}) {
    const loadToken = ++categoryLoadToken;
    const normalizedSlug = window.rakuNormalizeStoreUrl
      ? window.rakuNormalizeStoreUrl(slug)
      : String(slug || '').trim();
    if (normalizedSlug.startsWith('/')) {
      if (window.rakuNavigateStoreLink) {
        window.rakuNavigateStoreLink(normalizedSlug);
        return;
      }
      window.location.href = normalizedSlug;
      return;
    }
    if (isExternalCategoryLink(normalizedSlug)) {
      window.open(normalizedSlug, '_blank', 'noopener,noreferrer');
      return;
    }
    const collectionKey = resolveHomeCollectionSlug(normalizedSlug);
    const collection = collectionKey ? HOME_COLLECTIONS[collectionKey] : null;
    const fallback = window._rakuCategories?.[0]?.slug || 'all';
    categoryState.slug = normalizedSlug || (collection ? collectionKey : fallback);
    const label =
      collection?.title || CATEGORY_LABELS[categoryState.slug] || CATEGORY_LABELS[collectionKey] || 'Products';

    if (window._rakuTrackCategoryBrowse) window._rakuTrackCategoryBrowse(categoryState.slug);

    updateCategoryBreadcrumb(categoryState.slug, label);

    document.querySelectorAll('#header-cat-dropdown-list .cat-link, #global-cat-nav .cat-link').forEach((link) => {
      const navSlug = link.dataset.navSlug;
      link.classList.toggle('active', navSlug === categoryState.slug);
    });

    const grid = document.getElementById('category-product-grid');
    if (grid) grid.innerHTML = '<p class="cat-loading">Loading products...</p>';

    if (window.showPage) {
      window.showPage('category', {
        categorySlug: categoryState.slug,
        skipUrl: opts.skipUrl,
        category: collectionKey
          ? { slug: categoryState.slug, name_bn: label }
          : (window._rakuCategories || []).find((c) => c.slug === categoryState.slug) || null,
      });
    }

    resetCategoryFilters();
    const sortEl = document.getElementById('cat-sort-select');
    if (sortEl) {
      if (collectionKey === 'best-selling') sortEl.value = 'best-selling';
      else if (collectionKey === 'new-arrivals') sortEl.value = 'newest';
    }

    let items = [];
    if (opts.search) {
      try {
        const params = new URLSearchParams({ search: String(opts.search).trim(), limit: '48' });
        if (categoryState.slug && categoryState.slug !== 'all') {
          params.set('category', categoryState.slug);
        }
        const data = await apiFetch(`/products?${params}`);
        if (data.ok) items = data.products || [];
      } catch {
        items = [];
      }
    } else if (collection && collectionKey) {
      items = await loadHomeCollectionProducts(collectionKey, collection);
    } else {
      try {
        const data = await apiFetch(`/products?category=${encodeURIComponent(categoryState.slug)}`);
        if (data.ok) items = data.products || [];
      } catch {
        items = products.filter((p) => categorySlugsForFilter(categoryState.slug).has(p.category_slug));
      }
    }

    categoryState.items = items;
    if (items.length) {
      products = [...new Map([...products, ...items].map((p) => [p.id, p])).values()];
    }

    if (opts.search) {
      updateCategoryBreadcrumb(categoryState.slug, `Search: ${opts.search}`);
    } else if (normalizedSlug === 'today-deals' && window._rakuSetHomeCollectionLabel) {
      const dealsTitle = CATEGORY_LABELS['today-deals'];
      if (dealsTitle) updateCategoryBreadcrumb(categoryState.slug, dealsTitle);
    }

    if (loadToken !== categoryLoadToken) return;

    renderBrandFilters();
    bindCategoryFilterEvents();
    categoryState.filtered = [...categoryState.items];
    applyCategoryFilters();

    if (window.RakuSEO) {
      const cats = window._rakuCategories || [];
      const cat = cats.find((c) => c.slug === categoryState.slug);
      if (cat) {
        window.RakuSEO.apply(window.RakuSEO.forCategory(cat));
      } else if (collectionKey && HOME_COLLECTION_SLUGS.has(collectionKey)) {
        window.RakuSEO.apply(
          window.RakuSEO.forCategory({
            slug: categoryState.slug,
            name_bn: CATEGORY_LABELS[categoryState.slug] || CATEGORY_LABELS[collectionKey] || label,
          })
        );
      }
    }
  }

  window.openCategory = openCategory;
  window.isExternalCategoryLink = isExternalCategoryLink;
  window.categoryNavHref = categoryNavHref;
  window.openProduct = openProduct;
  window.renderCart = renderCart;
  window._rakuOpenCart = openCartPage;
  window.renderCheckout = renderCheckout;
  window.productCardHtml = productCardHtml;
  window.bindProductGridEvents = bindProductGridEvents;

  function productImageSrc(url, width) {
    if (window.rakuImageVariantUrl) {
      return window.rakuImageVariantUrl(url, width);
    }
    const u = String(url || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    const path = u.startsWith('/') ? u : `/${u}`;
    if (window.rakuPreferWebpUrl) return window.rakuPreferWebpUrl(path);
    return path;
  }

  /** Product page: always use the stored upload (never implicit /media/48). */
  function productDetailImageSrc(url) {
    return productImageSrc(url);
  }

  function productImageAttrs(url, opts) {
    if (window.rakuImageAttrs) return window.rakuImageAttrs(url, opts);
    return { src: productImageSrc(url), srcset: '', sizes: '' };
  }

  function productGalleryUrls(p) {
    const mainUrl = String(p?.image_url || p?.imageUrl || '').trim();
    let gallery = Array.isArray(p?.gallery_urls) ? p.gallery_urls.filter(Boolean) : [];
    if (!gallery.length && Array.isArray(p?.gallery)) {
      gallery = p.gallery
        .map((row) => row?.image_url || row?.imageUrl)
        .filter(Boolean);
    }
    if (mainUrl) {
      if (!gallery.length) return [mainUrl];
      if (!gallery.includes(mainUrl)) return [mainUrl, ...gallery];
    }
    return gallery;
  }

  function setMainProductPhoto(mainEl, url, alt, bgColor, icon, iconColor) {
    if (!mainEl) return;
    if (bgColor) mainEl.style.background = bgColor;
    let imgEl = mainEl.querySelector('img.product-photo');
    if (url) {
      mainEl.querySelectorAll(':scope > i').forEach((i) => i.remove());
      if (!imgEl) {
        imgEl = document.createElement('img');
        imgEl.className = 'product-photo';
        imgEl.loading = 'eager';
        imgEl.decoding = 'async';
        imgEl.fetchPriority = 'high';
        mainEl.appendChild(imgEl);
      }
      imgEl.removeAttribute('style');
      imgEl.removeAttribute('width');
      imgEl.removeAttribute('height');
      imgEl.onerror = () => setMainProductPhoto(mainEl, null, alt, bgColor, icon, iconColor);
      const fullSrc = productDetailImageSrc(url);
      imgEl.removeAttribute('srcset');
      imgEl.removeAttribute('sizes');
      if (imgEl.getAttribute('src') !== fullSrc) imgEl.src = fullSrc;
      imgEl.alt = (alt || 'Product').trim();
    } else {
      if (imgEl) imgEl.remove();
      let mainIcon = mainEl.querySelector(':scope > i');
      if (!mainIcon) {
        mainIcon = document.createElement('i');
        mainEl.appendChild(mainIcon);
      }
      mainIcon.className = icon || 'ti ti-package';
      mainIcon.style.color = iconColor || '#2D6B32';
      mainIcon.style.fontSize = '140px';
    }
  }

  function paintProductGallery(p) {
    const urls = productGalleryUrls(p);
    const mainImg = document.querySelector('#page-product .main-product-img');
    const thumbRow = document.querySelector('#page-product .thumb-row');
    const alt = (p.image_alt || p.imageAlt || p.name_bn || p.nameBn || 'Product').trim();

    if (!urls.length) {
      setMainProductPhoto(mainImg, null, alt, p.bg_color, p.icon, p.icon_color);
      if (thumbRow) {
        thumbRow.innerHTML = '';
        thumbRow.style.display = 'none';
      }
      return;
    }

    setMainProductPhoto(mainImg, urls[0], alt, p.bg_color || p.bgColor, p.icon, p.icon_color || p.iconColor);

    if (!thumbRow) return;
    if (urls.length <= 1) {
      thumbRow.innerHTML = '';
      thumbRow.style.display = 'none';
      return;
    }

    thumbRow.style.display = '';
    thumbRow.innerHTML = urls
      .map((url, i) => {
        const thumbSrc = (window.rakuImageVariantUrl
          ? window.rakuImageVariantUrl(url, 144)
          : productDetailImageSrc(url)
        ).replace(/"/g, '&quot;');
        return `<div class="thumb-img${i === 0 ? ' active' : ''}" data-url="${encodeURIComponent(url)}" style="background:${p.bg_color || p.bgColor || '#f5f5f5'};"><img src="${thumbSrc}" alt="" width="72" height="72" loading="lazy" decoding="async"></div>`;
      })
      .join('');

    thumbRow.querySelectorAll('.thumb-img').forEach((thumb) => {
      const img = thumb.querySelector('img');
      if (img) {
        const fallbackSrc = decodeURIComponent(thumb.dataset.url || '');
        img.onerror = () => {
          if (fallbackSrc && img.getAttribute('src') !== fallbackSrc) {
            img.onerror = null;
            img.src = fallbackSrc;
            return;
          }
        };
      }
      thumb.onclick = () => {
        thumbRow.querySelectorAll('.thumb-img').forEach((t) => t.classList.remove('active'));
        thumb.classList.add('active');
        const url = decodeURIComponent(thumb.dataset.url || '');
        setMainProductPhoto(mainImg, url, alt, p.bg_color, p.icon, p.icon_color);
      };
    });
  }

  function rewardPointsEnabled() {
    const s = window._rakuStoreSettings || {};
    return s.reward_points_enabled !== '0';
  }

  function rewardPointsPerTaka() {
    if (!rewardPointsEnabled()) return 0;
    const s = window._rakuStoreSettings || {};
    const n = Number(s.reward_points_per_taka);
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  function pointsForAmount(amount) {
    const perTaka = rewardPointsPerTaka();
    if (!perTaka) return 0;
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.floor(n / perTaka);
  }

  function paintProductRewardPoints(qty) {
    const wrap = document.getElementById('pv-reward-points');
    const numEl = document.getElementById('pv-reward-points-num');
    if (!wrap || !numEl) return;
    if (!rewardPointsEnabled()) {
      wrap.hidden = true;
      return;
    }
    const price = Number(currentProduct?.price);
    if (!Number.isFinite(price) || price <= 0) {
      wrap.hidden = true;
      return;
    }
    const q = Math.max(1, Number(qty) || 1);
    const points = pointsForAmount(price * q);
    if (points > 0) {
      numEl.textContent = String(points);
      wrap.hidden = false;
    } else {
      wrap.hidden = true;
    }
  }

  window._rakuUpdateProductRewardPoints = paintProductRewardPoints;

  let lastProductPageQtyId = null;

  function paintProductCore(p) {
    if (!p) return;
    const titleEl = document.querySelector('#page-product .pv-title');
    if (titleEl) titleEl.textContent = p.name_bn || 'Loading...';

    const priceEl = document.querySelector('#page-product .pv-price');
    if (priceEl) priceEl.textContent = formatPrice(p.price);

    const oldEl = document.querySelector('#page-product .pv-old-price');
    const pct = discountPercent(p);
    if (oldEl) {
      const oldVal =
        pct && Number(p.price) > 0
          ? p.old_price || Math.round(Number(p.price) / (1 - pct / 100))
          : null;
      oldEl.textContent = oldVal ? formatPrice(oldVal) : '';
      oldEl.style.display = oldVal ? '' : 'none';
    }

    const discBadge = document.querySelector('#page-product .pv-discount-badge');
    if (discBadge) {
      if (pct) {
        discBadge.textContent = `${pct}% OFF`;
        discBadge.style.display = '';
      } else {
        discBadge.style.display = 'none';
      }
    }

    const badgeRow = document.getElementById('pv-badge-row');
    if (badgeRow) {
      let bh = '';
      if (pct) bh += `<span class="pv-badge pv-badge--discount">-${pct}%</span>`;
      if (p.tag_text && p.tag_type !== 'discount') {
        bh += `<span class="pv-badge pv-badge-new"><i class="ti ti-bolt" style="font-size:10px;"></i> ${escapeHtml(p.tag_text)}</span>`;
      } else if (p.tag_text && p.tag_type === 'discount' && !pct) {
        bh += `<span class="pv-badge pv-badge-new"><i class="ti ti-bolt" style="font-size:10px;"></i> ${escapeHtml(p.tag_text)}</span>`;
      }
      badgeRow.innerHTML = bh;
      badgeRow.style.display = bh ? '' : 'none';
    }

    paintProductGallery(p);

    const pid = Number(p.id) || 0;
    if (pid && lastProductPageQtyId !== pid) {
      lastProductPageQtyId = pid;
      resetProductPageQty();
    } else if (!pid) {
      lastProductPageQtyId = null;
      resetProductPageQty();
    } else {
      paintProductRewardPoints(getProductPageQty(p));
    }

    updateProductPurchaseButtons(p);
  }

  function updateProductPurchaseButtons(p) {
    if (!p) return;
    const outOfStock = productIsOutOfStock(p);
    const btnAdd = document.getElementById('btn-add-to-cart-main');
    const btnBuy = document.getElementById('btn-buy-now');
    const btnPre = document.getElementById('btn-pre-order');
    if (btnAdd) btnAdd.hidden = outOfStock;
    if (btnBuy) btnBuy.hidden = outOfStock;
    if (btnPre) btnPre.hidden = !outOfStock;
  }

  window.updateProductPurchaseButtons = updateProductPurchaseButtons;

  function bindProductActions(p) {
    updateProductPurchaseButtons(p);
    const btnAdd = document.getElementById('btn-add-to-cart-main');
    if (btnAdd) {
      btnAdd.onclick = async () => {
        if (!productInStock(p)) return;
        if (cartProductIds.has(p.id)) {
          openCartPage();
          return;
        }
        const qty = getProductPageQty(p);
        const data = await addToCart(p.id, qty);
        if (!data.ok) return;
        updateProductPageCartBtn();
      };
    }
    const btnBuy = document.getElementById('btn-buy-now');
    if (btnBuy) {
      btnBuy.onclick = async () => {
        if (!productInStock(p)) return;
        if (!cartProductIds.has(p.id)) {
          const qty = getProductPageQty(p);
          const data = await addToCart(p.id, qty);
          if (!data.ok) return;
        }
        await syncCartBadge();
        await proceedToCheckoutFromCart();
      };
    }
    const btnPre = document.getElementById('btn-pre-order');
    if (btnPre) {
      btnPre.onclick = () => openPreOrderFlow(p);
    }
    bindProductWishButton();
    updateProductPageCartBtn();
  }

  function finishProductPage(p) {
    if (window.RakuSEO && p?.id) window.RakuSEO.apply(window.RakuSEO.forProduct(p));
    const reviewMsg = document.getElementById('review-submit-msg');
    if (reviewMsg) reviewMsg.className = 'reviews-submit-msg';
    loadProductReviews(p.id);
    bindReviewSubmit(p.id);
    setReviewRating(5);
    if (window._rakuEnhanceProductPageSync) {
      window._rakuEnhanceProductPageSync(p);
    } else if (window._rakuPaintPreloadedProductPage) {
      window._rakuPaintPreloadedProductPage();
    }
    void window._rakuEnhanceProductPageRelated?.(p);
  }

  function productHasDetailContent(p) {
    if (!p) return false;
    const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return Boolean(stripHtml(p.description_bn) || stripHtml(p.short_description));
  }

  function productHasGallery(p) {
    return productGalleryUrls(p).length > 0;
  }

  function productNeedsDetailFetch(p) {
    if (!p) return true;
    if (!('stock' in p)) return true;
    const gallery = productGalleryFromApi(p);
    // List/bootstrap cards often omit extra gallery rows — refetch to confirm.
    if (gallery === null || gallery.length <= 1) return true;
    const hasDesc = Boolean(String(p.description_bn || p.descriptionBn || '').trim());
    const hasShort = Boolean(String(p.short_description || p.shortDescription || '').trim());
    if (hasDesc || hasShort) return false;
    return true;
  }

  async function openProduct(idOrSlug, opts = {}) {
    const raw = String(idOrSlug ?? '').trim();
    if (!raw) return;
    const loadToken = ++productLoadToken;
    const byId = /^\d+$/.test(raw);
    const n = byId ? Number(raw) : null;

    if (window.rakuEnsureRouteAssets) {
      try {
        await window.rakuEnsureRouteAssets('product');
      } catch (_) {}
    }

    if (!opts.skipScroll) {
      (window.rakuScrollToTop || (() => window.scrollTo(0, 0)))('auto');
    }
    if (window.showPage && window._rakuVisiblePage !== 'product') {
      window.showPage('product', { skipUrl: true, skipScroll: true });
    }

    const preloaded =
      window.__RAKU_PRELOAD_PRODUCT?.ok &&
      (byId
        ? window.__RAKU_PRELOAD_PRODUCT.product?.id === n
        : window.__RAKU_PRELOAD_PRODUCT.product?.slug === raw)
        ? window.__RAKU_PRELOAD_PRODUCT.product
        : null;

    if (preloaded) {
      mergeProductRecord(preloaded);
      currentProduct = preloaded;
      paintProductCore(preloaded);
      bindProductActions(preloaded);
      finishProductPage(preloaded);
    } else {
      const cached =
        (byId && products.find((x) => x.id === n)) ||
        products.find((x) => x.slug === raw) ||
        null;
      if (cached) {
        mergeProductRecord(cached);
        currentProduct = cached;
        paintProductCore(cached);
        bindProductActions(cached);
        finishProductPage(cached);
      } else if (!document.querySelector('#page-product .main-product-img img.product-photo')) {
        paintProductCore({ name_bn: 'Loading...', price: 0, bg_color: '#f5f5f5' });
      }
    }

    let p = preloaded;
    if (!p || productNeedsDetailFetch(p)) {
      const detailed = await fetchProductDetail(raw);
      if (loadToken !== productLoadToken) return;
      if (detailed) p = detailed;
      else if (!p) {
        p =
          (byId && products.find((x) => x.id === n)) ||
          products.find((x) => x.slug === raw) ||
          null;
      }
    }
    if (!p) {
      paintProductCore({
        name_bn: 'Product not found',
        price: 0,
        bg_color: '#f5f5f5',
        description_bn: 'This product may have been removed. Please browse our catalog.',
      });
      return;
    }

    mergeProductRecord(p);
    currentProduct = p;
    if (window._rakuTrackProductView) window._rakuTrackProductView(p);
    if (!preloaded || p !== preloaded) {
      paintProductCore(p);
      bindProductActions(p);
      finishProductPage(p);
    }

    if (window.showPage) {
      window.showPage('product', {
        productId: p.id,
        productSlug: p.slug,
        skipUrl: opts.skipUrl,
        skipScroll: true,
      });
    }

    if (!productNeedsDetailFetch(p)) return;

    const full = await fetchProductDetail(p.slug || p.id, { bypassCache: true });
    if (loadToken !== productLoadToken) return;
    if (!full || full.id !== p.id) return;
    mergeProductRecord(full);
    currentProduct = full;
    if (window._rakuTrackProductView) window._rakuTrackProductView(full);
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
      const photoInput = document.getElementById('review-photo');
      if (!comment) {
        showReviewMsg('Please write a few words about the product.', 'error');
        return;
      }
      btn.disabled = true;
      let imageUrl = null;
      const photoFile = photoInput?.files?.[0];
      if (photoFile) {
        try {
          const fd = new FormData();
          fd.append('image', photoFile);
          const upRes = await fetch((window.RAKU_API_BASE || '') + '/api/reviews/upload-image', {
            method: 'POST',
            credentials: 'same-origin',
            body: fd,
          });
          const upData = await upRes.json();
          if (!upData.ok) {
            btn.disabled = false;
            showReviewMsg(upData.error || 'Could not upload photo', 'error');
            return;
          }
          imageUrl = upData.url;
        } catch (_) {
          btn.disabled = false;
          showReviewMsg('Could not upload photo', 'error');
          return;
        }
      }
      const data = await apiFetch(`/products/${productId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating, customerName, comment, imageUrl }),
      });
      btn.disabled = false;
        if (data.ok) {
          showReviewMsg(data.message, 'success');
          document.getElementById('review-comment').value = '';
          if (photoInput) photoInput.value = '';
          setReviewRating(5);
          if (data.pointsAwarded && window._rakuUpdateUserRewardPoints && data.pointsAwarded > 0) {
            const cur = Number(document.getElementById('acc-stat-points')?.textContent) || 0;
            window._rakuUpdateUserRewardPoints(cur + Number(data.pointsAwarded));
          }
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

  function reviewAvatarHtml(r) {
    const name = r.customer_name || r.customerName || 'Customer';
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'U';
    const url = String(r.reviewer_avatar_url || r.reviewerAvatarUrl || '').trim();
    if (url) {
      const src = escapeHtml(url).replace(/"/g, '&quot;');
      return `<div class="reviewer-avatar-wrap"><img class="reviewer-avatar-img" src="${src}" alt="" width="44" height="44" loading="lazy" decoding="async" onerror="this.hidden=true"><div class="reviewer-avatar" aria-hidden="true">${escapeHtml(initials)}</div></div>`;
    }
    return `<div class="reviewer-avatar">${escapeHtml(initials)}</div>`;
  }

  function reviewCardHtml(r) {
    const date = r.created_at
      ? new Date(r.created_at).toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : r.reviewer_city || r.city
        ? escapeHtml(String(r.reviewer_city || r.city).trim())
        : 'Verified purchase';
    const comment = escapeHtml(r.comment || '');
    const photoUrl = String(r.image_url || r.imageUrl || '').trim();
    const photoHtml = photoUrl
      ? `<div class="review-photo"><img src="${escapeHtml(photoUrl).replace(/"/g, '&quot;')}" alt="Review photo" loading="lazy" decoding="async"></div>`
      : '';
    return `<article class="review-card">
      <div class="review-head">
        ${reviewAvatarHtml(r)}
        <div class="reviewer-meta">
          <div class="reviewer-name">${escapeHtml(r.customer_name || r.customerName || 'Customer')}</div>
          <div class="reviewer-date">${date}</div>
        </div>
        ${renderStarIcons(Number(r.rating))}
      </div>
      <p class="review-text">${comment}</p>
      ${photoHtml}
      <span class="review-verified"><i class="ti ti-circle-check-filled"></i> Verified buyer</span>
    </article>`;
  }

  function paintProductReviewStats(count, avgRating) {
    const n = Number(count) || 0;
    const avg = Number(avgRating) || 0;
    const tabBtn = document.querySelector('.tab-btn[data-tab="tab-reviews"]');
    const pvRev = document.querySelector('.pv-reviews');
    const starsEl = document.querySelector('#page-product .pv-stars');
    const rNum = document.querySelector('#page-product .pv-rating-num');
    const countLabel = n ? `(${n} Review${n !== 1 ? 's' : ''})` : '(No reviews yet)';
    if (tabBtn) tabBtn.textContent = n ? `Reviews (${n})` : 'Reviews';
    if (pvRev) pvRev.textContent = countLabel;
    if (starsEl) starsEl.textContent = n ? stars(avg) : '☆☆☆☆☆';
    if (rNum) {
      rNum.textContent = n ? avg.toFixed(1) : '0.0';
      rNum.style.display = n ? '' : 'none';
    }
  }

  async function loadProductReviews(productId) {
    const list = document.getElementById('product-reviews-list');
    if (!list) return;
    try {
      const data = await apiFetch(`/products/${productId}/reviews`);
      const reviews = data.reviews || [];
      const count = Number(data.count) || reviews.length;
      const avgRating = Number(data.avgRating) || 0;

      paintProductReviewStats(count, avgRating);
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
        `<div class="reviews-list-header"><i class="ti ti-messages"></i> Customer reviews (${count})</div>` +
        reviews.map(reviewCardHtml).join('');
    } catch (_) {
      list.innerHTML = '';
    }
  }

  function pickHeroBanner(banners) {
    const heroes = (banners || []).filter((b) => b.position === 'hero');
    return heroes.find((b) => b.image_url || b.imageUrl) || heroes[0] || null;
  }

  function applyHeroMainBackground(heroMain, banner) {
    if (!heroMain) return;
    const src = productImageSrc(banner?.image_url || banner?.imageUrl);
    let imgEl = heroMain.querySelector('img.hero-main-photo');
    if (src) {
      heroMain.classList.add('hero-main--has-bg-photo');
      heroMain.style.removeProperty('--hero-bg-photo');
      if (!imgEl) {
        imgEl = document.createElement('img');
        imgEl.className = 'hero-main-photo';
        imgEl.width = 1200;
        imgEl.height = 480;
        imgEl.loading = 'eager';
        imgEl.decoding = 'async';
        imgEl.setAttribute('fetchpriority', 'high');
        heroMain.appendChild(imgEl);
      }
      imgEl.onerror = () => {
        heroMain.classList.remove('hero-main--has-bg-photo');
        imgEl.remove();
        if (banner?.bg_gradient || banner?.bgGradient) {
          heroMain.style.setProperty('--hero-bg', banner.bg_gradient || banner.bgGradient);
        }
      };
      imgEl.onload = null;
      imgEl.src = src;
      imgEl.alt = banner?.title || 'Homepage banner';
    } else {
      heroMain.classList.remove('hero-main--has-bg-photo');
      heroMain.style.removeProperty('--hero-bg-photo');
      if (imgEl) imgEl.remove();
    }
    if ((banner?.bg_gradient || banner?.bgGradient) && !src) {
      heroMain.style.setProperty('--hero-bg', banner.bg_gradient || banner.bgGradient);
    }
  }

  function applyBannersData(banners) {
    const heroMain = document.getElementById('hero-main');
    if (heroMain?.classList.contains('hero-main--slider')) return;
    const main = pickHeroBanner(banners);
    if (main) {
      const heroMain = document.getElementById('hero-main');
      applyHeroMainBackground(heroMain, main);
      if (heroMain) {
        if (main.link_url) {
          heroMain.style.cursor = 'pointer';
          heroMain.onclick = () => {
            let url = main.link_url;
            if (url.startsWith('#/')) url = url.slice(1);
            else if (url.startsWith('#')) url = '/' + url.slice(1);
            if (url.startsWith('/')) {
              history.pushState(null, '', url);
              if (window._rakuRestoreRoute) window._rakuRestoreRoute();
            } else {
              window.location.href = url;
            }
          };
        } else {
          heroMain.style.cursor = '';
          heroMain.onclick = null;
        }
      }
    }
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
          <button class="c-item-remove-btn cart-item-remove" type="button" data-id="${item.productId}" aria-label="Remove from cart"><i class="ti ti-trash" aria-hidden="true"></i></button>
        </div>
      </div>`;
  }

  function paintCartPage(data) {
    if (!data?.ok) return;

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
      syncCouponInputs(data.totals.couponCode);
    }

    const checkoutBtn = document.getElementById('btn-cart-checkout');
    if (checkoutBtn) checkoutBtn.disabled = isEmpty;

    bindCartEvents();
    if (backBtn && !backBtn._bound) {
      backBtn._bound = true;
      backBtn.onclick = () => window.showPage && window.showPage('home');
    }
  }

  async function renderCart() {
    if (window._rakuPendingCartPaint?.ok) {
      const pending = window._rakuPendingCartPaint;
      delete window._rakuPendingCartPaint;
      applyCartState(pending);
      paintCartPage(pending);
      return;
    }
    const data = await loadCartState();
    if (!data?.ok) return;
    paintCartPage(data);
  }

  function bindCartEvents() {
    document.querySelectorAll('#page-cart .qty-btn').forEach((btn) => {
      btn.onclick = async function () {
        const item = this.closest('.c-item');
        const id = Number(item.dataset.productId);
        const input = item.querySelector('.qty-input');
        let v = parseInt(input.value, 10) || 1;
        v = this.dataset.dir === 'up' ? Math.min(v + 1, 99) : Math.max(v - 1, 1);
        const data = await apiFetch(`/cart/${id}`, { method: 'PATCH', body: JSON.stringify({ qty: v }) });
        applyCartPaint(data);
      };
    });

    document.querySelectorAll('#page-cart .cart-item-remove').forEach((btn) => {
      btn.onclick = async function () {
        const id = Number(this.dataset.id);
        const data = await apiFetch(`/cart/${id}`, { method: 'DELETE' });
        applyCartPaint(data);
      };
    });
  }

  function pointsFromCart(cart) {
    if (!Array.isArray(cart) || !rewardPointsEnabled()) return 0;
    return cart.reduce(
      (sum, item) => sum + pointsForAmount(Number(item.price) * Number(item.qty || 1)),
      0
    );
  }

  function updateCheckoutRewardPoints(cart) {
    const row = document.getElementById('checkout-reward-points-row');
    const el = document.getElementById('checkout-reward-points');
    if (!row || !el) return;
    if (!rewardPointsEnabled()) {
      row.hidden = true;
      return;
    }
    const points = pointsFromCart(cart);
    if (points > 0) {
      el.textContent = String(points);
      row.hidden = false;
    } else {
      row.hidden = true;
    }
  }

  async function renderCheckout() {
    const data = await apiFetch('/cart');
    if (!data.ok) return;
    if (!data.cart.length) {
      if (window.showPage) window.showPage('cart');
      return;
    }

    const itemsEl = document.getElementById('checkout-page-items');
    if (itemsEl) {
      itemsEl.innerHTML = data.cart
        .map(
          (item) => `<div class="cm-summary-item">
            <div class="cm-summary-thumb" style="background:${item.bgColor};">${cartThumbHtml(item)}</div>
            <span class="cm-summary-name">${escapeHtml(item.name)} ×${item.qty}</span>
            <span class="cm-summary-price">${formatPrice(item.price * item.qty)}</span>
          </div>`
        )
        .join('');
    }

    if (data.totals) {
      applyTotalsToSummary(data.totals, '#page-checkout');
      syncCouponInputs(data.totals.couponCode);
    }
    updateCheckoutRewardPoints(data.cart);
    bindDeliveryZone('#page-checkout');
    const district = data.checkoutDistrict || getSelectedDeliveryDistrict('#page-checkout') || 'Dhaka';
    setDeliveryZoneUI(district, '#page-checkout');
    if (!data.checkoutDistrict) {
      await selectDeliveryZone(district, '#page-checkout');
    }
    await prefillCheckoutForm();
    updatePaymentMethodUI(getSelectedPaymentMethod());
    trackFacebookConversion('InitiateCheckout', {
      value: Number(data.totals?.total) || 0,
      currency: 'BDT',
    });
  }

  function discountRowHtml(delRow) {
    if (delRow.classList.contains('summary-row')) {
      return '<span class="summary-row-label">Discount</span><span class="summary-discount" style="color:var(--green);"></span>';
    }
    if (delRow.classList.contains('cm-summary-row')) {
      return '<span>Discount</span><span class="summary-discount" style="color:var(--green);"></span>';
    }
    return '<span class="c-summary-label">Discount</span><span class="c-summary-val summary-discount" style="color:var(--green);"></span>';
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
    let discRow = root.querySelector('.summary-discount-row');
    if (totals.discount > 0) {
      if (!discRow) {
        const delRow = root.querySelector('.summary-delivery')?.closest(
          '.c-summary-row, .summary-row, .cm-summary-row'
        );
        if (delRow) {
          discRow = document.createElement('div');
          discRow.className = `${delRow.className} summary-discount-row`.trim();
          discRow.innerHTML = discountRowHtml(delRow);
          delRow.insertAdjacentElement('afterend', discRow);
        }
      }
      if (discRow) {
        discRow.hidden = false;
        const discEl = discRow.querySelector('.summary-discount');
        if (discEl) discEl.textContent = '-' + totals.discountFormatted;
      }
    } else if (discRow) {
      discRow.hidden = true;
    }
    root.querySelectorAll('.summary-total, .c-total-val').forEach((el) => {
      el.textContent = totals.totalFormatted;
    });
  }

  function syncCouponInputs(code) {
    const applied = Boolean(code);
    document.querySelectorAll('.js-coupon-input').forEach((input) => {
      input.value = code || '';
      input.readOnly = applied;
    });
    document.querySelectorAll('.js-coupon-apply').forEach((btn) => {
      btn.hidden = applied;
    });
    document.querySelectorAll('.js-coupon-remove').forEach((btn) => {
      btn.hidden = !applied;
    });
  }

  async function refreshSummariesAfterCoupon() {
    const data = await apiFetch('/cart');
    if (!data.ok || !data.totals) return;
    const totals = data.totals;
    syncCouponInputs(totals.couponCode);

    const cartPage = document.getElementById('page-cart');
    const checkoutPage = document.getElementById('page-checkout');

    if (cartPage && cartPage.style.display !== 'none') {
      await renderCart();
    } else {
      applyTotalsToSummary(totals, '#page-cart');
    }

    if (checkoutPage && checkoutPage.style.display !== 'none') {
      await renderCheckout();
    } else {
      applyTotalsToSummary(totals, '#page-checkout');
    }
  }

  async function updateCheckoutDistrict(district) {
    if (!district) return;
    const data = await apiFetch('/cart/district', { method: 'POST', body: JSON.stringify({ district }) });
    if (data.ok && data.totals) {
      applyTotalsToSummary(data.totals, '#page-cart');
      applyTotalsToSummary(data.totals, '#page-checkout');
    }
  }

  function deliveryZoneHint(district) {
    const s = window._rakuStoreSettings || {};
    const freeMin = Number(s.free_delivery_min) || 500;
    const dhakaFee = Number(s.delivery_fee) || 60;
    const outsideFee = Number(s.delivery_fee_outside) || 120;
    const fee = String(district).toLowerCase() === 'dhaka' ? dhakaFee : outsideFee;
    return `Free delivery on orders over ৳${freeMin.toLocaleString('en-BD')}. Otherwise ৳${fee} delivery charge applies.`;
  }

  function getSelectedDeliveryDistrict(scope) {
    if (scope === '#page-checkout') {
      return document.getElementById('checkout-page-district')?.value || '';
    }
    return document.getElementById('checkout-page-district')?.value || '';
  }

  function setDeliveryZoneUI(district, scope) {
    const value = district || 'Dhaka';
    const hidden = document.getElementById('checkout-page-district');
    const grid = document.getElementById('checkout-page-zone-grid');
    const hint = document.getElementById('checkout-page-zone-hint');
    if (hidden) hidden.value = value;
    if (grid) {
      grid.querySelectorAll('.checkout-zone-tile').forEach((tile) => {
        tile.classList.toggle('selected', tile.dataset.district === value);
      });
    }
    if (hint) hint.textContent = deliveryZoneHint(value);
  }

  async function selectDeliveryZone(district, scope) {
    if (!district) return;
    setDeliveryZoneUI(district, scope);
    await updateCheckoutDistrict(district);
  }

  function bindDeliveryZone(scope) {
    const grid = document.getElementById('checkout-page-zone-grid');
    if (!grid || grid._rakuBound) return;
    grid._rakuBound = true;
    grid.querySelectorAll('.checkout-zone-tile').forEach((tile) => {
      tile.addEventListener('click', () => {
        void selectDeliveryZone(tile.dataset.district, scope);
      });
    });
    setDeliveryZoneUI(getSelectedDeliveryDistrict(scope) || 'Dhaka', scope);
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
    const method = getSelectedPaymentMethod();
    const trxId = document.getElementById('cm-trxid')?.value?.trim() || '';
    let notes = root.querySelector('[name="notes"]')?.value?.trim() || '';
    if (trxId && method && method !== 'cod') {
      notes = [notes, `TrxID (${method}): ${trxId}`].filter(Boolean).join(' | ');
    }
    return {
      name: root.querySelector('[name="name"]')?.value?.trim(),
      phone: root.querySelector('[name="phone"]')?.value?.trim(),
      address: root.querySelector('[name="address"]')?.value?.trim(),
      district: getSelectedDeliveryDistrict(scope),
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
    if (!form.district) {
      alert('Please select delivery area (Inside Dhaka or Outside Dhaka)!');
      return;
    }
    const payCfg = PAYMENT_UI[form.paymentMethod];
    if (payCfg?.needsTrx && !form.trxId) {
      alert('Please enter your payment Transaction ID (TrxID)!');
      return;
    }
    btn.disabled = true;
    const result = await apiFetch('/orders', { method: 'POST', body: JSON.stringify(form) });
    btn.disabled = false;
    if (!result.ok) {
      alert(result.error || 'Order failed');
      return;
    }
    if (window._rakuRenderSuccessOrder) window._rakuRenderSuccessOrder(result);
    if (window._rakuSetCartCount) window._rakuSetCartCount(0);
    trackFacebookConversion('Purchase', {
      value: Number(result.total) || 0,
      currency: 'BDT',
    });
    await renderCart();
    await syncCartBadge();
    if (window.showPage) window.showPage('success');
  }

  function bindCheckoutPayments() {
    const grid = document.getElementById('cm-pay-grid');
    if (!grid || grid._rakuBound) return;
    grid._rakuBound = true;
    grid.querySelectorAll('.cm-pay-tile').forEach((tile) => {
      tile.addEventListener('click', () => updatePaymentMethodUI(tile.dataset.method));
    });
    updatePaymentMethodUI(getSelectedPaymentMethod());
  }

  async function prefillCheckoutForm() {
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

  async function proceedToCheckoutFromCart() {
    const data = await apiFetch('/cart');
    if (!data.ok || !data.cart.length) {
      alert('Your cart is empty. Add products before checkout.');
      return false;
    }
    if (window.RAKU_STANDALONE) {
      window.location.href = '/checkout';
      return true;
    }
    if (window.showPage) {
      window.showPage('checkout');
      await renderCheckout();
      return true;
    }
    window.location.href = '/checkout';
    return true;
  }

  window.openCheckoutModal = proceedToCheckoutFromCart;
  window.proceedToCheckoutFromCart = proceedToCheckoutFromCart;

  function bindCheckout() {
    bindCheckoutPayments();
    bindDeliveryZone('#page-checkout');
    const btn = document.getElementById('btn-place-order');
    if (btn && !btn._rakuBound) {
      btn._rakuBound = true;
      btn.onclick = () => placeOrder(btn, '#page-checkout');
    }
    const backBtn = document.getElementById('checkout-back-cart');
    if (backBtn && !backBtn._rakuBound) {
      backBtn._rakuBound = true;
      backBtn.onclick = () => {
        if (window.RAKU_STANDALONE) window.location.href = '/cart';
        else if (window.showPage) window.showPage('cart');
      };
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
    if (window.RAKU_STANDALONE) {
      document.querySelectorAll('.site-logo-link').forEach((l) => {
        if (l._rakuStandaloneBound) return;
        l._rakuStandaloneBound = true;
        l.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = window.rakuShopUrl ? window.rakuShopUrl('/') : '/';
        });
      });
      ['nav-wishlist-btn', 'nav-wishlist-btn-desktop'].forEach((id) => {
        const navWish = document.getElementById(id);
        if (!navWish || navWish._rakuBound) return;
        navWish._rakuBound = true;
        navWish.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = window.rakuShopUrl ? window.rakuShopUrl('/wishlist') : '/wishlist';
        });
      });
      ['nav-account-btn', 'nav-account-btn-desktop'].forEach((id) => {
        const navAcc = document.getElementById(id);
        if (!navAcc || navAcc._rakuBound) return;
        navAcc._rakuBound = true;
        navAcc.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = window.rakuShopUrl ? window.rakuShopUrl('/account') : '/account';
        });
      });
    }

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

    ['nav-wishlist-btn', 'nav-wishlist-btn-desktop'].forEach((id) => {
      const navWish = document.getElementById(id);
      if (!navWish || navWish._rakuBound) return;
      navWish._rakuBound = true;
      navWish.addEventListener('click', async (e) => {
        e.preventDefault();
        await openWishlist();
      });
    });

    document.querySelectorAll('.nav-cart-btn').forEach((btn) => {
      if (btn._rakuNavBound) return;
      btn._rakuNavBound = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (window._rakuOpenCart) window._rakuOpenCart();
        else if (window.showPage) window.showPage('cart');
        else window.location.href = window.rakuShopUrl ? window.rakuShopUrl('/cart') : '/cart';
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
    modal.removeAttribute('inert');
    document.body.classList.add('trk-open');
    const input = modal.querySelector('#trk-modal-order-id');
    const result = modal.querySelector('#trk-modal-result');
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
    modal.setAttribute('inert', '');
    document.body.classList.remove('trk-open');
  }

  async function trackOrderById(orderNumber) {
    const id = String(orderNumber || '').trim();
    if (!id) return { ok: false, error: 'Enter your Order ID' };
    return await apiFetch(`/orders/track?orderNumber=${encodeURIComponent(id)}`);
  }

  function renderTrackModalResult(data) {
    const modal = document.getElementById('track-modal');
    const box = modal?.querySelector('#trk-modal-result');
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
    const submit = modal.querySelector('#trk-modal-submit');
    const input = modal.querySelector('#trk-modal-order-id');

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
      renderTrackModalResult(res);
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
        const m = txt.match(/RKS-\d{4}-\d{6,}/i);
        openTrackPage(m ? m[0] : '');
      });
    }
  }

  function openTrackPage(orderId) {
    const id = orderId ? String(orderId).trim() : '';
    if (window.showPage && !window.RAKU_STANDALONE) {
      window.showPage('track');
      if (id) {
        requestAnimationFrame(() => {
          const input = document.getElementById('trk-order-id');
          if (input) input.value = id;
          if (window._rakuInitTrackPage) window._rakuInitTrackPage();
        });
      }
      return;
    }
    window.location.href = id ? `/track?id=${encodeURIComponent(id)}` : '/track';
  }

  window._rakuOpenTrackOrder = () => {
    openTrackPage('');
  };

  function applySettingsData(settings) {
    if (!settings) return;
    const ann = document.querySelector('.announcement span');
    if (ann && settings.announcement_text) ann.innerHTML = settings.announcement_text;
    const badge = document.getElementById('hero-badge');
    if (badge && settings.feature_flash_sale === '0') badge.style.display = 'none';
    const fbLink = document.getElementById('success-facebook-link');
    if (fbLink) {
      const url = String(settings.social_facebook || '').trim() || 'https://www.facebook.com/rakushopbd';
      fbLink.href = url;
    }
    window._rakuStoreSettings = settings;
    document.dispatchEvent(new CustomEvent('raku:settings-loaded', { detail: settings }));
  }

  const homeAutoScrollTimers = new Map();
  const homeAutoScrollIndexes = new Map();

  function stopHomeScrollAuto(trackId) {
    const t = homeAutoScrollTimers.get(trackId);
    if (t) {
      clearInterval(t);
      homeAutoScrollTimers.delete(trackId);
    }
    homeAutoScrollIndexes.delete(trackId);
    const track = document.getElementById(trackId);
    if (track?._rakuAutoScrollViewportObs) {
      track._rakuAutoScrollViewportObs.disconnect();
      track._rakuAutoScrollViewportObs = null;
    }
  }

  function bindMobileHorizontalTrackScrollFix(track) {
    if (!track || track._rakuMobileHScrollFix) return;
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    track._rakuMobileHScrollFix = true;

    let startX = 0;
    let startY = 0;
    let axis = null;

    const clearAxis = () => {
      axis = null;
      track.style.removeProperty('touch-action');
      track.style.removeProperty('overflow-x');
    };

    track.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length !== 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        axis = null;
        track.style.removeProperty('touch-action');
        track.style.removeProperty('overflow-x');
      },
      { passive: true }
    );

    track.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        if (!axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
          axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
          if (axis === 'y') {
            track.style.touchAction = 'pan-y';
            track.style.overflowX = 'hidden';
          } else {
            track.style.touchAction = 'pan-x';
          }
        }
      },
      { passive: true }
    );

    track.addEventListener('touchend', clearAxis, { passive: true });
    track.addEventListener('touchcancel', clearAxis, { passive: true });
  }

  function bindAllMobileHorizontalTrackScrollFixes() {
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    [
      ...HOME_PRODUCT_TRACK_IDS,
      ...HOME_CAROUSEL_TRACKS.map((t) => t.id),
      'home-category-track',
      'trust-bar',
      'today-deals-grid',
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) bindMobileHorizontalTrackScrollFix(el);
    });
  }

  function initHomeScrollAuto(trackId, intervalMs = 3200) {
    stopHomeScrollAuto(trackId);
    const track = document.getElementById(trackId);
    if (!track) return;

    const isCategoryTrack = trackId === 'home-category-track';
    const isTrustBar = trackId === 'trust-bar';
    const isReviewTrack =
      trackId === 'track-customer-reviews' || trackId === 'track-messenger-reviews';
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isTrustBar && !isMobile) return;

    if (isReviewTrack) {
      const carousel = HOME_CAROUSEL_TRACKS.find((t) => t.id === trackId);
      if (carousel) {
        syncHomeCarouselCardWidths(trackId, carousel.cardSel, carousel.minWidth);
      }
    }

    const cards = () =>
      track.querySelectorAll(
        '.product-card, .home-review-card, .home-messenger-card, .cat-card, .trust-item'
      );
    if (cards().length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    homeAutoScrollIndexes.set(trackId, 0);

    let paused = false;
    let inViewport = false;
    const viewportObserver = new IntersectionObserver(
      (entries) => {
        inViewport = Boolean(entries[0]?.isIntersecting);
      },
      { root: null, threshold: 0.25 }
    );
    viewportObserver.observe(track);
    track._rakuAutoScrollViewportObs = viewportObserver;

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
      if (paused || !inViewport) return;
      const list = cards();
      if (list.length < 2) return;

      if (isTrustBar) {
        let idx = homeAutoScrollIndexes.get(trackId) ?? 0;
        idx = (idx + 1) % list.length;
        homeAutoScrollIndexes.set(trackId, idx);
        list[idx].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
        return;
      }

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
    bindAllMobileHorizontalTrackScrollFixes();
    initHomeScrollAuto('track-best-selling', 3200);
    initHomeScrollAuto('track-new-arrivals', 3600);
    initHomeScrollAuto('track-recommended-for-you', 3500);
    initHomeScrollAuto('track-customer-reviews', 3800);
    initHomeScrollAuto('track-messenger-reviews', 4000);
    initHomeScrollAuto('trust-bar', 4000);
  }

  window._rakuInitHomeScrollAuto = initHomeScrollAuto;
  window._rakuStopHomeScrollAuto = stopHomeScrollAuto;
  window._rakuSyncHomeCarouselCardWidths = syncHomeCarouselCardWidths;
  window._rakuBindMobileHorizontalTrackScrollFix = bindMobileHorizontalTrackScrollFix;

  function paintHomeScrollTrack(trackId, list) {
    const track = document.getElementById(trackId);
    if (!track) return;
    stopHomeScrollAuto(trackId);
    const skeletonOnly = Boolean(track.querySelector('.product-card--skeleton'));
    const existingCount = track.querySelectorAll('.product-card:not(.product-card--skeleton)').length;
    const incomingCount = list?.length || 0;
    if (
      !skeletonOnly &&
      track.dataset.ssrReady === '1' &&
      existingCount > 0 &&
      (!incomingCount || existingCount >= incomingCount)
    ) {
      bindHomeScrollResize();
      queueSyncHomeScrollTrack(trackId);
      return;
    }
    if (!list?.length) {
      if (skeletonOnly) return;
      track.innerHTML = '<p class="home-scroll-empty">No products in this section yet.</p>';
      return;
    }
    track.innerHTML = list.map(productCardHtml).join('');
    track.dataset.ssrReady = '1';
    bindHomeScrollResize();
    queueSyncHomeScrollTrack(trackId);
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
    window._rakuHomeCollections['best-selling'] = best;
    window._rakuHomeCollections['new-arrivals'] = newest;
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
    const scheduleAuto = window.rakuScheduleIdle || ((fn) => setTimeout(fn, 150));
    scheduleAuto(() => initAllHomeScrollAuto(), { timeout: 2500 });
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

  function refreshHeroSideSlider(boot) {
    if (!boot?.heroSideSlider) return;
    const run = (left) => {
      if (window.applyHeroSideSliderData) {
        window.applyHeroSideSliderData(boot.heroSideSlider);
        return;
      }
      if (left > 0) setTimeout(() => run(left - 1), 50);
    };
    run(40);
  }

  async function refreshHeroSideSliderFromApi(boot) {
    refreshHeroSideSlider(boot);
    if (boot?.heroSideSlider?.slides?.length) return;
    try {
      const data = await apiFetch('/bootstrap');
      if (data.ok) refreshHeroSideSlider(data);
    } catch (_) {}
  }

  async function refreshTodayDealsFromApi(boot) {
    if (boot?.todayDeals?.length && window.applyTodayDealsData) {
      window.applyTodayDealsData(boot);
      return;
    }
    if (boot?.todayDealsMeta?.enabled === false) {
      window.applyTodayDealsData?.({ todayDealsMeta: boot.todayDealsMeta, todayDeals: [] });
      return;
    }
    try {
      const data = await apiFetch('/today-deals');
      if (data.ok && window.applyTodayDealsData) {
        window.applyTodayDealsData({
          todayDealsMeta: data.meta,
          todayDeals: data.products || [],
        });
      }
    } catch (_) {}
  }

  async function applyBootstrap(boot) {
    if (!boot?.ok) return false;
    window._rakuStoreBoot = boot;
    if (boot.maintenance && !(await adminCanBypassMaintenance())) {
      if (window.showMaintenancePage) window.showMaintenancePage(boot.settings);
      else location.reload();
      return true;
    }
    applySettingsData(boot.settings);
    const sliderActive = boot?.heroSideSlider?.enabled && boot?.heroSideSlider?.slides?.length;
    if (!sliderActive) applyBannersData(boot.banners || []);
    await refreshHeroSideSliderFromApi(boot);
    await refreshTodayDealsFromApi(boot);

    // Categories/stats must render even if home product rows fail later.
    document.dispatchEvent(new CustomEvent('raku:bootstrap', { detail: boot }));

    if (boot.bestSelling?.length || boot.newArrivals?.length) {
      try {
        await refreshHomeProductSections(boot);
      } catch (err) {
        console.warn('Home product sections failed', err);
      }
    } else if (homePageNeedsProductPaint()) {
      try {
        await refreshHomeProductSections(boot);
      } catch (err) {
        console.warn('Home product sections failed', err);
      }
    }
    return false;
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
    document.querySelectorAll('.js-coupon-apply').forEach((btn) => {
      if (btn._rakuBound) return;
      btn._rakuBound = true;
      btn.onclick = async () => {
        const row = btn.closest('.c-coupon-row');
        const input = row?.querySelector('.js-coupon-input');
        const code = input?.value?.trim();
        if (!code) return alert('Enter a coupon code');
        const data = await apiFetch('/cart/coupon', { method: 'POST', body: JSON.stringify({ code }) });
        if (data.ok) {
          await refreshSummariesAfterCoupon();
          alert(`Coupon ${data.code} applied!`);
        } else {
          alert(data.error || 'Invalid coupon');
        }
      };
    });
    document.querySelectorAll('.js-coupon-remove').forEach((btn) => {
      if (btn._rakuBound) return;
      btn._rakuBound = true;
      btn.onclick = async () => {
        const data = await apiFetch('/cart/coupon', { method: 'DELETE' });
        if (data.ok) await refreshSummariesAfterCoupon();
      };
    });
  }

  let storefrontBootstrapStarted = false;

  function flushPendingRelatedProduct() {
    if (!window._rakuPendingRelatedProduct) return;
    const pending = window._rakuPendingRelatedProduct;
    delete window._rakuPendingRelatedProduct;
    void window._rakuEnhanceProductPageRelated?.(pending);
  }

  async function runStorefrontBootstrap() {
    if (storefrontBootstrapStarted) return;
    storefrontBootstrapStarted = true;

    patchCheckoutForm();
    bindCheckout();
    bindTrackOrderModal();
    bindCouponApply();
    hookNavigation();

    const pathParts = (location.pathname || '/').split('/').filter(Boolean);
    const isHome = pathParts.length === 0;
    const onCart = /^\/cart\/?$/.test(location.pathname);
    const onCheckout = /^\/checkout\/?$/.test(location.pathname);

    const scheduleSessionSync = () => {
      const run = () => {
        void syncCartBadge();
        void syncWishlist();
      };
      if (window.rakuScheduleIdle) {
        window.rakuScheduleIdle(run, { timeout: 4500 });
      } else {
        setTimeout(run, 800);
      }
    };

    if (onCart || onCheckout) {
      void syncCartBadge();
      void syncWishlist();
    } else {
      scheduleSessionSync();
    }

    // Start loading homepage products immediately (do not wait for bootstrap).
    const homeProductsPromise = isHome
      ? refreshHomeProductSections(window.__RAKU_BOOTSTRAP)
      : Promise.resolve();

    // Reload-safe: paint /product, /category, etc. before bootstrap (uses __RAKU_PRELOAD_PRODUCT)
    if (!isHome && window._rakuRestoreRoute && !window._rakuDidInitialRouteRestore) {
      window._rakuDidInitialRouteRestore = true;
      try {
        await window._rakuRestoreRoute();
      } catch (err) {
        console.warn('Route restore failed', err);
      }
    }

    const boot = window.__RAKU_BOOTSTRAP;
    let blocked = false;
    if (boot) blocked = await applyBootstrap(boot);
    else {
      try {
        blocked = await applyBootstrap(await apiFetch('/bootstrap'));
      } catch (_) {
        await loadStoreSettings();
        await Promise.all([
          loadHeroSection(),
          refreshHomeProductSections(null),
          refreshHeroSideSliderFromApi(null),
          refreshTodayDealsFromApi(null),
        ]);
      }
    }
    if (blocked) return;

    await homeProductsPromise;

    if (isHome && homePageNeedsProductPaint()) {
      try {
        await refreshHomeProductSections(window._rakuStoreBoot || window.__RAKU_BOOTSTRAP);
      } catch (err) {
        console.warn('Home product retry failed', err);
      }
    }

    if (isHome) {
      setTimeout(() => {
        if (!homePageNeedsProductPaint()) return;
        void refreshHomeProductSections(window._rakuStoreBoot || window.__RAKU_BOOTSTRAP);
      }, 3000);
    }

    bindHomeScrollResize();
    if (typeof queueSyncAllHomeScrollCardWidths === 'function') {
      queueSyncAllHomeScrollCardWidths();
    } else {
      syncAllHomeScrollCardWidths();
    }

    if (isHome && window.showPage) window.showPage('home', { skipUrl: true, skipScroll: true });

    bindCategoryFilterEvents();

    const sessionTasks = [];
    if (onCart) sessionTasks.push(renderCart());
    if (onCheckout) sessionTasks.push(renderCheckout());
    if (sessionTasks.length) void Promise.all(sessionTasks);

    window._rakuRestoreScrollPosition?.();

    if (window.requestIdleCallback) {
      requestIdleCallback(() => prefillReviewName(), { timeout: 3000 });
      requestIdleCallback(() => {
        if (window._rakuPrefetchAppointment) window._rakuPrefetchAppointment();
        if (window._rakuPrefetchFaqs) window._rakuPrefetchFaqs();
      }, { timeout: 2500 });
    } else {
      setTimeout(() => prefillReviewName(), 200);
      setTimeout(() => {
        if (window._rakuPrefetchAppointment) window._rakuPrefetchAppointment();
        if (window._rakuPrefetchFaqs) window._rakuPrefetchFaqs();
      }, 800);
    }
  }

  function onRakuReady() {
    void runStorefrontBootstrap();
  }

  document.addEventListener('raku:ready', onRakuReady);
  if (window.__RAKU_READY__) onRakuReady();

  flushPendingRelatedProduct();
})();
