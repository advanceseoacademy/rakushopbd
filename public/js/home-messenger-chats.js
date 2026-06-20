/**
 * Homepage Messenger chat screenshots — admin-uploaded images
 */
(function () {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function chatImgHtml(src, alt) {
    const url = String(src || '').trim();
    if (!url) return '';
    let imgSrc = url;
    let srcset = '';
    if (window.rakuImageAttrs && url.startsWith('/uploads/')) {
      const attrs = window.rakuImageAttrs(url, {
        widths: [320, 480],
        sizes: '(max-width: 480px) 80vw, 220px',
        srcWidth: 320,
      });
      imgSrc = attrs.src || url;
      if (attrs.srcset) srcset = ` srcset="${escapeHtml(attrs.srcset)}" sizes="${escapeHtml(attrs.sizes)}"`;
    }
    return `<img src="${escapeHtml(imgSrc)}"${srcset} alt="${escapeHtml(alt)}" width="220" height="390" loading="lazy" decoding="async">`;
  }

  function chatCardHtml(chat) {
    const name = String(chat.customer_name || chat.customerName || '').trim() || 'Happy Customer';
    const caption = String(chat.caption || '').trim();
    const src = String(chat.image_url || chat.imageUrl || '').trim();
    const alt = `${name} — Messenger chat screenshot`;
    const captionHtml = caption
      ? `<p class="home-messenger-caption">${escapeHtml(caption)}</p>`
      : '';

    return `<article class="home-messenger-card">
      <div class="home-messenger-phone">
        <div class="home-messenger-header">
          <span class="home-messenger-header-icon"><i class="ti ti-brand-messenger"></i></span>
          <span class="home-messenger-header-label">Messenger</span>
        </div>
        <div class="home-messenger-screen">
          ${chatImgHtml(src, alt)}
        </div>
      </div>
      <div class="home-messenger-meta">
        <span class="home-messenger-name">${escapeHtml(name)}</span>
        <span class="home-review-verified"><i class="ti ti-circle-check-filled"></i> Verified chat</span>
      </div>
      ${captionHtml}
    </article>`;
  }

  function applySectionSettings(settings) {
    const section = document.getElementById('section-messenger-reviews');
    if (!section) return false;

    const enabled = !settings || settings.messenger_chats_enabled !== '0';
    if (!enabled) {
      section.hidden = true;
      return false;
    }

    const titleEl = document.getElementById('messenger-reviews-title');
    const subEl = document.getElementById('messenger-reviews-sub');
    if (titleEl && settings?.messenger_chats_title) {
      titleEl.textContent = settings.messenger_chats_title;
    }
    if (subEl && settings?.messenger_chats_subtitle) {
      subEl.textContent = settings.messenger_chats_subtitle;
    }
    return true;
  }

  function paintMessengerChats(chats, settings) {
    const section = document.getElementById('section-messenger-reviews');
    const track = document.getElementById('track-messenger-reviews');
    if (!section || !track) return;

    const enabled = applySectionSettings(settings);
    const list = (chats || []).filter((c) => c?.image_url || c?.imageUrl);

    if (!enabled || !list.length) {
      section.hidden = true;
      section.removeAttribute('data-cls-placeholder');
      track.innerHTML = '';
      return;
    }

    section.hidden = false;
    section.removeAttribute('data-cls-placeholder');
    track.innerHTML = list.map(chatCardHtml).join('');

    function startMessengerScroll() {
      if (window._rakuSyncHomeScrollCardWidths) {
        window._rakuSyncHomeScrollCardWidths('track-messenger-reviews', '.home-messenger-card', 220);
      }
      if (window._rakuStopHomeScrollAuto) window._rakuStopHomeScrollAuto('track-messenger-reviews');
      if (window._rakuInitHomeScrollAuto) {
        window._rakuInitHomeScrollAuto('track-messenger-reviews', 4000);
      }
    }

    const imgs = track.querySelectorAll('img');
    if (!imgs.length) {
      requestAnimationFrame(() => setTimeout(startMessengerScroll, 100));
      return;
    }

    let pending = imgs.length;
    const done = () => {
      pending -= 1;
      if (pending <= 0) requestAnimationFrame(() => setTimeout(startMessengerScroll, 80));
    };
    imgs.forEach((img) => {
      if (img.complete) done();
      else {
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      }
    });
  }

  async function fetchMessengerChats() {
    const base = window.RAKU_API_BASE || '';
    try {
      const res = await fetch(`${base}/api/messenger-chats`, { credentials: 'same-origin' });
      const data = await res.json();
      if (data?.ok && data.chats) return data.chats;
    } catch (_) {}
    return [];
  }

  async function refreshMessengerSection() {
    const boot = window.__RAKU_BOOTSTRAP;
    const settings = boot?.settings || window._rakuStoreSettings || {};
    let chats = boot?.messengerChats;

    if (!Array.isArray(chats)) {
      chats = await fetchMessengerChats();
    }

    paintMessengerChats(chats, settings);
  }

  function scheduleMessengerPaint(boot) {
    const run = () => paintMessengerChats(boot?.messengerChats, boot?.settings);
    if (window.rakuWhenVisible) {
      window.rakuWhenVisible('section-messenger-reviews', run, { rootMargin: '240px' });
    } else if (window.rakuScheduleIdle) {
      window.rakuScheduleIdle(run, { timeout: 3000 });
    } else {
      run();
    }
  }

  document.addEventListener('raku:ready', () => {
    if (window.rakuWhenVisible) {
      window.rakuWhenVisible('section-messenger-reviews', () => void refreshMessengerSection(), { rootMargin: '240px' });
    } else {
      void refreshMessengerSection();
    }
  });
  document.addEventListener('raku:bootstrap', (e) => {
    scheduleMessengerPaint(e.detail);
  });

  window._rakuPaintMessengerChats = paintMessengerChats;
})();
