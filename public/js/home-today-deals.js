/**
 * Homepage — Today Deals section (admin products + countdown).
 */
(function () {
  let countdownTimer = null;
  let endsAtMs = null;
  let autoScrollTimer = null;
  let resizeObserver = null;

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtNum(n) {
    return Number(n).toLocaleString('en-US');
  }

  function stars(rating) {
    const r = Math.round(Number(rating) || 0);
    return '★'.repeat(Math.min(5, r)) + '☆'.repeat(Math.max(0, 5 - r));
  }

  function discountPercent(p) {
    if (window.discountPercent) return window.discountPercent(p);
    const pct = Number(p.discount_percent ?? p.discountPercent);
    if (Number.isFinite(pct) && pct > 0 && pct < 100) return Math.round(pct);
    return null;
  }

  function formatPrice(amount) {
    if (window.formatPrice) return window.formatPrice(amount);
    return '৳' + fmtNum(Math.round(amount));
  }

  function productMediaHtml(p) {
    if (window.productMediaHtml) return window.productMediaHtml(p);
    if (p.image_url || p.imageUrl) {
      const src = esc(p.image_url || p.imageUrl);
      return `<img src="${src}" alt="${esc(p.name_bn || 'Product')}" loading="lazy" decoding="async">`;
    }
    return `<i class="${esc(p.icon || 'ti ti-package')}" style="color:${esc(p.icon_color || p.iconColor || '#2D6B32')};font-size:42px;"></i>`;
  }

  function productIsOutOfStock(p) {
    if (!p || !Object.prototype.hasOwnProperty.call(p, 'stock')) return false;
    const n = Number(p.stock);
    return Number.isFinite(n) ? n <= 0 : true;
  }

  function actionBtn(p) {
    if (window.productCardActionBtn) return window.productCardActionBtn(p);
    if (!productIsOutOfStock(p)) {
      return `<button type="button" class="add-cart-btn" data-id="${p.id}"><i class="ti ti-shopping-cart-plus"></i> Add to Cart</button>`;
    }
    return `<button type="button" class="preorder-btn" data-id="${p.id}"><i class="ti ti-clock-hour-4"></i> Pre-order</button>`;
  }

  function cardHtml(p) {
    const pct = discountPercent(p);
    const oldVal =
      pct && Number(p.price) > 0
        ? p.old_price || p.oldPrice || Math.round(Number(p.price) / (1 - pct / 100))
        : null;
    const discHtml = pct ? `<span class="today-deals-discount">${fmtNum(pct)}%</span>` : '';
    const oldHtml = oldVal ? `<span class="today-deals-card-old prod-old">${formatPrice(oldVal)}</span>` : '';
    const reviews = Number(p.review_count ?? p.reviewCount) || 0;

    return `<article class="today-deals-card" data-id="${p.id}">
      <div class="today-deals-card-img">
        ${discHtml}
        ${productMediaHtml(p)}
      </div>
      <div class="today-deals-card-body">
        <div class="today-deals-card-name">${esc(p.name_bn || p.nameBn || '')}</div>
        <div class="today-deals-card-rating prod-rating">
          <span class="stars">${stars(p.rating)}</span>
          <span class="rating-count">(${fmtNum(reviews)})</span>
        </div>
        <div class="today-deals-card-foot prod-foot">
          <div>
            <span class="today-deals-card-price prod-price">${formatPrice(p.price)}</span>
            ${oldHtml}
          </div>
          ${actionBtn(p)}
        </div>
      </div>
    </article>`;
  }

  function visibleTodayDealsCards() {
    if (window.matchMedia('(max-width: 768px)').matches) return 2;
    if (window.matchMedia('(max-width: 1024px)').matches) return 3;
    return 4;
  }

  function syncTodayDealsCardWidths() {
    const track = document.getElementById('today-deals-grid');
    if (!track) return;
    const cards = track.querySelectorAll('.today-deals-card');
    if (!cards.length) return;

    const styles = getComputedStyle(track);
    const gapRaw = styles.columnGap && styles.columnGap !== 'normal' ? styles.columnGap : styles.gap;
    const gap = Number.parseFloat(gapRaw) || 16;
    const visible = visibleTodayDealsCards();
    const trackWidth = track.getBoundingClientRect().width;
    if (trackWidth < 40) return;

    const width = Math.max(120, Math.floor((trackWidth - gap * (visible - 1)) / visible));
    cards.forEach((card) => {
      card.style.flex = '0 0 auto';
      card.style.width = `${width}px`;
      card.style.minWidth = `${width}px`;
      card.style.maxWidth = `${width}px`;
    });
  }

  function stopTodayDealsAutoScroll() {
    if (autoScrollTimer) {
      clearInterval(autoScrollTimer);
      autoScrollTimer = null;
    }
  }

  function initTodayDealsAutoScroll() {
    const track = document.getElementById('today-deals-grid');
    if (!track) return;

    stopTodayDealsAutoScroll();

    const cards = () => track.querySelectorAll('.today-deals-card');
    if (cards().length <= visibleTodayDealsCards()) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let paused = false;
    let inViewport = false;

    const viewportObserver = new IntersectionObserver(
      (entries) => {
        inViewport = Boolean(entries[0]?.isIntersecting);
      },
      { root: null, threshold: 0.25 }
    );
    viewportObserver.observe(track);
    track._rakuTodayDealsViewportObs?.disconnect();
    track._rakuTodayDealsViewportObs = viewportObserver;

    if (!track._rakuTodayDealsScrollBound) {
      track._rakuTodayDealsScrollBound = true;
      track.addEventListener('mouseenter', () => {
        paused = true;
      });
      track.addEventListener('mouseleave', () => {
        paused = false;
      });
      track.addEventListener(
        'touchstart',
        () => {
          paused = true;
        },
        { passive: true }
      );
      track.addEventListener(
        'touchend',
        () => {
          setTimeout(() => {
            paused = false;
          }, 4000);
        },
        { passive: true }
      );
    }

    function scrollStep() {
      if (paused || !inViewport) return;
      const list = cards();
      if (list.length <= visibleTodayDealsCards()) return;

      const styles = getComputedStyle(track);
      const gapRaw = styles.columnGap && styles.columnGap !== 'normal' ? styles.columnGap : styles.gap;
      const gap = Number.parseFloat(gapRaw) || 16;
      const stepPx = list[0].offsetWidth + gap;
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (maxScroll <= 4) return;

      const next = track.scrollLeft + stepPx;
      if (next >= maxScroll - 4) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        track.scrollTo({ left: next, behavior: 'smooth' });
      }
    }

    autoScrollTimer = setInterval(scrollStep, 3200);
  }

  function bindTodayDealsScrollLayout() {
    const track = document.getElementById('today-deals-grid');
    if (!track) return;

    requestAnimationFrame(() => {
      syncTodayDealsCardWidths();
      setTimeout(() => {
        syncTodayDealsCardWidths();
        initTodayDealsAutoScroll();
      }, 50);
    });

    if (!window._rakuTodayDealsResizeBound) {
      window._rakuTodayDealsResizeBound = true;
      let timer;
      window.addEventListener('resize', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          syncTodayDealsCardWidths();
          initTodayDealsAutoScroll();
        }, 100);
      });
    }

    if (typeof ResizeObserver === 'function') {
      resizeObserver?.disconnect();
      resizeObserver = new ResizeObserver(() => syncTodayDealsCardWidths());
      resizeObserver.observe(track);
    }
  }

  function pad2(n) {
    return String(Math.max(0, n)).padStart(2, '0');
  }

  function renderCountdown() {
    const el = document.getElementById('today-deals-countdown');
    const section = document.getElementById('section-today-deals');
    if (!el || !endsAtMs) return;

    const diff = endsAtMs - Date.now();
    if (diff <= 0) {
      stopCountdown();
      if (section) section.hidden = true;
      return;
    }

    const totalSec = Math.floor(diff / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    el.innerHTML = `
      <span class="today-deals-countdown-part"><strong>${pad2(days)}</strong><small>Days</small></span>
      <span class="today-deals-countdown-sep">:</span>
      <span class="today-deals-countdown-part"><strong>${pad2(hours)}</strong><small>Hours</small></span>
      <span class="today-deals-countdown-sep">:</span>
      <span class="today-deals-countdown-part"><strong>${pad2(mins)}</strong><small>Mins</small></span>
      <span class="today-deals-countdown-sep">:</span>
      <span class="today-deals-countdown-part"><strong>${pad2(secs)}</strong><small>Secs</small></span>`;
  }

  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function startCountdown(endsAt) {
    stopCountdown();
    endsAtMs = endsAt ? Date.parse(endsAt) : NaN;
    const el = document.getElementById('today-deals-countdown');
    if (!el || !Number.isFinite(endsAtMs)) {
      if (el) el.hidden = true;
      return;
    }
    el.hidden = false;
    renderCountdown();
    countdownTimer = setInterval(renderCountdown, 1000);
  }

  function bindViewAll() {
    const btn = document.getElementById('see-all-today-deals');
    if (!btn || btn._rakuBound) return;
    btn._rakuBound = true;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.openCategory) window.openCategory('today-deals');
      else if (window.showPage) window.showPage('home');
    });
  }

  window.applyTodayDealsData = function applyTodayDealsData(boot) {
    const section = document.getElementById('section-today-deals');
    const grid = document.getElementById('today-deals-grid');
    const titleEl = document.getElementById('today-deals-title');
    if (!section || !grid) return;

    const meta = boot?.todayDealsMeta || boot?.meta || {};
    const products = boot?.todayDeals || boot?.products || [];
    const enabled = meta.enabled !== false;
    const title = meta.title || 'Today Deals';

    if (titleEl) titleEl.textContent = title;
    window._rakuSetHomeCollectionLabel?.('today-deals', title);

    if (!enabled || !products.length) {
      section.hidden = true;
      grid.innerHTML = '';
      stopCountdown();
      stopTodayDealsAutoScroll();
      return;
    }

    section.hidden = false;
    grid.innerHTML = products.map((p) => cardHtml(p)).join('');
    startCountdown(meta.endsAt);
    bindViewAll();
    bindTodayDealsScrollLayout();

    if (window._rakuBindProductGrid) window._rakuBindProductGrid();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && endsAtMs) renderCountdown();
  });
})();
