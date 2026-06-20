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
          <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">
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
      track.innerHTML = '';
      return;
    }

    section.hidden = false;
    track.innerHTML = list.map(chatCardHtml).join('');

    function startMessengerScroll() {
      if (window._rakuSyncHomeCarouselCardWidths) {
        window._rakuSyncHomeCarouselCardWidths('track-messenger-reviews', '.home-messenger-card', 220);
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

  document.addEventListener('raku:ready', () => {
    void refreshMessengerSection();
  });
  document.addEventListener('raku:bootstrap', (e) => {
    const boot = e.detail;
    paintMessengerChats(boot?.messengerChats, boot?.settings);
  });

  window._rakuPaintMessengerChats = paintMessengerChats;
})();
