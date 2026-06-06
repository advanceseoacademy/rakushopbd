/**
 * Standalone pages (track, etc.) — same header as home without full SPA shell.
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

  document.addEventListener('DOMContentLoaded', () => {
    const catNav = document.getElementById('global-cat-nav');
    if (catNav) catNav.style.display = 'none';

    if (/^\/track\/?$/i.test(location.pathname)) {
      document.getElementById('nav-track-btn')?.classList.add('is-active');
    }

    bindMobileCatMenu();
    document.dispatchEvent(new CustomEvent('raku:ready'));
  });
})();
