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
    appointment: document.getElementById('page-appointment'),
    faq: document.getElementById('page-faq'),
    contact: document.getElementById('page-contact'),
    privacy: document.getElementById('page-privacy'),
    terms: document.getElementById('page-terms'),
    return: document.getElementById('page-return'),
    track: document.getElementById('page-track'),
  };

  const PAGE_NAMES = ['home', 'category', 'product', 'cart', 'checkout', 'success', 'account', 'wishlist', 'appointment', 'faq', 'contact', 'privacy', 'terms', 'return', 'track'];

  const PATH_ALIASES = {
    'privacy-policy': 'privacy',
    'terms-and-conditions': 'terms',
    'return-policy': 'return',
  };

  const PAGE_PATHS = {
    privacy: '/privacy-policy',
    terms: '/terms-and-conditions',
    return: '/return-policy',
  };

  // Show target route immediately (content fills via bootstrap / API)
  const initialRoute = (function parseInitial() {
    const parts = (location.pathname || '/').split('/').filter(Boolean);
    if (!parts.length) return { page: 'home' };
    const [page, param] = parts;
    if (page === 'product' && param) {
      const decoded = decodeURIComponent(param);
      if (/^\d+$/.test(decoded)) return { page: 'product', productId: Number(decoded) };
      return { page: 'product', productSlug: decoded };
    }
    if (page === 'category' && param) return { page: 'category', categorySlug: decodeURIComponent(param) };
    if (PATH_ALIASES[page]) return { page: PATH_ALIASES[page] };
    if (PAGE_NAMES.includes(page)) return { page };
    return { page: 'home' };
  })();

  Object.entries(pages).forEach(([name, el]) => {
    if (el) el.style.display = name === initialRoute.page ? 'block' : 'none';
  });
  updateHeaderNavActive(initialRoute.page);

  let routeRestoring = false;

  function buildPath(name, opts = {}) {
    if (name === 'home') return '/';
    if (name === 'product') {
      if (opts.productSlug) return `/product/${encodeURIComponent(opts.productSlug)}`;
      if (opts.productId) return `/product/${opts.productId}`;
    }
    if (name === 'category' && opts.categorySlug) {
      return `/category/${encodeURIComponent(opts.categorySlug)}`;
    }
    if (PAGE_PATHS[name]) return PAGE_PATHS[name];
    return `/${name}`;
  }

  function parsePath() {
    const parts = (location.pathname || '/').split('/').filter(Boolean);
    if (!parts.length) return { page: 'home' };
    const [page, param] = parts;
    if (page === 'product' && param) {
      const decoded = decodeURIComponent(param);
      if (/^\d+$/.test(decoded)) return { page: 'product', productId: Number(decoded) };
      return { page: 'product', productSlug: decoded };
    }
    if (page === 'category' && param) {
      return { page: 'category', categorySlug: decodeURIComponent(param) };
    }
    if (PATH_ALIASES[page]) return { page: PATH_ALIASES[page] };
    if (PAGE_NAMES.includes(page)) return { page };
    return { page: 'home' };
  }

  function updateHeaderNavActive(pageName) {
    const hrefMap = {
      home: '/',
      appointment: '/appointment',
      faq: '/faq',
      contact: '/contact',
      track: '/track',
    };
    const activeHref = hrefMap[pageName] || null;
    document.querySelectorAll('.navbar-main-link').forEach((link) => {
      link.classList.toggle('is-active', activeHref && link.getAttribute('href') === activeHref);
    });
    document.querySelectorAll('.mobile-cat-menu-extra .mobile-cat-link').forEach((link) => {
      link.classList.toggle('active', activeHref && link.getAttribute('href') === activeHref);
    });
  }

  function showPage(name, opts) {
    if (typeof opts !== 'object' || opts === null) opts = {};
    Object.values(pages).forEach((p) => {
      if (p) p.style.display = 'none';
    });
    if (pages[name]) pages[name].style.display = 'block';
    const catNav = document.getElementById('global-cat-nav');
    if (catNav) catNav.style.display = 'none';
    if (name === 'appointment' && window._rakuInitAppointmentPage) {
      window._rakuInitAppointmentPage();
    }
    if (name === 'faq' && window._rakuInitFaqPage) {
      window._rakuInitFaqPage();
    }
    if (name === 'contact' && window._rakuInitContactPage) {
      window._rakuInitContactPage();
    }
    if (name === 'privacy' && window._rakuInitLegalPrivacy) {
      window._rakuInitLegalPrivacy();
    }
    if (name === 'terms' && window._rakuInitLegalTerms) {
      window._rakuInitLegalTerms();
    }
    if (name === 'return' && window._rakuInitLegalReturn) {
      window._rakuInitLegalReturn();
    }
    if (name === 'track' && window._rakuInitTrackPage) {
      window._rakuInitTrackPage();
    }
    if (name === 'home' && window._rakuRefreshHomeRecommendations) {
      window._rakuRefreshHomeRecommendations();
    }
    updateHeaderNavActive(name);
    const skipUrl = opts.skipHash || opts.skipUrl;
    if (!skipUrl) {
      const path = buildPath(name, opts);
      if (location.pathname !== path) {
        history.pushState({ page: name, ...opts }, '', path);
      }
    }
    window.scrollTo(0, 0);
    if (window.RakuSEO) {
      window.RakuSEO.onNavigate(name, opts);
    }
    if (name === 'cart' && window.renderCart) {
      void window.renderCart();
    }
    if (name === 'checkout' && window.renderCheckout) {
      void window.renderCheckout();
    }
    document.dispatchEvent(new CustomEvent('raku:navigate', { detail: { page: name } }));
  }

  async function restoreFromUrl() {
    const route = parsePath();
    routeRestoring = true;
    showPage(route.page, { ...route, skipUrl: true });
    routeRestoring = false;

    try {
      if (route.page === 'product' && window.openProduct) {
        if (route.productSlug) await window.openProduct(route.productSlug, { skipUrl: true });
        else if (route.productId) await window.openProduct(route.productId, { skipUrl: true });
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
      } else if (route.page === 'appointment' && window._rakuInitAppointmentPage) {
        window._rakuInitAppointmentPage();
      } else if (route.page === 'faq' && window._rakuInitFaqPage) {
        window._rakuInitFaqPage();
      } else if (route.page === 'contact' && window._rakuInitContactPage) {
        window._rakuInitContactPage();
      } else if (route.page === 'privacy' && window._rakuInitLegalPrivacy) {
        window._rakuInitLegalPrivacy();
      } else if (route.page === 'terms' && window._rakuInitLegalTerms) {
        window._rakuInitLegalTerms();
      } else if (route.page === 'return' && window._rakuInitLegalReturn) {
        window._rakuInitLegalReturn();
      } else if (route.page === 'track' && window._rakuInitTrackPage) {
        window._rakuInitTrackPage();
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
      b.hidden = cartCount === 0;
    });
    document.querySelectorAll('.wish-badge').forEach((b) => {
      b.textContent = wishCount;
      b.hidden = wishCount === 0;
    });
  }
  window.showPage = showPage;
  window._rakuRestoreRoute = restoreFromUrl;
  window._rakuSetCartCount = function (n) {
    cartCount = Math.max(0, Number(n) || 0);
    updateBadges();
  };
  window._rakuSetWishCount = function (n) {
    wishCount = Math.max(0, Number(n) || 0);
    updateBadges();
  };
  updateBadges();
  window._rakuGetCartCount = function () {
    return cartCount;
  };

  function openCartPage() {
    if (window.showPage) window.showPage('cart');
    else window.location.href = '/cart';
    if (window.renderCart) {
      window.renderCart().catch((err) => console.warn('renderCart failed', err));
    }
  }
  window._rakuOpenCart = openCartPage;

  document.querySelectorAll('.nav-cart-btn').forEach((btn) => {
    if (btn._rakuNavBound) return;
    btn._rakuNavBound = true;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openCartPage();
    });
  });

  // Add to cart on home grid — handled by api.js (bindProductGridEvents)

  // Product card click → product page
  document.querySelectorAll('#page-home .product-card').forEach(card => {
    card.addEventListener('click', function(e) {
      if (e.target.closest('.add-cart-btn') || e.target.closest('.preorder-btn') || e.target.closest('.prod-wish')) return;
      showPage('product');
    });
  });

  // Logo → home
  document.querySelectorAll('.site-logo-link').forEach(l => {
    l.addEventListener('click', e => { e.preventDefault(); showPage('home'); });
  });

  // ===== PRODUCT PAGE EVENTS =====

  // Add to cart / buy now handled by api.js (bindProductActions on product page)

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
      if (e.target.closest('.add-cart-btn') || e.target.closest('.preorder-btn') || e.target.closest('.prod-wish')) return;
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

  // Mobile category menu (3-dot)
  const mobileCatMenu = document.getElementById('mobile-cat-menu');
  const mobileCatMenuBtn = document.getElementById('nav-mobile-menu-btn');
  const mobileCatMenuClose = document.getElementById('mobile-cat-menu-close');
  const mobileCatMenuBackdrop = document.getElementById('mobile-cat-menu-backdrop');

  function openMobileCatMenu() {
    if (!mobileCatMenu) return;
    mobileCatMenu.classList.add('open');
    mobileCatMenu.setAttribute('aria-hidden', 'false');
    if (mobileCatMenuBtn) mobileCatMenuBtn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('mobile-cat-menu-open');
  }

  function closeMobileCatMenu() {
    if (!mobileCatMenu) return;
    mobileCatMenu.classList.remove('open');
    mobileCatMenu.setAttribute('aria-hidden', 'true');
    if (mobileCatMenuBtn) mobileCatMenuBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('mobile-cat-menu-open');
  }

  window._rakuCloseMobileCatMenu = closeMobileCatMenu;

  const catDropdown = document.getElementById('header-cat-dropdown');
  const browseBtn = document.getElementById('nav-browse-cats-btn');

  function closeCatDropdown() {
    if (!catDropdown) return;
    catDropdown.hidden = true;
    if (browseBtn) browseBtn.setAttribute('aria-expanded', 'false');
  }
  window._rakuCloseCatDropdown = closeCatDropdown;

  if (browseBtn && !browseBtn._rakuBound) {
    browseBtn._rakuBound = true;
    browseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.matchMedia('(max-width: 768px)').matches) {
        if (mobileCatMenu?.classList.contains('open')) closeMobileCatMenu();
        else openMobileCatMenu();
        return;
      }
      if (!catDropdown) return;
      const willOpen = catDropdown.hidden;
      catDropdown.hidden = !willOpen;
      browseBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
  }

  document.addEventListener('click', (e) => {
    if (!catDropdown || catDropdown.hidden) return;
    if (e.target.closest('.navbar-browse-wrap') || e.target.closest('#header-cat-dropdown')) return;
    closeCatDropdown();
  });

  document.querySelectorAll('.navbar-main-link[data-nav-page]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.navPage;
      const scrollId = link.dataset.navScroll;
      if (window.showPage) window.showPage(page);
      closeCatDropdown();
      if (scrollId) {
        requestAnimationFrame(() => {
          document.getElementById(scrollId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    });
  });

  document.querySelectorAll('.navbar-main-link.navbar-main-link--plain').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      const spaRoutes = {
        '/': 'home',
        '/appointment': 'appointment',
        '/faq': 'faq',
        '/contact': 'contact',
        '/track': 'track',
      };
      if (spaRoutes[href] && window.showPage && !window.RAKU_STANDALONE) {
        e.preventDefault();
        showPage(spaRoutes[href]);
        closeCatDropdown();
      }
    });
  });

  document.querySelectorAll('.mobile-cat-menu-extra .mobile-cat-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      const spaRoutes = {
        '/': 'home',
        '/appointment': 'appointment',
        '/faq': 'faq',
        '/contact': 'contact',
        '/track': 'track',
        '/privacy-policy': 'privacy',
        '/terms-and-conditions': 'terms',
        '/return-policy': 'return',
      };
      if (spaRoutes[href] && window.showPage && !window.RAKU_STANDALONE) {
        e.preventDefault();
        closeMobileCatMenu();
        showPage(spaRoutes[href]);
      }
    });
  });

  document.querySelectorAll('.mobile-menu-group-toggle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const group = btn.closest('.mobile-menu-group');
      if (!group) return;
      const open = group.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  if (mobileCatMenuBtn && !mobileCatMenuBtn._rakuBound) {
    mobileCatMenuBtn._rakuBound = true;
    mobileCatMenuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (mobileCatMenu?.classList.contains('open')) closeMobileCatMenu();
      else openMobileCatMenu();
    });
  }
  if (mobileCatMenuClose) mobileCatMenuClose.addEventListener('click', closeMobileCatMenu);
  if (mobileCatMenuBackdrop) mobileCatMenuBackdrop.addEventListener('click', closeMobileCatMenu);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileCatMenu?.classList.contains('open')) closeMobileCatMenu();
    if (e.key === 'Escape') closeCatDropdown();
  });

  document.dispatchEvent(new CustomEvent('raku:ready'));
}); // end DOMContentLoaded