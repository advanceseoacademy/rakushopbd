/**
 * Defer third-party scripts: GA/GTM on interaction; Meta Pixel helpers.
 * SPA navigations always push dataLayer virtual_page_view (works even when GTM
 * is pasted via Admin → tracking_scripts_head instead of tracking_gtm_id).
 */
(function () {
  let fbLoaded = false;
  let gaLoaded = false;
  let gtmLoaded = false;
  let lastPageViewKey = '';
  let pageViewTimer = null;
  let spaNavigated = false;

  function hasFbq() {
    return typeof window.fbq === 'function';
  }

  function markFbReadyIfPresent() {
    if (hasFbq()) {
      fbLoaded = true;
      window._rakuFbLoaded = true;
    }
  }

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
    script.setAttribute('data-cfasync', 'false');
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
    // Custom head snippet may already have loaded the same container
    if (document.querySelector(`script[src*="googletagmanager.com/gtm.js?id=${gtmId}"]`)) {
      gtmLoaded = true;
      window._rakuGtmLoaded = true;
      return;
    }
    gtmLoaded = true;
    window._rakuGtmLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
    document.head.appendChild(script);
  }

  function loadFacebookPixel() {
    markFbReadyIfPresent();
    const pixelId = String(window.__RAKU_FB_PIXEL_ID || '').replace(/\D/g, '');
    if (hasFbq()) {
      fbLoaded = true;
      window._rakuFbLoaded = true;
      return;
    }
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
      t.setAttribute('data-cfasync', 'false');
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
   * SPA pages use history.pushState — GTM only sees a full reload otherwise.
   * Always push to dataLayer so Tag Assistant shows virtual_page_view even when
   * GTM was installed via custom head HTML (not tracking_gtm_id).
   */
  function trackSpaPageView(detail) {
    const gtmId = String(window.__RAKU_GTM_ID || '').trim();
    const ga4Id = String(window.__RAKU_GA4_ID || '').trim();
    const pixelId = String(window.__RAKU_FB_PIXEL_ID || '').replace(/\D/g, '');

    if (gtmId) loadGoogleTagManager();
    if (ga4Id) loadGoogleAnalytics();
    markFbReadyIfPresent();

    const path = location.pathname + location.search;
    const title = document.title || '';
    const pageLocation = location.href;
    const pageName = (detail && detail.page) || window._rakuVisiblePage || '';
    if (path === lastPageViewKey) return;
    lastPageViewKey = path;

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

    // Meta Pixel SPA PageView — works with admin pixel ID or custom-head fbq()
    if (hasFbq()) {
      window.fbq('track', 'PageView');
    } else if (pixelId) {
      loadFacebookPixel();
    }
  }

  function scheduleSpaPageView(detail) {
    clearTimeout(pageViewTimer);
    pageViewTimer = setTimeout(() => trackSpaPageView(detail || {}), 280);
  }

  window.rakuTrackSpaPageView = trackSpaPageView;

  document.addEventListener('raku:navigate', (e) => {
    const detail = e.detail || {};
    if (detail.trackPageView === false || detail.skipUrl) return;
    spaNavigated = true;
    lastPageViewKey = '';
    scheduleSpaPageView(detail);
  });

  document.addEventListener('raku:seo-applied', (e) => {
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
    markFbReadyIfPresent();
    if (String(window.__RAKU_FB_PIXEL_ID || '').replace(/\D/g, '') && !hasFbq()) {
      loadFacebookPixel();
    }
  }

  window.rakuLoadFacebookPixel = loadFacebookPixel;

  window.rakuTrackFacebook = function (event, params) {
    if (!event) return;
    markFbReadyIfPresent();
    const pixelId = String(window.__RAKU_FB_PIXEL_ID || '').replace(/\D/g, '');

    if (hasFbq()) {
      if (params && Object.keys(params).length) window.fbq('track', event, params);
      else window.fbq('track', event);
      return;
    }

    if (!pixelId) return;
    window._rakuFbEventQueue = window._rakuFbEventQueue || [];
    window._rakuFbEventQueue.push(params ? [event, params] : [event]);
    loadFacebookPixel();
  };

  ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
    window.addEventListener(eventName, onUserIntent, { once: true, passive: true });
  });
})();
