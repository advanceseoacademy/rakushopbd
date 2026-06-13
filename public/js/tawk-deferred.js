/**
 * Load tawk.to after idle so chat does not extend the critical request chain.
 */
(function () {
  window.Tawk_API = window.Tawk_API || {};

  function showTawk() {
    try {
      if (typeof window.Tawk_API.showWidget === 'function') {
        window.Tawk_API.showWidget();
      }
    } catch (_) {}
  }

  window.Tawk_API.onLoad = function () {
    window._rakuTawkReady = true;
    showTawk();
  };

  document.addEventListener('raku:navigate', () => {
    setTimeout(showTawk, 150);
  });

  window.addEventListener('popstate', () => {
    setTimeout(showTawk, 150);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') setTimeout(showTawk, 200);
  });

  function injectTawkEmbed() {
    if (window._rakuTawkInjected) return;
    window._rakuTawkInjected = true;
    const s1 = document.createElement('script');
    s1.async = true;
    s1.src = 'https://embed.tawk.to/6a2681046784101c2d093b7d/1jqj6fv32';
    s1.charset = 'UTF-8';
    document.body.appendChild(s1);
  }

  function scheduleTawkLoad() {
    if (window._rakuTawkScheduled) return;
    window._rakuTawkScheduled = true;
    const run = () => injectTawkEmbed();
    if (window.requestIdleCallback) {
      requestIdleCallback(run, { timeout: 6000 });
    } else {
      setTimeout(run, 3000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleTawkLoad, { once: true });
  } else {
    scheduleTawkLoad();
  }
})();
