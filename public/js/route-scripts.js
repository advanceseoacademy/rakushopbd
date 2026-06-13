/**
 * Load route-specific scripts on demand to cut initial parse/eval cost.
 */
(function () {
  const loaded = new Map();

  const ROUTE_SRC = {
    appointment: '/js/appointment.js?v=4',
    faq: '/js/faq.js?v=4',
    rewards: '/js/rewards.js?v=3',
    contact: '/js/contact.js?v=3',
    track: '/js/track.js?v=2',
    privacy: '/js/legal-pages.js?v=2',
    terms: '/js/legal-pages.js?v=2',
    return: '/js/legal-pages.js?v=2',
    preorder: '/js/legal-pages.js?v=2',
  };

  const IDLE_SRC = ['/js/footer-settings.js?v=7', '/js/face-analyzer.js?v=11'];

  function loadScript(src) {
    if (loaded.has(src)) return loaded.get(src);
    const job = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(el);
    });
    loaded.set(src, job);
    return job;
  }

  window._rakuEnsureRouteScript = function ensureRouteScript(page) {
    const src = ROUTE_SRC[page];
    return src ? loadScript(src) : Promise.resolve();
  };

  function scheduleIdleScripts() {
    const run = () => {
      IDLE_SRC.forEach((src) => {
        void loadScript(src);
      });
    };
    if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 5000 });
    else setTimeout(run, 2500);
  }

  function parseInitialPage() {
    const parts = (location.pathname || '/').split('/').filter(Boolean);
    if (!parts.length) return 'home';
    const [page] = parts;
    const aliases = {
      'privacy-policy': 'privacy',
      'terms-and-conditions': 'terms',
      'return-policy': 'return',
      'pre-order-policy': 'preorder',
    };
    return aliases[page] || page;
  }

  const initial = parseInitialPage();
  if (ROUTE_SRC[initial]) {
    void loadScript(ROUTE_SRC[initial]);
  } else {
    scheduleIdleScripts();
  }

  document.addEventListener('raku:navigate', (e) => {
    const page = e.detail?.page;
    if (page) void window._rakuEnsureRouteScript(page);
  });
})();
