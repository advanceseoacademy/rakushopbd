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

  async function fetchRecommendations() {
    const base = window.RAKU_API_BASE || '';
    try {
      const res = await fetch(`${base}/api/products/recommended?${buildQuery()}`, {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (data?.ok && Array.isArray(data.products) && data.products.length) return data;
    } catch (_) {}
    return fetchFallbackProducts();
  }

  async function waitForCardRenderer() {
    for (let i = 0; i < 30; i++) {
      if (window.productCardHtml) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
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
      section.hidden = true;
      return;
    }

    section.hidden = false;
    if (sub && data.reasonLabel) sub.textContent = data.reasonLabel;

    if (window._rakuStopHomeScrollAuto) window._rakuStopHomeScrollAuto('track-recommended-for-you');

    track.innerHTML = list.map((p) => window.productCardHtml(p)).join('');

    if (window.bindProductGridEvents) window.bindProductGridEvents();

    requestAnimationFrame(() => {
      setTimeout(() => {
        if (window._rakuInitHomeScrollAuto) {
          window._rakuInitHomeScrollAuto('track-recommended-for-you', 3500);
        }
      }, 120);
    });
  }

  let refreshTimer = null;
  let loading = false;

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
    try {
      await waitForCardRenderer();
      const data = await fetchRecommendations();
      if (!data) {
        section.hidden = true;
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
    void loadRecommendations();
  }

  document.addEventListener('raku:ready', bootRecommendations);
  document.addEventListener('raku:bootstrap', bootRecommendations);
  document.addEventListener('raku:behavior-changed', scheduleRefresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleRefresh();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(bootRecommendations, 100));
  } else {
    setTimeout(bootRecommendations, 100);
  }
})();
