/**
 * Keep tawk.to visible on SPA route changes and after tab focus.
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

  document.addEventListener('raku:ready', () => setTimeout(showTawk, 500));
  document.addEventListener('raku:bootstrap', () => setTimeout(showTawk, 500));
})();
