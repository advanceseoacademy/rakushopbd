/**
 * Homepage YouTube videos — 1-per-screen horizontal scroll above "Our Customer Say"
 */
(function () {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function videoIdOf(v) {
    return String(v?.youtube_id || v?.youtubeId || '').trim();
  }

  function thumbUrl(id) {
    return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
  }

  function embedUrl(id) {
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1`;
  }

  function videoCardHtml(v) {
    const id = videoIdOf(v);
    if (!id) return '';
    const title = String(v.title || '').trim() || 'Watch video';
    const watchUrl = String(v.youtube_url || v.youtubeUrl || `https://youtu.be/${id}`).trim();
    return `<article class="home-video-card" data-youtube-id="${escapeHtml(id)}">
      <div class="home-video-media">
        <img class="home-video-thumb" src="${escapeHtml(thumbUrl(id))}" alt="${escapeHtml(title)}" width="480" height="270" loading="lazy" decoding="async" draggable="false">
        <button type="button" class="home-video-play-btn" aria-label="Play: ${escapeHtml(title)}"><i class="ti ti-player-play" aria-hidden="true"></i></button>
        <span class="home-video-yt" aria-hidden="true"><i class="ti ti-brand-youtube"></i></span>
      </div>
      <div class="home-video-meta">
        <span class="home-video-title">${escapeHtml(title)}</span>
        <a class="home-video-open" href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer">YouTube</a>
      </div>
    </article>`;
  }

  function scrollIntervalMs(settings) {
    const raw = Number(settings?.homepage_videos_scroll_interval);
    if (!Number.isFinite(raw)) return 4500;
    return Math.max(2000, Math.min(20000, Math.round(raw)));
  }

  function applySectionSettings(settings) {
    const section = document.getElementById('section-homepage-videos');
    if (!section) return false;

    const enabled = !settings || settings.homepage_videos_enabled !== '0';
    if (!enabled) {
      section.hidden = true;
      return false;
    }

    const titleEl = document.getElementById('homepage-videos-title');
    const subEl = document.getElementById('homepage-videos-sub');
    if (titleEl && settings?.homepage_videos_title) {
      titleEl.textContent = settings.homepage_videos_title;
    }
    if (subEl && settings?.homepage_videos_subtitle) {
      subEl.textContent = settings.homepage_videos_subtitle;
    }
    return true;
  }

  function cardStepPx(track) {
    const card = track.querySelector('.home-video-card');
    if (!card) return track.clientWidth || 0;
    const gap = Number.parseFloat(getComputedStyle(track).gap) || 16;
    return card.offsetWidth + gap;
  }

  function pauseAutoBriefly(settings) {
    if (window._rakuStopHomeScrollAuto) window._rakuStopHomeScrollAuto('track-homepage-videos');
    clearTimeout(pauseAutoBriefly._t);
    pauseAutoBriefly._t = setTimeout(() => {
      if (window._rakuInitHomeScrollAuto) {
        window._rakuInitHomeScrollAuto('track-homepage-videos', scrollIntervalMs(settings));
      }
    }, 6000);
  }

  function bindPlayButtons(track, settings) {
    track.querySelectorAll('.home-video-play-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.home-video-card');
        const media = card?.querySelector('.home-video-media');
        const id = card?.dataset.youtubeId;
        if (!id || !media) return;
        const wrap = document.createElement('div');
        wrap.className = 'home-video-embed';
        wrap.innerHTML = `<iframe src="${escapeHtml(embedUrl(id))}" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
        media.replaceWith(wrap);
        if (window._rakuStopHomeScrollAuto) {
          window._rakuStopHomeScrollAuto('track-homepage-videos');
        }
        pauseAutoBriefly(settings);
      });
    });
  }

  function bindSwipeAndNav(track, settings) {
    if (!track || track._rakuVideoSwipeBound) return;
    track._rakuVideoSwipeBound = true;

    // Native overflow scroll works both ways; pause auto while the user touches.
    track.addEventListener(
      'touchstart',
      (e) => {
        if (e.target.closest('iframe, .home-video-play-btn, a')) return;
        pauseAutoBriefly(settings);
      },
      { passive: true }
    );

    track.addEventListener(
      'touchend',
      () => {
        // Snap to nearest full video after a finger swipe (forward or back).
        const step = cardStepPx(track);
        if (step <= 0) return;
        const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
        const idx = Math.round(track.scrollLeft / step);
        const left = Math.max(0, Math.min(maxScroll, idx * step));
        track.scrollTo({ left, behavior: 'smooth' });
      },
      { passive: true }
    );
  }

  function paintHomepageVideos(videos, settings) {
    const section = document.getElementById('section-homepage-videos');
    const track = document.getElementById('track-homepage-videos');
    if (!section || !track) return;

    const enabled = applySectionSettings(settings);
    const list = (videos || []).filter((v) => videoIdOf(v));

    if (!enabled || !list.length) {
      section.hidden = true;
      section.removeAttribute('data-cls-placeholder');
      track.innerHTML = '';
      return;
    }

    section.hidden = false;
    section.removeAttribute('data-cls-placeholder');
    // Remove any leftover nav arrows from earlier builds
    section.querySelectorAll('.home-videos-nav').forEach((el) => el.remove());
    track.innerHTML = list.map(videoCardHtml).join('');
    bindPlayButtons(track, settings);
    bindSwipeAndNav(track, settings);

    function startScroll() {
      if (window._rakuSyncHomeCarouselCardWidths) {
        window._rakuSyncHomeCarouselCardWidths('track-homepage-videos', '.home-video-card', 280);
      } else if (window._rakuSyncHomeScrollCardWidths) {
        window._rakuSyncHomeScrollCardWidths();
      }
      if (window._rakuBindMobileHorizontalTrackScrollFix) {
        window._rakuBindMobileHorizontalTrackScrollFix(track);
      }
      if (window._rakuStopHomeScrollAuto) window._rakuStopHomeScrollAuto('track-homepage-videos');
      if (list.length >= 2 && window._rakuInitHomeScrollAuto) {
        window._rakuInitHomeScrollAuto('track-homepage-videos', scrollIntervalMs(settings));
      }
    }

    const imgs = track.querySelectorAll('img');
    if (!imgs.length) {
      requestAnimationFrame(() => setTimeout(startScroll, 100));
      return;
    }
    let pending = imgs.length;
    const done = () => {
      pending -= 1;
      if (pending <= 0) requestAnimationFrame(() => setTimeout(startScroll, 80));
    };
    imgs.forEach((img) => {
      if (img.complete) done();
      else {
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      }
    });
  }

  async function fetchHomepageVideos() {
    const base = window.RAKU_API_BASE || '';
    try {
      const res = await fetch(`${base}/api/homepage-videos`, { credentials: 'same-origin' });
      const data = await res.json();
      if (data?.ok && data.videos) return data.videos;
    } catch (_) {}
    return [];
  }

  async function refreshHomepageVideosSection() {
    const boot = window.__RAKU_BOOTSTRAP;
    const settings = boot?.settings || window._rakuStoreSettings || {};
    let videos = boot?.homepageVideos;
    if (!Array.isArray(videos)) {
      videos = await fetchHomepageVideos();
    }
    paintHomepageVideos(videos, settings);
  }

  function schedulePaint(boot) {
    const run = () => paintHomepageVideos(boot?.homepageVideos, boot?.settings);
    if (window.rakuWhenVisible) {
      window.rakuWhenVisible('section-homepage-videos', run, { rootMargin: '240px' });
    } else if (window.rakuScheduleIdle) {
      window.rakuScheduleIdle(run, { timeout: 3000 });
    } else {
      run();
    }
  }

  function bootSection(boot) {
    if (boot && Array.isArray(boot.homepageVideos)) {
      schedulePaint(boot);
      setTimeout(() => {
        const track = document.getElementById('track-homepage-videos');
        if (track?.querySelector('.home-video-card--skeleton')) {
          void refreshHomepageVideosSection();
        }
      }, 2500);
      return;
    }
    if (window.rakuWhenVisible) {
      window.rakuWhenVisible(
        'section-homepage-videos',
        () => void refreshHomepageVideosSection(),
        { rootMargin: '240px' }
      );
    } else {
      void refreshHomepageVideosSection();
    }
  }

  document.addEventListener('raku:ready', () => bootSection(window.__RAKU_BOOTSTRAP));
  document.addEventListener('raku:bootstrap', (e) => {
    bootSection(e.detail || window.__RAKU_BOOTSTRAP);
  });

  if (window.__RAKU_BOOTSTRAP || window.__RAKU_READY__) {
    bootSection(window.__RAKU_BOOTSTRAP);
  }

  window._rakuPaintHomepageVideos = paintHomepageVideos;
})();
