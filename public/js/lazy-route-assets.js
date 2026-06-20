/**
 * Load page-specific CSS/JS on demand (smaller homepage payload).
 */
(function () {
  const loadedJs = new Set();
  const loadedCss = new Set();
  const inflight = {};

  function loadCss(href) {
    if (loadedCss.has(href)) return Promise.resolve();
    if (document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) {
      loadedCss.add(href);
      return Promise.resolve();
    }
    loadedCss.add(href);
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`CSS failed: ${href}`));
      document.head.appendChild(link);
    });
  }

  function loadJs(src) {
    if (loadedJs.has(src)) return Promise.resolve();
    if (document.querySelector(`script[src="${src}"]`)) {
      loadedJs.add(src);
      return Promise.resolve();
    }
    loadedJs.add(src);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`JS failed: ${src}`));
      document.head.appendChild(script);
    });
  }

  const ROUTE_ASSETS = {
    account: {
      js: ['/js/account.js?v=17'],
      css: ['/css/account.css?v=13'],
    },
    appointment: {
      js: ['/js/appointment.js?v=5'],
      css: ['/css/appointment.css?v=3', '/css/pages.css?v=8'],
    },
    faq: {
      js: ['/js/faq.js?v=5'],
      css: ['/css/pages.css?v=8'],
    },
    about: {
      js: ['/js/about.js?v=2'],
      css: ['/css/pages.css?v=8'],
    },
    contact: {
      js: ['/js/contact.js?v=4'],
      css: ['/css/pages.css?v=8'],
    },
    track: {
      js: ['/js/track.js?v=3'],
      css: ['/css/pages.css?v=8'],
    },
    privacy: {
      js: ['/js/legal-pages.js?v=5'],
      css: ['/css/pages.css?v=8'],
    },
    terms: {
      js: ['/js/legal-pages.js?v=5'],
      css: ['/css/pages.css?v=8'],
    },
    return: {
      js: ['/js/legal-pages.js?v=5'],
      css: ['/css/pages.css?v=8'],
    },
    preorder: {
      js: ['/js/legal-pages.js?v=5'],
      css: ['/css/pages.css?v=8'],
    },
    points: {
      js: ['/js/legal-pages.js?v=5'],
      css: ['/css/pages.css?v=8'],
    },
    cart: {
      css: ['/css/cart.css?v=7'],
    },
    wishlist: {
      css: ['/css/wishlist.css?v=4'],
    },
    checkout: {
      css: ['/css/checkout-modal.css?v=16'],
    },
    product: {
      css: ['/css/reviews.css?v=7'],
    },
  };

  function loadSpec(spec) {
    if (!spec) return Promise.resolve();
    const jobs = [];
    (spec.css || []).forEach((href) => jobs.push(loadCss(href)));
    (spec.js || []).forEach((src) => jobs.push(loadJs(src)));
    return Promise.all(jobs);
  }

  window.rakuEnsureRouteAssets = function (page) {
    const key = String(page || '');
    const spec = ROUTE_ASSETS[key];
    if (!spec) return Promise.resolve();
    if (inflight[key]) return inflight[key];
    inflight[key] = loadSpec(spec).finally(() => {
      delete inflight[key];
    });
    return inflight[key];
  };

  /** Run when browser is idle (falls back to short timeout). */
  window.rakuScheduleIdle = function (fn, opts) {
    const timeout = opts && opts.timeout != null ? opts.timeout : 2000;
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => fn(), { timeout });
    } else {
      setTimeout(fn, Math.min(timeout, 150));
    }
  };

  /** Run callback once section enters (or nears) the viewport. */
  window.rakuWhenVisible = function (target, fn, opts) {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      fn();
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          obs.disconnect();
          fn();
        }
      },
      { rootMargin: (opts && opts.rootMargin) || '160px', threshold: 0.01 }
    );
    obs.observe(el);
  };

})();
