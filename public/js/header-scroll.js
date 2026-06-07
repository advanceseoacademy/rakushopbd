/**
 * Dual header: keep primary row (logo + search + support) fixed; hide secondary nav on scroll (desktop).
 */
(function () {
  function initHeaderScrollHide() {
    const navbar = document.querySelector('.navbar--dual');
    if (!navbar || navbar._rakuScrollBound) return;
    navbar._rakuScrollBound = true;

    const desktop = window.matchMedia('(min-width: 769px)');
    let ticking = false;

    function update() {
      if (!desktop.matches) {
        navbar.classList.remove('navbar--sub-hidden');
        return;
      }
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      const hide = y > 56;
      navbar.classList.toggle('navbar--sub-hidden', hide);
      if (hide && window._rakuCloseCatDropdown) window._rakuCloseCatDropdown();
    }

    window.addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          update();
          ticking = false;
        });
      },
      { passive: true }
    );

    desktop.addEventListener('change', update);
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderScrollHide);
  } else {
    initHeaderScrollHide();
  }
})();
