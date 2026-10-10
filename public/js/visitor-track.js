/** Storefront visitor activity: page views (incl. SPA navigation) + client events → /api/track */
(function () {
  if (window.rakuTrack) return;
  const ENDPOINT = (window.RAKU_API_BASE || '') + '/api/track';
  let lastPath = '';
  let timer = null;
  let firstView = true;

  function send(events) {
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        keepalive: true,
        body: JSON.stringify({ events }),
      }).catch(() => {});
    } catch (_) {}
  }

  function pageView() {
    const path = location.pathname + location.search;
    if (path === lastPath) return;
    lastPath = path;
    const ev = { event: 'page_view', path, label: (document.title || '').slice(0, 300) };
    if (firstView && document.referrer) ev.referrer = document.referrer.slice(0, 500);
    firstView = false;
    send([ev]);
  }

  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(pageView, delay);
  }

  const recent = new Map();

  window.rakuTrack = function (event, data) {
    if (!event) return;
    const path = location.pathname + location.search;
    const key = `${event}|${path}|${(data && data.label) || ''}`;
    const now = Date.now();
    if (now - (recent.get(key) || 0) < 10000) return;
    recent.set(key, now);
    send([{ event, path, ...(data || {}) }]);
  };

  document.addEventListener('raku:navigate', (e) => {
    if (e.detail && e.detail.skipUrl) return;
    schedule(700);
  });
  document.addEventListener('raku:seo-applied', () => schedule(300));
  window.addEventListener('popstate', () => schedule(700));

  if (document.readyState === 'complete') schedule(400);
  else window.addEventListener('load', () => schedule(400), { once: true });
})();
