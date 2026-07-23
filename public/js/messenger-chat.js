/**
 * Facebook Messenger FAB — opens m.me (new tab). Uses store Facebook URL when set.
 */
(function () {
  const DEFAULT_HREF = 'https://m.me/rakushopbd';

  function toMessengerHref(raw) {
    const value = String(raw || '').trim();
    if (!value) return DEFAULT_HREF;
    if (/^https?:\/\/(www\.)?m\.me\//i.test(value)) return value;

    try {
      const url = new URL(value.startsWith('http') ? value : `https://${value}`);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'm.me' || host === 'messenger.com' || host.endsWith('.messenger.com')) {
        return url.toString();
      }
      if (host === 'facebook.com' || host === 'fb.com' || host === 'fb.me') {
        const parts = url.pathname.split('/').filter(Boolean);
        const slug = parts[0] && parts[0] !== 'profile.php' ? parts[0] : '';
        if (slug) return `https://m.me/${encodeURIComponent(slug)}`;
      }
    } catch (_) {}

    if (/^[a-zA-Z0-9._-]+$/.test(value)) return `https://m.me/${value}`;
    return DEFAULT_HREF;
  }

  function applyHref() {
    const el = document.getElementById('raku-messenger-chat');
    if (!el) return;
    const settings = window.__RAKU_BOOTSTRAP?.settings || window._rakuStoreSettings || {};
    const fromSettings = settings.social_facebook || settings.facebook_url || settings.facebook;
    el.href = toMessengerHref(fromSettings || DEFAULT_HREF);
  }

  document.addEventListener('DOMContentLoaded', applyHref);
  document.addEventListener('raku:bootstrap', applyHref);
  if (window.__RAKU_BOOTSTRAP || window.__RAKU_READY__) applyHref();
})();
