/**
 * Homepage personalized product recommendations (cart, wishlist, views, orders).
 */
(function () {
  const RECENT_PRODUCTS_KEY = 'raku_recent_products';
  const RECENT_CATEGORIES_KEY = 'raku_recent_categories';
  const MAX_RECENT_PRODUCTS = 12;
  const MAX_RECENT_CATEGORIES = 8;

  function readRecentProducts() {
    try {
      const raw = localStorage.getItem(RECENT_PRODUCTS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter((x) => x?.id) : [];
    } catch (_) {
      return [];
    }
  }

  function readRecentCategories() {
    try {
      const raw = localStorage.getItem(RECENT_CATEGORIES_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter((x) => x?.slug) : [];
    } catch (_) {
      return [];
    }
  }

  function trackProductView(product) {
    if (!product?.id) return;
    const list = readRecentProducts().filter((x) => Number(x.id) !== Number(product.id));
    list.unshift({
      id: Number(product.id),
      categorySlug: product.category_slug || product.categorySlug || null,
      at: Date.now(),
    });
    localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(list.slice(0, MAX_RECENT_PRODUCTS)));
    document.dispatchEvent(new CustomEvent('raku:behavior-changed'));
  }

  function trackCategoryBrowse(slug) {
    const s = String(slug || '').trim();
    if (!s || s === 'all') return;
    const list = readRecentCategories().filter((x) => x.slug !== s);
    list.unshift({ slug: s, at: Date.now() });
    localStorage.setItem(RECENT_CATEGORIES_KEY, JSON.stringify(list.slice(0, MAX_RECENT_CATEGORIES)));
    document.dispatchEvent(new CustomEvent('raku:behavior-changed'));
  }

  window._rakuTrackProductView = trackProductView;
  window._rakuTrackCategoryBrowse = trackCategoryBrowse;

  function buildQuery() {
    const recent = readRecentProducts().map((x) => x.id).join(',');
    const cats = readRecentCategories().map((x) => x.slug).join(',');
    const q = new URLSearchParams({ limit: '12' });
    if (recent) q.set('recent', recent);
    if (cats) q.set('categories', cats);
    return q.toString();
  }

  async function fetchFallbackProducts() {
    const base = window.RAKU_API_BASE || '';
    try {
      const res = await fetch(`${base}/api/products/home-sections?limit=12`, { credentials: 'same-origin' });
      const data = await res.json();
      if (!data?.ok) return null;
      const pool = [...(data.bestSelling || []), ...(data.newArrivals || [])];
      const seen = new Set();
      const products = [];
      for (const p of pool) {
        if (!p?.id || seen.has(p.id)) continue;
        seen.add(p.id);
        products.push(p);
        if (products.length >= 12) break;
      }
      if (!products.length) return null;
      return {
        ok: true,
        products,
        reason: 'popular',
        reasonLabel: 'Trending picks — browse more for personal recommendations',
        personalized: false,
      };
    } catch (_) {
      return null;
    }
  }

  function hasBehaviorSignals() {
    return readRecentProducts().length > 0 || readRecentCategories().length > 0;
  }

  function popularFromBootstrap() {
    const boot = window.__RAKU_BOOTSTRAP || window._rakuStoreBoot;
    if (!boot?.ok) return null;
    const pool = [...(boot.bestSelling || []), ...(boot.newArrivals || [])];
    const seen = new Set();
    const products = [];
    for (const p of pool) {
      if (!p?.id || seen.has(p.id)) continue;
      seen.add(p.id);
      products.push(p);
      if (products.length >= 12) break;
    }
    if (!products.length) return null;
    return {
      ok: true,
      products,
      reason: 'popular',
      reasonLabel: 'Trending picks — browse more for personal recommendations',
      personalized: false,
    };
  }

  async function fetchRecommendations() {
    if (!hasBehaviorSignals()) {
      const local = popularFromBootstrap();
      if (local) return local;
    }
    const base = window.RAKU_API_BASE || '';
    try {
      const res = await fetch(`${base}/api/products/recommended?${buildQuery()}`, {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (data?.ok && Array.isArray(data.products) && data.products.length) return data;
    } catch (_) {}
    const bootFallback = popularFromBootstrap();
    if (bootFallback) return bootFallback;
    return fetchFallbackProducts();
  }

  async function waitForCardRenderer() {
    for (let i = 0; i < 80; i++) {
      if (window.productCardHtml) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  }

  function showSection() {
    const section = document.getElementById('section-recommended-for-you');
    if (section) section.hidden = false;
  }

  function paintRecommendations(data) {
    const section = document.getElementById('section-recommended-for-you');
    const track = document.getElementById('track-recommended-for-you');
    const sub = document.getElementById('recommended-subtitle');
    if (!section || !track) return;

    const list = data?.products || [];
    if (!list.length) {
      section.hidden = true;
      return;
    }

    if (!window.productCardHtml) {
      showSection();
      return;
    }

    showSection();
    if (sub && data.reasonLabel) sub.textContent = data.reasonLabel;

    if (window._rakuStopHomeScrollAuto) window._rakuStopHomeScrollAuto('track-recommended-for-you');

    track.innerHTML = list.map((p) => window.productCardHtml(p)).join('');

    if (window.bindProductGridEvents) window.bindProductGridEvents();
    if (window._rakuSyncHomeScrollCardWidths) window._rakuSyncHomeScrollCardWidths();

    if (window._rakuInitHomeScrollAuto) {
      if (window.rakuScheduleIdle) {
        window.rakuScheduleIdle(() => window._rakuInitHomeScrollAuto('track-recommended-for-you', 3500), {
          timeout: 2000,
        });
      } else {
        setTimeout(() => window._rakuInitHomeScrollAuto('track-recommended-for-you', 3500), 150);
      }
    }
  }

  let refreshTimer = null;
  let loading = false;
  let cardRetryTimer = null;

  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      void loadRecommendations();
    }, 400);
  }

  async function loadRecommendations() {
    const section = document.getElementById('section-recommended-for-you');
    const track = document.getElementById('track-recommended-for-you');
    if (!section || !track || loading) return;

    loading = true;
    showSection();
    try {
      const data = await fetchRecommendations();
      if (!data) {
        section.hidden = true;
        return;
      }

      const hasRenderer = await waitForCardRenderer();
      if (!hasRenderer) {
        paintRecommendations(data);
        if (cardRetryTimer) clearTimeout(cardRetryTimer);
        cardRetryTimer = setTimeout(() => void loadRecommendations(), 300);
        return;
      }

      paintRecommendations(data);
    } finally {
      loading = false;
    }
  }

  window._rakuRefreshHomeRecommendations = scheduleRefresh;

  function bootRecommendations() {
    const page = document.getElementById('page-home');
    if (!page || page.style.display === 'none') return;
    showSection();
    void loadRecommendations();
  }

  document.addEventListener('raku:ready', bootRecommendations);
  document.addEventListener('raku:bootstrap', bootRecommendations);
  document.addEventListener('raku:behavior-changed', scheduleRefresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleRefresh();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootRecommendations);
  } else {
    bootRecommendations();
  }
})();
