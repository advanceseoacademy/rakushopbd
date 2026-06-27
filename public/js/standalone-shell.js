/**
 * Standalone pages (track, faq, contact, etc.) — shared header behavior.
 */
(function () {
  if (!window.RAKU_STANDALONE) return;

  function markHeaderNavActive() {
    const path = location.pathname.replace(/\/$/, '') || '/';
    const activeHref =
      path === '/'
        ? '/'
        : ['/appointment', '/track', '/faq', '/blog', '/contact'].includes(path)
          ? path
          : null;

    document.querySelectorAll('.navbar-main-link').forEach((link) => {
      link.classList.toggle('is-active', activeHref && link.getAttribute('href') === activeHref);
    });
    document.querySelectorAll('.mobile-cat-menu-extra .mobile-cat-link').forEach((link) => {
      link.classList.toggle('active', activeHref && link.getAttribute('href') === activeHref);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    markHeaderNavActive();
    document.dispatchEvent(new CustomEvent('raku:ready'));
  });
})();
