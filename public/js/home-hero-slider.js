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
    if (/^https?:\/\//i.test(u)) return u;
    return u.startsWith('/') ? u : `/${u}`;
  }

  function slideHtml(slide, i) {
    const alt = esc(slide.alt || 'Homepage banner');
    const link = String(slide.link || '').trim();
    const attrs = window.rakuImageAttrs
      ? window.rakuImageAttrs(slide.image, {
          widths: [640, 960, 1280],
          sizes: window.rakuImageSizes ? window.rakuImageSizes.heroBanner() : '(max-width: 768px) 100vw, 1200px',
          srcWidth: 960,
        })
      : { src: esc(imgSrc(slide.image)), srcset: '', sizes: '' };
    const srcset = attrs.srcset ? ` srcset="${esc(attrs.srcset)}" sizes="${esc(attrs.sizes)}"` : '';
    const priority = i === 0 ? ' fetchpriority="high"' : '';
    const inner = `<img class="hero-banner-slide-photo" src="${esc(attrs.src)}"${srcset} alt="${alt}" width="1200" height="480" loading="${i === 0 ? 'eager' : 'lazy'}"${priority} decoding="async">`;
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

  function configureDotsContainer(dotsEl) {
    if (!dotsEl) return;
    dotsEl.setAttribute('role', 'tablist');
    dotsEl.setAttribute('aria-label', 'Banner slides');
  }

  function bindSlideLinks(root) {
    if (!root || window.RAKU_STANDALONE) return;
    root.querySelectorAll('a.hero-banner-slide').forEach((link) => {
      if (link._rakuSlideLinkBound) return;
      link._rakuSlideLinkBound = true;
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

  function ensureFirstSlideLcpPriority() {
    const track = getTrack();
    const first =
      track?.querySelector('.hero-banner-slide.is-active .hero-banner-slide-photo') ||
      track?.querySelector('.hero-banner-slide-photo');
    if (!first) return;
    first.setAttribute('fetchpriority', 'high');
    first.loading = 'eager';
    first.decoding = 'async';
    if (!first.getAttribute('width')) first.setAttribute('width', '1200');
    if (!first.getAttribute('height')) first.setAttribute('height', '480');
  }

  function getDots() {
    return document.getElementById('hero-banner-slider-dots');
  }

  function getActiveSlideEl(track) {
    if (!track) return null;
    return track.querySelector(`.hero-banner-slide[data-slide-index="${index}"]`) || track.children[index] || null;
  }

  function bindImageHeightSync() {}

  function bindDots(root) {
    const dotsEl = getDots();
    if (!dotsEl) return;
    dotsEl.querySelectorAll('.hero-banner-slider-dot').forEach((dot) => {
      if (dot._rakuDotBound) return;
      dot._rakuDotBound = true;
      dot.addEventListener('click', () => {
        showSlide(Number(dot.dataset.slide));
        startAuto();
      });
    });
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
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
      dot.removeAttribute('aria-current');
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

  function bindResizeSync() {}

  function initExistingSlider(payload) {
    const heroMain = document.getElementById('hero-main');
    const existing = heroMain?.querySelector('.hero-banner-slider');
    const track = getTrack();
    if (!heroMain || !existing || !track || !track.children.length) return false;

    const data = payload?.slides ? payload : payload?.heroSideSlider || {};
    slides = Array.isArray(data.slides) ? data.slides.filter((s) => s?.image) : [];
    intervalMs = Number(data.intervalMs) || 4500;
    if (data.enabled === false || !slides.length) return false;
    if (track.children.length !== slides.length) return false;

    heroMain.className = 'hero-main hero-main--slider';
    heroMain.style.cursor = '';
    heroMain.onclick = null;
    sliderRoot = existing;
    index = 0;
    stopAuto();

    bindSlideLinks(track);
    bindSliderControls(sliderRoot);
    bindImageHeightSync(track);
    configureDotsContainer(getDots());
    bindDots(sliderRoot);
    bindResizeSync();
    showSlide(0);
    ensureFirstSlideLcpPriority();
    startAuto();
    return true;
  }

  function mountSlider(payload) {
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
      return;
    }

    if (initExistingSlider(payload)) return;

    heroMain.className = 'hero-main hero-main--slider';
    heroMain.style.cursor = '';
    heroMain.onclick = null;
    heroMain.innerHTML = sliderMarkup();
    sliderRoot = heroMain.querySelector('.hero-banner-slider');

    const track = getTrack();
    const dotsEl = getDots();
    if (!track || !dotsEl || !sliderRoot) return;

    configureDotsContainer(dotsEl);
    track.innerHTML = slides.map((s, i) => slideHtml(s, i)).join('');
    if (slides.length > 1) {
      dotsEl.innerHTML = slides
        .map(
          (_, i) =>
            `<button type="button" class="hero-banner-slider-dot${i === 0 ? ' is-active' : ''}" data-slide="${i}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-label="Slide ${i + 1}"></button>`
        )
        .join('');
    } else {
      dotsEl.innerHTML = '';
    }

    bindSlideLinks(track);
    bindSliderControls(sliderRoot);
    bindImageHeightSync(track);
    configureDotsContainer(getDots());
    bindDots(sliderRoot);
    bindResizeSync();
    showSlide(0);
    ensureFirstSlideLcpPriority();
    startAuto();
  }

  function bootHeroSlider(payload) {
    if (initExistingSlider(payload)) return;
    mountSlider(payload);
  }

  window.syncHeroSideHeight = function syncHeroSideHeight() {};

  window.applyHeroSideSliderData = mountSlider;

  if (window.__RAKU_BOOTSTRAP?.heroSideSlider?.slides?.length) {
    const boot = () => bootHeroSlider(window.__RAKU_BOOTSTRAP.heroSideSlider);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  }
})();
