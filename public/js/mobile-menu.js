/**
 * Mobile category drawer — hamburger open/close + delegated menu actions.
 */
(function () {
  const SPA_EXTRA_ROUTES = {
    '/': 'home',
    '/appointment': 'appointment',
    '/faq': 'faq',
    '/contact': 'contact',
    '/track': 'track',
    '/privacy-policy': 'privacy',
    '/terms-and-conditions': 'terms',
    '/return-policy': 'return',
    '/pre-order-policy': 'preorder',
    '/reward-point-policy': 'points',
  };

  function bindMobileMenu() {
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
    window._rakuOpenMobileCatMenu = openMobileCatMenu;

    if (mobileCatMenuBtn && !mobileCatMenuBtn._rakuBound) {
      mobileCatMenuBtn._rakuBound = true;
      mobileCatMenuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (mobileCatMenu?.classList.contains('open')) closeMobileCatMenu();
        else openMobileCatMenu();
      });
    }

    if (mobileCatMenuClose) {
      mobileCatMenuClose.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileCatMenu();
      });
    }

    if (mobileCatMenuBackdrop) {
      mobileCatMenuBackdrop.addEventListener('click', closeMobileCatMenu);
    }

    if (mobileCatMenu && !mobileCatMenu._rakuDelegated) {
      mobileCatMenu._rakuDelegated = true;
      mobileCatMenu.addEventListener('click', (e) => {
        const toggle = e.target.closest('.mobile-menu-group-toggle');
        if (toggle && mobileCatMenu.contains(toggle)) {
          e.preventDefault();
          const group = toggle.closest('.mobile-menu-group');
          if (!group) return;
          const open = group.classList.toggle('open');
          toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
          return;
        }

        const link = e.target.closest('.mobile-cat-menu-extra .mobile-cat-link');
        if (!link || window.RAKU_STANDALONE || !window.showPage) return;
        const href = link.getAttribute('href');
        const page = href && SPA_EXTRA_ROUTES[href];
        if (!page) return;
        e.preventDefault();
        closeMobileCatMenu();
        window.showPage(page);
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileCatMenu?.classList.contains('open')) closeMobileCatMenu();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindMobileMenu);
  } else {
    bindMobileMenu();
  }
})();
