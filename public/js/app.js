(function () {
  const SCROLL_KEY = 'raku_scroll_pos';

  function rakuScrollToTop(behavior) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mode = behavior || (reduce ? 'auto' : 'auto');
    window.scrollTo({ top: 0, left: 0, behavior: mode });
  }

  function scrollStoragePath() {
    return `${location.pathname || '/'}${location.search || ''}`;
  }

  function saveScrollPosition() {
    try {
      sessionStorage.setItem(
        SCROLL_KEY,
        JSON.stringify({
          x: window.scrollX || 0,
          y: window.scrollY || document.documentElement.scrollTop || 0,
          path: scrollStoragePath(),
        })
      );
    } catch (_) {}
  }

  function readScrollPosition() {
    try {
      const raw = sessionStorage.getItem(SCROLL_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.path !== scrollStoragePath()) return null;
      return data;
    } catch (_) {
      return null;
    }
  }

  function shouldRestoreScrollOnLoad() {
    const nav = performance.getEntriesByType?.('navigation')?.[0];
    if (nav) return nav.type === 'reload';
    return performance.navigation?.type === 1;
  }

  function restoreScrollPosition() {
    if (!shouldRestoreScrollOnLoad()) return;
    const saved = readScrollPosition();
    if (!saved) return;

    let attempts = 0;
    const maxAttempts = 20;
    const tick = () => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const target = Math.min(Math.max(0, Number(saved.y) || 0), maxScroll);
      window.scrollTo({ top: target, left: Number(saved.x) || 0, behavior: 'auto' });
      const done = Math.abs(window.scrollY - target) < 6 || attempts >= maxAttempts;
      if (done) return;
      attempts += 1;
      requestAnimationFrame(() => setTimeout(tick, 150));
    };
    tick();
    window.addEventListener('load', tick, { once: true });
    document.addEventListener('raku:bootstrap', () => setTimeout(tick, 80), { once: true });
  }

  let scrollSaveTimer;
  window.addEventListener(
    'scroll',
    () => {
      clearTimeout(scrollSaveTimer);
      scrollSaveTimer = setTimeout(saveScrollPosition, 120);
    },
    { passive: true }
  );
  window.addEventListener('pagehide', saveScrollPosition);
  window.addEventListener('beforeunload', saveScrollPosition);

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  window.rakuScrollToTop = rakuScrollToTop;
  window._rakuSaveScrollPosition = saveScrollPosition;
  window._rakuRestoreScrollPosition = restoreScrollPosition;
})();

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
    about: document.getElementById('page-about'),
    contact: document.getElementById('page-contact'),
    privacy: document.getElementById('page-privacy'),
    terms: document.getElementById('page-terms'),
    return: document.getElementById('page-return'),
    preorder: document.getElementById('page-preorder'),
    points: document.getElementById('page-points'),
    track: document.getElementById('page-track'),
    blog: document.getElementById('page-blog'),
  };

  const PAGE_NAMES = ['home', 'category', 'product', 'cart', 'checkout', 'success', 'account', 'wishlist', 'appointment', 'faq', 'blog', 'about', 'contact', 'privacy', 'terms', 'return', 'preorder', 'points', 'track'];

  const PATH_ALIASES = {
    'about-us': 'about',
    'privacy-policy': 'privacy',
    'terms-and-conditions': 'terms',
    'return-policy': 'return',
    'pre-order-policy': 'preorder',
    'reward-point-policy': 'points',
  };

  const PAGE_PATHS = {
    about: '/about',
    privacy: '/privacy-policy',
    terms: '/terms-and-conditions',
    return: '/return-policy',
    preorder: '/pre-order-policy',
    points: '/reward-point-policy',
  };

  // Show target route immediately (content fills via bootstrap / API)
  const initialRoute = (function parseInitial() {
    if (window.__RAKU_INITIAL_PAGE && PAGE_NAMES.includes(window.__RAKU_INITIAL_PAGE)) {
      const route = { page: window.__RAKU_INITIAL_PAGE };
      if (window.__RAKU_INITIAL_PAGE === 'blog' && window.__RAKU_BLOG_SLUG) {
        route.blogSlug = String(window.__RAKU_BLOG_SLUG);
      }
      return route;
    }
    const parts = (location.pathname || '/').split('/').filter(Boolean);
    if (!parts.length) return { page: 'home' };
    const [page, param] = parts;
    if (page === 'product' && param) {
      const decoded = decodeURIComponent(param);
      if (/^\d+$/.test(decoded)) return { page: 'product', productId: Number(decoded) };
      return { page: 'product', productSlug: decoded };
    }
    if (page === 'category' && param) return { page: 'category', categorySlug: decodeURIComponent(param) };
    if (page === 'blog') {
      if (param) return { page: 'blog', blogSlug: decodeURIComponent(param) };
      return { page: 'blog' };
    }
    if (PATH_ALIASES[page]) return { page: PATH_ALIASES[page] };
    if (PAGE_NAMES.includes(page)) return { page };
    return { page: 'home' };
  })();

  Object.entries(pages).forEach(([name, el]) => {
    if (el) el.style.display = name === initialRoute.page ? 'block' : 'none';
  });
  syncPageA11y(initialRoute.page);
  updateHeaderNavActive(initialRoute.page);

  try {
    const refParam = new URLSearchParams(location.search).get('ref');
    if (refParam && window._rakuStoreReferralCode) {
      window._rakuStoreReferralCode(refParam);
    } else if (refParam) {
      localStorage.setItem('raku_referral_code', refParam.trim().toUpperCase());
    }
  } catch (_) {}

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
    if (name === 'blog') {
      if (opts.blogSlug) return `/blog/${encodeURIComponent(opts.blogSlug)}`;
      return '/blog';
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
    if (page === 'blog') {
      if (param) return { page: 'blog', blogSlug: decodeURIComponent(param) };
      return { page: 'blog' };
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
      blog: '/blog',
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

  function syncPageA11y(visibleName) {
    Object.entries(pages).forEach(([name, el]) => {
      if (!el) return;
      const visible = name === visibleName;
      el.setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (visible) el.removeAttribute('inert');
      else el.setAttribute('inert', '');
    });
  }

  async function ensureBlogReady() {
    if (window._rakuInitBlogPage) return true;
    if (window.rakuEnsureRouteAssets) {
      try {
        await window.rakuEnsureRouteAssets('blog');
      } catch (_) {}
    }
    if (window._rakuInitBlogPage) return true;
    if (document.querySelector('script[src*="/js/blog.js"]')) {
      await new Promise((resolve) => {
        const started = Date.now();
        const tick = () => {
          if (window._rakuInitBlogPage) return resolve(true);
          if (Date.now() - started > 4000) return resolve(false);
          setTimeout(tick, 50);
        };
        tick();
      });
      return Boolean(window._rakuInitBlogPage);
    }
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = '/js/blog.js?v=3';
      script.defer = true;
      script.onload = () => resolve(Boolean(window._rakuInitBlogPage));
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  async function runPageInits(name) {
    if (name === 'appointment' && window._rakuInitAppointmentPage) {
      window._rakuInitAppointmentPage();
    }
    if (name === 'faq' && window._rakuInitFaqPage) {
      window._rakuInitFaqPage();
    }
    if (name === 'blog') {
      await ensureBlogReady();
      if (window._rakuInitBlogPage) {
        const parts = (location.pathname || '').split('/').filter(Boolean);
        const slug = parts[0] === 'blog' && parts[1] ? decodeURIComponent(parts[1]) : null;
        window._rakuInitBlogPage(slug);
      }
      return;
    }
    if (name === 'about' && window._rakuInitAboutPage) {
      window._rakuInitAboutPage();
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
    if (name === 'preorder' && window._rakuInitLegalPreorder) {
      window._rakuInitLegalPreorder();
    }
    if (name === 'points' && window._rakuInitLegalPoints) {
      window._rakuInitLegalPoints();
    }
    if (name === 'track' && window._rakuInitTrackPage) {
      window._rakuInitTrackPage();
    }
    if (name === 'home' && window._rakuRefreshHomeRecommendations) {
      window._rakuRefreshHomeRecommendations();
    }
    if (name === 'cart' && window.renderCart) {
      void window.renderCart();
    }
    if (name === 'checkout' && window.renderCheckout) {
      void window.renderCheckout();
    }
    if (name === 'account' && window._rakuInitAccountPage) {
      void window._rakuInitAccountPage();
    }
  }

  function showPage(name, opts) {
    if (typeof opts !== 'object' || opts === null) opts = {};
    window._rakuVisiblePage = name;
    if (window._rakuCloseMobileCatMenu) window._rakuCloseMobileCatMenu();
    if (!opts.skipScroll) {
      rakuScrollToTop('auto');
    }
    Object.values(pages).forEach((p) => {
      if (p) p.style.display = 'none';
    });
    if (pages[name]) pages[name].style.display = 'block';
    syncPageA11y(name);
    const catNav = document.getElementById('global-cat-nav');
    if (catNav) catNav.style.display = 'none';
    updateHeaderNavActive(name);
    const skipUrl = opts.skipHash || opts.skipUrl;
    if (!skipUrl) {
      const path = buildPath(name, opts);
      if (location.pathname !== path) {
        history.pushState({ page: name, ...opts }, '', path);
      }
    }
    if (window.RakuSEO) {
      window.RakuSEO.onNavigate(name, opts);
    }
    document.dispatchEvent(new CustomEvent('raku:navigate', { detail: { page: name } }));

    const finish = () => {
      void runPageInits(name);
    };
    const assets = window.rakuEnsureRouteAssets ? window.rakuEnsureRouteAssets(name) : Promise.resolve();
    assets.then(finish).catch(finish);
  }

  async function restoreFromUrl() {
    const route = parsePath();
    routeRestoring = true;
    showPage(route.page, { ...route, skipUrl: true, skipScroll: true });
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
      } else if (route.page === 'blog' && window._rakuInitBlogPage) {
        window._rakuInitBlogPage(route.blogSlug || null);
      } else if (route.page === 'about' && window._rakuInitAboutPage) {
        window._rakuInitAboutPage();
      } else if (route.page === 'contact' && window._rakuInitContactPage) {
        window._rakuInitContactPage();
      } else if (route.page === 'privacy' && window._rakuInitLegalPrivacy) {
        window._rakuInitLegalPrivacy();
      } else if (route.page === 'terms' && window._rakuInitLegalTerms) {
        window._rakuInitLegalTerms();
      } else if (route.page === 'return' && window._rakuInitLegalReturn) {
        window._rakuInitLegalReturn();
      } else if (route.page === 'preorder' && window._rakuInitLegalPreorder) {
        window._rakuInitLegalPreorder();
      } else if (route.page === 'points' && window._rakuInitLegalPoints) {
        window._rakuInitLegalPoints();
      } else if (route.page === 'track' && window._rakuInitTrackPage) {
        window._rakuInitTrackPage();
      }
    } catch (err) {
      console.warn('Route restore failed', err);
    }
    window._rakuRestoreScrollPosition?.();
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
  // Restore deep links once navigation helpers exist (before raku:ready in index.ejs).
  const bootPathParts = (location.pathname || '/').split('/').filter(Boolean);
  if (bootPathParts.length && !window._rakuDidInitialRouteRestore) {
    window._rakuDidInitialRouteRestore = true;
    void restoreFromUrl();
  }
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

  document.querySelectorAll('.nav-cart-btn').forEach((btn) => {
    if (btn._rakuNavBound) return;
    btn._rakuNavBound = true;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window._rakuOpenCart === 'function') {
        window._rakuOpenCart();
      } else if (window.showPage) {
        window.showPage('cart');
      } else {
        window.location.href = '/cart';
      }
    });
  });

  ['nav-account-btn', 'nav-account-btn-desktop'].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn || btn._rakuAccountNavBound) return;
    btn._rakuAccountNavBound = true;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.openAccount === 'function') {
        void window.openAccount();
      } else if (window.showPage) {
        window.showPage('account');
      } else {
        window.location.href = '/account';
      }
    });
  });

  // Home product cards — handled by api.js (bindProductGridEvents)

  // Logo → home
  document.querySelectorAll('.site-logo-link').forEach(l => {
    l.addEventListener('click', e => { e.preventDefault(); showPage('home'); });
  });

  // ===== PRODUCT PAGE EVENTS =====

  // Add to cart / buy now handled by api.js (bindProductActions on product page)

  // Product gallery thumbnails — handled by api.js (paintProductGallery)

  // Product page qty — cart qty handled by api.js (bindCartEvents)
  document.querySelectorAll('#page-product .qty-btn').forEach((btn) => {
    btn.addEventListener('click', function () {
      const input = this.parentElement.querySelector('.qty-input');
      if (!input) return;
      const max = window._rakuProductStockMax ? window._rakuProductStockMax() : 99;
      let v = parseInt(input.value, 10) || 1;
      if (this.dataset.dir === 'up') v = Math.min(v + 1, max);
      else v = Math.max(v - 1, 1);
      input.value = String(v);
      if (window._rakuUpdateProductRewardPoints) window._rakuUpdateProductRewardPoints(v);
    });
  });

  // Product page tabs
  document.querySelectorAll('#page-product .tab-btn').forEach((btn) => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#page-product .tab-btn').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('#page-product .tab-pane').forEach((p) => {
        p.hidden = true;
      });
      this.classList.add('active');
      this.setAttribute('aria-selected', 'true');
      const target = document.getElementById(this.dataset.tab);
      if (target) target.hidden = false;
    });
  });

  // Related product cards on product page → stay on product page (scroll top)
  document.querySelectorAll('#page-product .product-card').forEach(card => {
    card.addEventListener('click', function(e) {
      if (e.target.closest('.add-cart-btn') || e.target.closest('.preorder-btn') || e.target.closest('.prod-wish')) return;
      window.rakuScrollToTop();
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

  // Track order on success page — handled by api.js (bindTrackOrderModal)

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
        if (window._rakuOpenMobileCatMenu && window._rakuCloseMobileCatMenu) {
          const mobileCatMenu = document.getElementById('mobile-cat-menu');
          if (mobileCatMenu?.classList.contains('open')) window._rakuCloseMobileCatMenu();
          else window._rakuOpenMobileCatMenu();
        }
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
        '/blog': 'blog',
        '/about': 'about',
        '/contact': 'contact',
        '/track': 'track',
      };
      if (href.startsWith('/blog/') && window.showPage && !window.RAKU_STANDALONE) {
        e.preventDefault();
        showPage('blog', { blogSlug: decodeURIComponent(href.slice('/blog/'.length)) });
        closeCatDropdown();
        return;
      }
      if (spaRoutes[href] && window.showPage && !window.RAKU_STANDALONE) {
        e.preventDefault();
        showPage(spaRoutes[href]);
        closeCatDropdown();
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCatDropdown();
  });

  const SPA_INIT = {
    faq: () => window._rakuInitFaqPage?.(),
    blog: () => window._rakuInitBlogPage?.(initialRoute.blogSlug || null),
    about: () => window._rakuInitAboutPage?.(),
    contact: () => window._rakuInitContactPage?.(),
    appointment: () => window._rakuInitAppointmentPage?.(),
    privacy: () => window._rakuInitLegalPrivacy?.(),
    terms: () => window._rakuInitLegalTerms?.(),
    return: () => window._rakuInitLegalReturn?.(),
    preorder: () => window._rakuInitLegalPreorder?.(),
    points: () => window._rakuInitLegalPoints?.(),
    track: () => window._rakuInitTrackPage?.(),
  };
  setTimeout(async () => {
    if (initialRoute.page === 'blog') {
      await ensureBlogReady();
      window._rakuInitBlogPage?.(initialRoute.blogSlug || null);
      return;
    }
    if (initialRoute.page === 'account') {
      void window._rakuInitAccountPage?.();
      return;
    }
    SPA_INIT[initialRoute.page]?.();
  }, 0);
}); // end DOMContentLoaded