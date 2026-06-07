/**
 * Standalone pages (track, faq, contact, etc.) — shared header behavior.
 */
(function () {
  if (!window.RAKU_STANDALONE) return;

  function bindMobileCatMenu() {
    const mobileCatMenu = document.getElementById('mobile-cat-menu');
    const mobileCatMenuBtn = document.getElementById('nav-mobile-menu-btn');
    const mobileCatMenuClose = document.getElementById('mobile-cat-menu-close');
    const mobileCatMenuBackdrop = document.getElementById('mobile-cat-menu-backdrop');

    function openMobileCatMenu() {
      if (!mobileCatMenu) return;
      mobileCatMenu.classList.add('open');
      mobileCatMenu.setAttribute('aria-hidden', 'false');
      if (mobileCatMenuBtn) mobileCatMenuBtn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('mobile-cat-menu-open');
    }

    function closeMobileCatMenu() {
      if (!mobileCatMenu) return;
      mobileCatMenu.classList.remove('open');
      mobileCatMenu.setAttribute('aria-hidden', 'true');
      if (mobileCatMenuBtn) mobileCatMenuBtn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('mobile-cat-menu-open');
    }

    window._rakuCloseMobileCatMenu = closeMobileCatMenu;

    if (mobileCatMenuBtn && !mobileCatMenuBtn._rakuBound) {
      mobileCatMenuBtn._rakuBound = true;
      mobileCatMenuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (mobileCatMenu?.classList.contains('open')) closeMobileCatMenu();
        else openMobileCatMenu();
      });
    }
    if (mobileCatMenuClose) mobileCatMenuClose.addEventListener('click', closeMobileCatMenu);
    if (mobileCatMenuBackdrop) mobileCatMenuBackdrop.addEventListener('click', closeMobileCatMenu);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileCatMenu?.classList.contains('open')) closeMobileCatMenu();
    });
  }

  function markHeaderNavActive() {
    const path = location.pathname.replace(/\/$/, '') || '/';
    const activeHref =
      path === '/'
        ? '/'
        : ['/appointment', '/track', '/faq', '/contact'].includes(path)
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
    bindMobileCatMenu();
    document.dispatchEvent(new CustomEvent('raku:ready'));
  });
})();
