document.addEventListener('DOMContentLoaded', function() {
  // Redirect old hash URLs (#/account) to clean paths (/account)
  if (location.hash && location.hash.startsWith('#/')) {
    const path = location.hash.slice(1) || '/';
    history.replaceState(null, '', path);
  } else if (location.hash && location.hash.length > 1) {
    history.replaceState(null, '', '/' + location.hash.slice(1));
  }

  // ===== PAGE NAVIGATION =====
  const pages = {
    home: document.getElementById('page-home'),
    category: document.getElementById('page-category'),
    product: document.getElementById('page-product'),
    cart: document.getElementById('page-cart'),
    checkout: document.getElementById('page-checkout'),
    success: document.getElementById('page-success'),
    account: document.getElementById('page-account'),
    wishlist: document.getElementById('page-wishlist'),
  };

  // Hide all pages until route is restored (avoids home flash on reload)
  Object.values(pages).forEach((p) => {
    if (p) p.style.display = 'none';
  });

  const PAGE_NAMES = ['home', 'category', 'product', 'cart', 'checkout', 'success', 'account', 'wishlist'];
  let routeRestoring = false;

  function buildPath(name, opts = {}) {
    if (name === 'home') return '/';
    if (name === 'product' && opts.productId) return `/product/${opts.productId}`;
    if (name === 'category' && opts.categorySlug) {
      return `/category/${encodeURIComponent(opts.categorySlug)}`;
    }
    return `/${name}`;
  }

  function parsePath() {
    const parts = (location.pathname || '/').split('/').filter(Boolean);
    if (!parts.length) return { page: 'home' };
    const [page, param] = parts;
    if (page === 'product' && param) {
      return { page: 'product', productId: Number(param) };
    }
    if (page === 'category' && param) {
      return { page: 'category', categorySlug: decodeURIComponent(param) };
    }
    if (PAGE_NAMES.includes(page)) return { page };
    return { page: 'home' };
  }

  function showPage(name, opts) {
    if (typeof opts !== 'object' || opts === null) opts = {};
    Object.values(pages).forEach((p) => {
      if (p) p.style.display = 'none';
    });
    if (pages[name]) pages[name].style.display = 'block';
    const catNav = document.getElementById('global-cat-nav');
    if (catNav) {
      catNav.style.display = name === 'home' || name === 'category' || name === 'account' ? '' : 'none';
    }
    const skipUrl = opts.skipHash || opts.skipUrl;
    if (!skipUrl) {
      const path = buildPath(name, opts);
      if (location.pathname !== path) {
        history.pushState({ page: name, ...opts }, '', path);
      }
    }
    window.scrollTo(0, 0);
  }

  async function restoreFromUrl() {
    const route = parsePath();
    routeRestoring = true;
    showPage(route.page, { ...route, skipUrl: true });
    routeRestoring = false;

    try {
      if (route.page === 'product' && route.productId && window.openProduct) {
        await window.openProduct(route.productId, { skipUrl: true });
      } else if (route.page === 'category' && route.categorySlug && window.openCategory) {
        await window.openCategory(route.categorySlug, { skipUrl: true });
      } else if (route.page === 'cart' && window.renderCart) {
        await window.renderCart();
      } else if (route.page === 'checkout' && window.renderCheckout) {
        await window.renderCheckout();
      } else if (route.page === 'wishlist' && window.openWishlist) {
        await window.openWishlist();
      } else if (route.page === 'account' && window.openAccount) {
        window.openAccount();
      }
    } catch (err) {
      console.warn('Route restore failed', err);
    }
  }

  window.addEventListener('popstate', () => {
    if (!routeRestoring) restoreFromUrl();
  });

  // ===== HOME PAGE EVENTS =====

  // ===== CATEGORY FILTER =====
  window.filterCategory = function(cat, btn) {
    if (cat !== 'all' && window.openCategory) {
      window.openCategory(cat);
      return;
    }

    // update active tab
    document.querySelectorAll('.cat-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const grid = document.getElementById('main-product-grid');
    if (!grid) return;

    const cards = grid.querySelectorAll('.product-card[data-cat]');
    cards.forEach(card => {
      if (cat === 'all' || card.dataset.cat === cat) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });

    const titleMap = {
      all: 'Popular Products',
      electronics: '📱 Electronics',
      fashion: '👗 Fashion',
      beauty: '💄 Beauty & Care',
      home: '🏠 Home & Living',
      sports: '⚽ Sports',
      books: '📚 Books & Education',
      kids: '🧸 Kids',
      auto: '🚗 Automotive',
    };
    const titleEl = document.getElementById('products-section-title');
    if (titleEl) titleEl.textContent = titleMap[cat] || 'Products';
  };

  // Category nav & cards wired by storefront-dynamic.js from API

  document.querySelectorAll('.cat-breadcrumb .link[data-page="home"]').forEach(el => {
    el.addEventListener('click', () => showPage('home'));
  });

  // Cart & wishlist counts (synced from API via api.js)
  let cartCount = 0;
  let wishCount = 0;
  function updateBadges() {
    document.querySelectorAll('.cart-badge').forEach((b) => {
      b.textContent = cartCount;
    });
    document.querySelectorAll('.wish-badge').forEach((b) => {
      b.textContent = wishCount;
      b.hidden = wishCount === 0;
    });
  }
  window.showPage = showPage;
  window._rakuRestoreRoute = restoreFromUrl;
  window._rakuSetCartCount = function (n) {
    cartCount = n;
    updateBadges();
  };
  window._rakuSetWishCount = function (n) {
    wishCount = n;
    updateBadges();
  };
  window._rakuGetCartCount = function () {
    return cartCount;
  };

  // Add to cart buttons (home product grid)
  document.querySelectorAll('.add-cart-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      cartCount++;
      updateBadges();
      this.style.background = '#3B6D11';
      this.innerHTML = '<i class="ti ti-check"></i>';
      const self = this;
      setTimeout(() => {
        self.style.background = '';
        self.innerHTML = '<i class="ti ti-shopping-cart-plus"></i>';
      }, 1200);
    });
  });

  // Product card click → product page
  document.querySelectorAll('#page-home .product-card').forEach(card => {
    card.addEventListener('click', function(e) {
      if (e.target.closest('.add-cart-btn') || e.target.closest('.prod-wish')) return;
      showPage('product');
    });
  });

  // Nav cart icon → cart
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.querySelector('.ti-shopping-cart')) {
      btn.addEventListener('click', e => { e.preventDefault(); showPage('cart'); });
    }
  });

  // Logo → home
  document.querySelectorAll('.site-logo-link').forEach(l => {
    l.addEventListener('click', e => { e.preventDefault(); showPage('home'); });
  });

  // ===== PRODUCT PAGE EVENTS =====

  // Add to cart main button
  const btnAddMain = document.getElementById('btn-add-to-cart-main');
  if (btnAddMain) btnAddMain.addEventListener('click', () => { cartCount++; updateBadges(); showPage('cart'); });

  const btnBuyNow = document.getElementById('btn-buy-now');
  if (btnBuyNow) {
    btnBuyNow.addEventListener('click', async () => {
      if (window.openCheckoutModal) await window.openCheckoutModal();
      else showPage('checkout');
    });
  }

  // Thumbnail click
  document.querySelectorAll('.thumb-img').forEach(thumb => {
    thumb.addEventListener('click', function() {
      document.querySelectorAll('.thumb-img').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      const main = document.querySelector('.main-product-img');
      if (main) main.style.background = this.style.background;
    });
  });

  // Qty +/- (all qty controls)
  document.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const input = this.parentElement.querySelector('.qty-input');
      let v = parseInt(input.value) || 1;
      if (this.dataset.dir === 'up') v = Math.min(v + 1, 99);
      else v = Math.max(v - 1, 1);
      input.value = v;
      updateCartTotals();
    });
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
      this.classList.add('active');
      const target = document.getElementById(this.dataset.tab);
      if (target) target.style.display = 'block';
    });
  });

  // Related product cards on product page → stay on product page (scroll top)
  document.querySelectorAll('#page-product .product-card').forEach(card => {
    card.addEventListener('click', function(e) {
      if (e.target.closest('.add-cart-btn') || e.target.closest('.prod-wish')) return;
      window.scrollTo(0, 0);
    });
  });

  // ===== CART PAGE EVENTS (checkout/render handled by api.js) =====

  const btnCartContinue = document.getElementById('btn-cart-continue');
  if (btnCartContinue) btnCartContinue.addEventListener('click', () => showPage('home'));

  const btnCartEmptyShop = document.getElementById('btn-cart-empty-shop');
  if (btnCartEmptyShop) btnCartEmptyShop.addEventListener('click', () => showPage('home'));

  const btnCartBrowseCats = document.getElementById('btn-cart-browse-cats');
  if (btnCartBrowseCats) {
    btnCartBrowseCats.addEventListener('click', () => {
      if (window.openCategory) window.openCategory('all');
      else showPage('home');
    });
  }

  // ===== CHECKOUT PAGE EVENTS =====

  // Payment method card selection
  document.querySelectorAll('.pay-method-card').forEach(card => {
    card.addEventListener('click', function() {
      document.querySelectorAll('.pay-method-card').forEach(c => c.classList.remove('selected'));
      this.classList.add('selected');
      const radio = this.querySelector('input[type=radio]');
      if (radio) radio.checked = true;
      // toggle sub-forms
      document.querySelectorAll('.pay-sub-form').forEach(f => f.style.display = 'none');
      const m = this.dataset.method;
      const subForm = document.getElementById('form-' + m);
      if (subForm) subForm.style.display = 'block';
      // update check indicator
      document.querySelectorAll('.pay-method-check').forEach(ch => {
        ch.style.background = '';
        ch.style.borderColor = '';
        ch.innerHTML = '';
      });
      const myCheck = this.querySelector('.pay-method-check');
      if (myCheck) {
        myCheck.style.background = 'var(--primary)';
        myCheck.style.borderColor = 'var(--primary)';
        myCheck.innerHTML = '<div style="width:8px;height:8px;border-radius:50%;background:#fff;margin:auto;"></div>';
      }
    });
  });

  // Order placement handled by api.js (MySQL)

  // ===== SUCCESS PAGE EVENTS =====

  const btnSuccessHome = document.getElementById('btn-success-home');
  if (btnSuccessHome) btnSuccessHome.addEventListener('click', () => {
    cartCount = 0;
    updateBadges();
    showPage('home');
  });

  const btnTrackOrder = document.getElementById('btn-track-order');
  if (btnTrackOrder) btnTrackOrder.addEventListener('click', () => {
    if (window.openAccount) window.openAccount();
    else showPage('home');
  });

  document.dispatchEvent(new CustomEvent('raku:ready'));
}); // end DOMContentLoaded