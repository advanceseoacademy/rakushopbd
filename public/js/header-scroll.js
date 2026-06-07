/**
 * Dual header: hide secondary nav on scroll down, show on scroll up (desktop).
 * Uses transform-only animation so navbar height stays fixed (no scroll jitter).
 */
(function () {
  function isCatDropdownOpen() {
    const el = document.getElementById('header-cat-dropdown');
    return el && !el.hidden;
  }

  function initHeaderScrollHide() {
    const navbar = document.querySelector('.navbar--dual');
    if (!navbar || navbar._rakuScrollBound) return;
    navbar._rakuScrollBound = true;

    const desktop = window.matchMedia('(min-width: 769px)');
    const TOP_ALWAYS_SHOW = 48;
    const HIDE_AFTER = 100;
    const ACCUM_HIDE = 28;
    const ACCUM_SHOW = -18;
    const ANIM_LOCK_MS = 420;

    let subHidden = false;
    let lastY = 0;
    let scrollAccum = 0;
    let lockedUntil = 0;
    let ticking = false;

    function setSubHidden(next) {
      if (subHidden === next) return;
      subHidden = next;
      lockedUntil = Date.now() + ANIM_LOCK_MS;
      scrollAccum = 0;
      navbar.classList.toggle('navbar--sub-hidden', subHidden);
      if (subHidden && window._rakuCloseCatDropdown) window._rakuCloseCatDropdown();
    }

    function update() {
      if (!desktop.matches) {
        setSubHidden(false);
        lastY = window.scrollY || 0;
        scrollAccum = 0;
        return;
      }

      if (Date.now() < lockedUntil) return;

      if (isCatDropdownOpen()) {
        setSubHidden(false);
        lastY = window.scrollY || 0;
        scrollAccum = 0;
        return;
      }

      const y = window.scrollY || document.documentElement.scrollTop || 0;
      const dy = y - lastY;
      lastY = y;

      if (y <= TOP_ALWAYS_SHOW) {
        scrollAccum = 0;
        setSubHidden(false);
        return;
      }

      scrollAccum += dy;

      if (!subHidden && scrollAccum >= ACCUM_HIDE && y > HIDE_AFTER) {
        setSubHidden(true);
      } else if (subHidden && scrollAccum <= ACCUM_SHOW) {
        setSubHidden(false);
      }

      if (Math.abs(scrollAccum) > 120) scrollAccum = scrollAccum > 0 ? 120 : -120;
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

    desktop.addEventListener('change', () => {
      lastY = window.scrollY || 0;
      scrollAccum = 0;
      lockedUntil = 0;
      update();
    });
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderScrollHide);
  } else {
    initHeaderScrollHide();
  }
})();
