/**
 * Defer third-party scripts: GA/GTM helpers + SPA dataLayer page views.
 * Meta Pixel base code lives ONLY in GTM — this file must not inject fbevents.js.
 * Conversion helpers call fbq() if GTM already loaded it, else queue briefly.
 */
(function () {
  let gaLoaded = false;
  let gtmLoaded = false;
  let lastPageViewKey = '';
  let pageViewTimer = null;
  let spaNavigated = false;
  const fbQueue = [];

  function hasFbq() {
    return typeof window.fbq === 'function';
  }

  function flushFbQueue() {
    if (!hasFbq() || !fbQueue.length) return;
    while (fbQueue.length) {
      const entry = fbQueue.shift();
      if (!entry || !entry.event) continue;
      if (entry.params && Object.keys(entry.params).length) {
        window.fbq('track', entry.event, entry.params);
      } else {
        window.fbq('track', entry.event);
      }
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

  /**
   * SPA pages use history.pushState — push virtual_page_view for GTM
   * (Meta Pixel PageView should be a GTM tag on this event, not fbq here).
   */
  function trackSpaPageView(detail) {
    const gtmId = String(window.__RAKU_GTM_ID || '').trim();
    const ga4Id = String(window.__RAKU_GA4_ID || '').trim();

    if (gtmId) loadGoogleTagManager();
    if (ga4Id) loadGoogleAnalytics();

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

    flushFbQueue();
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
  }

  // No site-side Pixel loader — GTM owns the Meta Pixel base code.
  window.rakuLoadFacebookPixel = function () {};

  window.rakuTrackFacebook = function (event, params) {
    if (!event) return;
    // Prefer fbq from GTM Meta Pixel tag; queue briefly if not ready yet
    if (hasFbq()) {
      if (params && Object.keys(params).length) window.fbq('track', event, params);
      else window.fbq('track', event);
      return;
    }
    fbQueue.push({ event, params: params || null });
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (hasFbq()) {
        clearInterval(timer);
        flushFbQueue();
      } else if (tries >= 40) {
        clearInterval(timer);
      }
    }, 250);
  };

  ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
    window.addEventListener(eventName, onUserIntent, { once: true, passive: true });
  });
})();
