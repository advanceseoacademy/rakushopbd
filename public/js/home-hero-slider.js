/**
 * Homepage hero — full-width banner slider.
 */
(function () {
  let timer = null;
  let index = 0;
  let slides = [];
  let intervalMs = 4500;
  let sliderRoot = null;

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function imgSrc(url) {
    const u = String(url || '').trim();
    if (!u) return '';
    const path = u.startsWith('/') ? u : `/${u}`;
    if (window._rakuMediaUrl && (path.startsWith('/uploads/') || path.startsWith('/images/'))) {
      return window._rakuMediaUrl(path, 1200);
    }
    if (window.productImageSrc) return window.productImageSrc(u);
    return path;
  }

  function slideHtml(slide, i) {
    const src = esc(imgSrc(slide.image));
    const alt = esc(slide.alt || 'Homepage banner');
    const link = String(slide.link || '').trim();
    const priority = i === 0 ? ' fetchpriority="high"' : '';
    const inner = `<img class="hero-banner-slide-photo" src="${src}" alt="${alt}" width="1200" height="400" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async"${priority}>`;
    if (link && link !== '#') {
      const href = link.startsWith('/') || /^https?:\/\//i.test(link) ? link : `/${link}`;
      return `<a href="${esc(href)}" class="hero-banner-slide" data-slide-index="${i}">${inner}</a>`;
    }
    return `<div class="hero-banner-slide" data-slide-index="${i}">${inner}</div>`;
  }

  function sliderMarkup() {
    return `<div class="hero-banner-slider">
      <div class="hero-banner-slider-track" id="hero-banner-slider-track"></div>
      <button type="button" class="hero-banner-slider-nav hero-banner-slider-nav--prev" aria-label="Previous slide"><i class="ti ti-chevron-left"></i></button>
      <button type="button" class="hero-banner-slider-nav hero-banner-slider-nav--next" aria-label="Next slide"><i class="ti ti-chevron-right"></i></button>
      <div class="hero-banner-slider-dots" id="hero-banner-slider-dots" role="tablist" aria-label="Banner slides"></div>
    </div>`;
  }

  function bindSlideLinks(root) {
    if (!root || window.RAKU_STANDALONE) return;
    root.querySelectorAll('a.hero-banner-slide').forEach((link) => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href') || '';
        if (!href || href === '#') return;
        if (href.startsWith('http') || href.startsWith('//')) return;
        if (!window.showPage) return;
        const path = href.replace(/^\//, '').split('/').filter(Boolean);
        if (path[0] === 'category' && path[1] && window.openCategory) {
          e.preventDefault();
          void window.openCategory(decodeURIComponent(path[1]));
        } else if (path[0] === 'product' && path[1] && window.openProduct) {
          e.preventDefault();
          void window.openProduct(decodeURIComponent(path[1]));
        } else if (path[0] === 'products' || href === '/#products' || href.includes('#products')) {
          e.preventDefault();
          window.showPage('home');
          requestAnimationFrame(() => {
            document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
          });
        }
      });
    });
  }

  function getTrack() {
    return document.getElementById('hero-banner-slider-track');
  }

  function getDots() {
    return document.getElementById('hero-banner-slider-dots');
  }

  function showSlide(nextIndex) {
    const track = getTrack();
    const dots = getDots();
    if (!track || !slides.length) return;

    index = ((nextIndex % slides.length) + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;

    track.querySelectorAll('.hero-banner-slide').forEach((el, i) => {
      el.classList.toggle('is-active', i === index);
    });
    dots?.querySelectorAll('.hero-banner-slider-dot').forEach((dot, i) => {
      dot.classList.toggle('is-active', i === index);
      dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
  }

  function stopAuto() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function startAuto() {
    stopAuto();
    if (slides.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    timer = setInterval(() => showSlide(index + 1), intervalMs);
  }

  function bindSliderControls(root) {
    if (!root || root._rakuSliderBound) return;
    root._rakuSliderBound = true;

    root.querySelector('.hero-banner-slider-nav--prev')?.addEventListener('click', () => {
      showSlide(index - 1);
      startAuto();
    });
    root.querySelector('.hero-banner-slider-nav--next')?.addEventListener('click', () => {
      showSlide(index + 1);
      startAuto();
    });
    root.addEventListener('mouseenter', stopAuto);
    root.addEventListener('mouseleave', startAuto);
  }

  function bindSliderDots(dotsEl) {
    if (!dotsEl) return;
    dotsEl.setAttribute('role', 'tablist');
    dotsEl.setAttribute('aria-label', 'Banner slides');
    dotsEl.innerHTML = slides
      .map(
        (_, i) =>
          `<button type="button" class="hero-banner-slider-dot${i === 0 ? ' is-active' : ''}" role="tab" data-slide="${i}" aria-label="Slide ${i + 1}" aria-selected="${i === 0 ? 'true' : 'false'}"></button>`
      )
      .join('');
    dotsEl.querySelectorAll('.hero-banner-slider-dot').forEach((dot) => {
      dot.addEventListener('click', () => {
        showSlide(Number(dot.dataset.slide));
        startAuto();
      });
    });
  }

  function toggleSliderNav(show) {
    sliderRoot?.querySelector('.hero-banner-slider-nav--prev')?.toggleAttribute('hidden', !show);
    sliderRoot?.querySelector('.hero-banner-slider-nav--next')?.toggleAttribute('hidden', !show);
  }

  function finishSliderInit(track) {
    const heroMain = document.getElementById('hero-main');
    bindSlideLinks(track);
    bindSliderControls(sliderRoot);
    bindSliderDots(getDots());
    toggleSliderNav(slides.length > 1);
    showSlide(0);
    startAuto();
    if (heroMain) heroMain.dataset.heroReady = '1';
  }

  window.syncHeroSideHeight = function syncHeroSideHeight() {};

  window.applyHeroSideSliderData = function applyHeroSideSliderData(payload) {
    const heroMain = document.getElementById('hero-main');
    if (!heroMain) return;

    const data = payload?.slides ? payload : payload?.heroSideSlider || {};
    const enabled = data.enabled !== false;
    slides = Array.isArray(data.slides) ? data.slides.filter((s) => s?.image) : [];
    intervalMs = Number(data.intervalMs) || 4500;
    index = 0;
    stopAuto();

    if (!enabled || !slides.length) {
      sliderRoot = null;
      delete heroMain.dataset.heroReady;
      return;
    }

    if (heroMain.dataset.heroReady === '1') return;

    if (
      !heroMain.dataset.heroSsr &&
      heroMain.querySelector('.hero-banner-slide-photo[fetchpriority="high"]')
    ) {
      heroMain.dataset.heroSsr = '1';
    }

    if (heroMain.dataset.heroSsr === '1') {
      delete heroMain.dataset.heroSsr;
      sliderRoot = heroMain.querySelector('.hero-banner-slider');
      const track = getTrack();
      if (!track || !sliderRoot) return;
      if (slides.length > 1) {
        track.insertAdjacentHTML('beforeend', slides.slice(1).map((s, i) => slideHtml(s, i + 1)).join(''));
      }
      finishSliderInit(track);
      return;
    }

    heroMain.className = 'hero-main hero-main--slider hero-main--has-bg-photo';
    heroMain.style.cursor = '';
    heroMain.onclick = null;
    heroMain.innerHTML = sliderMarkup();
    sliderRoot = heroMain.querySelector('.hero-banner-slider');

    const track = getTrack();
    if (!track || !sliderRoot) return;

    track.innerHTML = slides.map((s, i) => slideHtml(s, i)).join('');
    finishSliderInit(track);
  };

  const heroBoot = window.__RAKU_BOOTSTRAP?.heroSideSlider;
  if (heroBoot?.enabled !== false && heroBoot?.slides?.length) {
    window.applyHeroSideSliderData(heroBoot);
  }
})();
