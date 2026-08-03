/**
 * Defer third-party scripts: GA/GTM on interaction; Meta Pixel on checkout/conversion only.
 * Avoids Lighthouse legacy-javascript flag for fbevents.js on homepage audits.
 */
(function () {
  let fbLoaded = false;
  let gaLoaded = false;
  let gtmLoaded = false;
  let lastPageViewKey = '';
  let pageViewTimer = null;
  let spaNavigated = false;

  function loadGoogleAnalytics() {
    const ga4Id = String(window.__RAKU_GA4_ID || '').trim();
    if (!ga4Id || gaLoaded || window._rakuGa4Loaded) return;
    gaLoaded = true;
    window._rakuGa4Loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function gtag() {
        window.dataLayer.push(arguments);
      };
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`;
    script.onload = () => {
      window.gtag('js', new Date());
      window.gtag('config', ga4Id, { send_page_view: true });
    };
    document.head.appendChild(script);
  }

  function loadGoogleTagManager() {
    const gtmId = String(window.__RAKU_GTM_ID || '').trim();
    if (!gtmId || gtmLoaded || window._rakuGtmLoaded) return;
    gtmLoaded = true;
    window._rakuGtmLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
    document.head.appendChild(script);
  }

  function loadFacebookPixel() {
    const pixelId = String(window.__RAKU_FB_PIXEL_ID || '').replace(/\D/g, '');
    if (!pixelId || fbLoaded || window._rakuFbLoaded) return;
    fbLoaded = true;
    window._rakuFbLoaded = true;

    !(function (f, b, e, v, n, t, s) {
      if (f.fbq && f.fbq.loaded) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = n.queue || [];
      t = b.createElement(e);
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');

    const queued = window._rakuFbEventQueue;
    if (Array.isArray(queued) && queued.length) {
      queued.forEach((entry) => {
        if (entry && entry.length > 1) window.fbq('track', entry[0], entry[1]);
        else if (entry && entry.length) window.fbq('track', entry[0]);
      });
      window._rakuFbEventQueue = [];
    }
  }

  /**
   * SPA pages use history.pushState — GTM/GA only see a real page load on full reload.
   * Push a virtual page view so Tag Assistant / GA4 can track product & other routes.
   */
  function trackSpaPageView(detail) {
    const gtmId = String(window.__RAKU_GTM_ID || '').trim();
    const ga4Id = String(window.__RAKU_GA4_ID || '').trim();
    const pixelId = String(window.__RAKU_FB_PIXEL_ID || '').replace(/\D/g, '');
    if (!gtmId && !ga4Id && !pixelId) return;

    if (gtmId) loadGoogleTagManager();
    if (ga4Id) loadGoogleAnalytics();

    const path = location.pathname + location.search;
    const title = document.title || '';
    const pageLocation = location.href;
    const pageName = (detail && detail.page) || window._rakuVisiblePage || '';
    // Dedupe by path so title updates (SEO) within the debounce window don't double-count
    if (path === lastPageViewKey) return;
    lastPageViewKey = path;

    if (gtmId || ga4Id) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'virtual_page_view',
        page_path: path,
        page_title: title,
        page_location: pageLocation,
        page_name: pageName,
      });

      if (typeof window.gtag === 'function' && ga4Id && gaLoaded) {
        window.gtag('event', 'page_view', {
          page_path: path,
          page_title: title,
          page_location: pageLocation,
          send_to: ga4Id,
        });
      }
    }

    // Meta Pixel SPA PageView (init already sends one PageView — don't double on first load)
    if (pixelId) {
      if (fbLoaded && typeof window.fbq === 'function') {
        window.fbq('track', 'PageView');
      } else {
        loadFacebookPixel();
      }
    }
  }

  function scheduleSpaPageView(detail) {
    clearTimeout(pageViewTimer);
    // Wait for SEO title/canonical updates (esp. product pages)
    pageViewTimer = setTimeout(() => trackSpaPageView(detail || {}), 280);
  }

  window.rakuTrackSpaPageView = trackSpaPageView;

  document.addEventListener('raku:navigate', (e) => {
    const detail = e.detail || {};
    // skipUrl navigations (product shell / URL restore) — wait for URL update or popstate
    if (detail.trackPageView === false || detail.skipUrl) return;
    spaNavigated = true;
    // Allow a new pageview for the next path
    lastPageViewKey = '';
    scheduleSpaPageView(detail);
  });

  document.addEventListener('raku:seo-applied', (e) => {
    // Skip initial SSR/hydrate SEO — only after a real SPA navigation
    if (!spaNavigated) return;
    scheduleSpaPageView({ page: window._rakuVisiblePage, source: 'seo', ...(e.detail || {}) });
  });

  window.addEventListener('popstate', () => {
    spaNavigated = true;
    lastPageViewKey = '';
    scheduleSpaPageView({ page: window._rakuVisiblePage, source: 'popstate' });
  });

  function onUserIntent() {
    loadGoogleAnalytics();
    loadGoogleTagManager();
    // Same deferral as GTM: first click/tap loads Meta Pixel (Lighthouse still skips it)
    if (String(window.__RAKU_FB_PIXEL_ID || '').replace(/\D/g, '')) {
      loadFacebookPixel();
    }
  }

  window.rakuLoadFacebookPixel = loadFacebookPixel;

  window.rakuTrackFacebook = function (event, params) {
    const pixelId = String(window.__RAKU_FB_PIXEL_ID || '').replace(/\D/g, '');
    if (!pixelId || !event) return;
    if (fbLoaded && typeof window.fbq === 'function') {
      if (params && Object.keys(params).length) window.fbq('track', event, params);
      else window.fbq('track', event);
      return;
    }
    window._rakuFbEventQueue = window._rakuFbEventQueue || [];
    window._rakuFbEventQueue.push(params ? [event, params] : [event]);
    loadFacebookPixel();
  };

  // GA/GTM: first deliberate interaction (scroll does not load analytics)
  ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
    window.addEventListener(eventName, onUserIntent, { once: true, passive: true });
  });
})();
