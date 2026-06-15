/**
 * Homepage marketing cards + surprise gift popup (homepage only, 24h dismiss).
 */
(function () {
  const API = (window.RAKU_API_BASE || '') + '/api';
  const DISMISS_KEY = 'raku_gift_popup_dismissed_at';
  const DISMISS_MS = 24 * 60 * 60 * 1000;
  const POPUP_DELAY_MS = 1500;

  const MARKETING_DEFAULTS = {
    marketing_enabled: '1',
    marketing_card1_title: 'Save More with Group Shopping!',
    marketing_card1_desc:
      'Join friends and family to unlock amazing discounts on our selected popular products. Our group shopping feature lets you enjoy bulk savings while shopping together.',
    marketing_card1_btn: 'Start Group Shopping',
    marketing_card1_link: '#products',
    marketing_card1_image: '/uploads/1780840201419-groupshopping.webp',
    marketing_card1_bg: '#fce4ec',
    marketing_card2_title: 'Get Surprise gift',
    marketing_card2_desc:
      'Subscribe with your phone number to get new gifts and updates about our new products and offers',
    marketing_card2_btn: 'Submit',
    marketing_card2_image: '/uploads/1780840201433-surprise-banner.webp',
    marketing_card2_bg: '#ede7f6',
  };

  let popupTimer = null;
  let marketingEnabled = true;

  function marketingValue(settings, key) {
    const raw = settings?.[key];
    if (String(raw ?? '').trim()) return raw;
    return MARKETING_DEFAULTS[key] ?? '';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function paintImage(el, url) {
    if (!el) return;
    const src = String(url || '').trim();
    if (src) {
      el.innerHTML = `<img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async">`;
    } else {
      el.innerHTML = '<i class="ti ti-photo"></i>';
    }
  }

  function isHomePageVisible() {
    const home = document.getElementById('page-home');
    if (!home) return false;
    return home.style.display !== 'none' && window.getComputedStyle(home).display !== 'none';
  }

  function isHomeRoute() {
    if (window._rakuVisiblePage && window._rakuVisiblePage !== 'home') return false;
    const parts = (location.pathname || '/').split('/').filter(Boolean);
    if (parts.length > 0) return false;
    return isHomePageVisible();
  }

  function cancelGiftPopupTimer() {
    clearTimeout(popupTimer);
    popupTimer = null;
  }

  function isPopupDismissed() {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      const at = Number(raw);
      if (!at) return false;
      return Date.now() - at < DISMISS_MS;
    } catch (_) {
      return false;
    }
  }

  function dismissPopup() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch (_) {}
    closeGiftPopup();
  }

  function closeGiftPopup() {
    const popup = document.getElementById('gift-popup');
    if (!popup) return;
    popup.hidden = true;
    popup.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gift-popup-open');
  }

  function openGiftPopup() {
    if (!marketingEnabled || isPopupDismissed() || !isHomeRoute()) return;
    const popup = document.getElementById('gift-popup');
    if (!popup) return;
    popup.hidden = false;
    popup.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gift-popup-open');
    document.getElementById('gift-popup-phone')?.focus();
  }

  function scheduleGiftPopup() {
    cancelGiftPopupTimer();
    if (!marketingEnabled || isPopupDismissed() || !isHomeRoute()) return;
    popupTimer = setTimeout(openGiftPopup, POPUP_DELAY_MS);
  }

  function paintGiftPopup(settings) {
    const title = document.getElementById('gift-popup-title');
    const desc = document.getElementById('gift-popup-desc');
    const btn = document.getElementById('gift-popup-submit');
    if (title) title.textContent = marketingValue(settings, 'marketing_card2_title');
    if (desc) desc.textContent = marketingValue(settings, 'marketing_card2_desc');
    if (btn) {
      const label = btn.querySelector('span');
      const text = marketingValue(settings, 'marketing_card2_btn');
      btn.dataset.defaultLabel = text;
      if (label) label.textContent = text;
    }
    paintImage(document.getElementById('gift-popup-img'), marketingValue(settings, 'marketing_card2_image'));
  }

  function applyHomeMarketing(settings) {
    const section = document.getElementById('home-marketing');
    if (!section || !settings) return;

    marketingEnabled = settings.marketing_enabled !== '0';

    if (!marketingEnabled) {
      section.hidden = true;
      cancelGiftPopupTimer();
      closeGiftPopup();
      return;
    }

    section.hidden = false;

    const card1 = document.getElementById('marketing-card-1');
    const card2 = document.getElementById('marketing-card-2');
    if (card1) card1.style.background = marketingValue(settings, 'marketing_card1_bg');
    if (card2) card2.style.background = marketingValue(settings, 'marketing_card2_bg');

    const t1 = document.getElementById('marketing-title-1');
    const d1 = document.getElementById('marketing-desc-1');
    const b1 = document.getElementById('marketing-btn-1');
    if (t1) t1.textContent = marketingValue(settings, 'marketing_card1_title');
    if (d1) d1.textContent = marketingValue(settings, 'marketing_card1_desc');
    if (b1) {
      b1.textContent = marketingValue(settings, 'marketing_card1_btn');
      b1.href = marketingValue(settings, 'marketing_card1_link') || '#products';
    }

    paintImage(document.getElementById('marketing-img-1'), marketingValue(settings, 'marketing_card1_image'));

    const t2 = document.getElementById('marketing-title-2');
    const d2 = document.getElementById('marketing-desc-2');
    const b2 = document.getElementById('marketing-btn-2');
    if (t2) t2.textContent = marketingValue(settings, 'marketing_card2_title');
    if (d2) d2.textContent = marketingValue(settings, 'marketing_card2_desc');
    if (b2) {
      b2.textContent = marketingValue(settings, 'marketing_card2_btn');
      b2.dataset.defaultLabel = marketingValue(settings, 'marketing_card2_btn');
    }

    paintImage(document.getElementById('marketing-img-2'), marketingValue(settings, 'marketing_card2_image'));
    paintGiftPopup(settings);

    if (isHomeRoute()) scheduleGiftPopup();
    else {
      cancelGiftPopupTimer();
      closeGiftPopup();
    }
  }

  async function submitPhone(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const isPopup = form.id === 'gift-popup-form';
    const input = form.querySelector('input[type="tel"]');
    const msg = document.getElementById(isPopup ? 'gift-popup-msg' : 'marketing-subscribe-msg');
    const btn = document.getElementById(isPopup ? 'gift-popup-submit' : 'marketing-btn-2');
    if (!input) return;

    const phone = input.value.replace(/\s/g, '').trim();
    if (msg) {
      msg.hidden = true;
      msg.className = isPopup ? 'home-marketing-msg gift-popup-msg' : 'home-marketing-msg';
    }
    if (btn) {
      btn.disabled = true;
      if (isPopup) {
        const label = btn.querySelector('span');
        if (label) label.textContent = 'Submitting…';
      } else {
        btn.dataset.prevText = btn.textContent;
        btn.textContent = 'Submitting…';
      }
    }

    try {
      const res = await fetch(API + '/marketing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (msg) {
        msg.hidden = false;
        if (data.ok) {
          msg.textContent = data.message || 'Thank you for subscribing!';
          msg.classList.add('ok');
          input.value = '';
          if (isPopup) setTimeout(dismissPopup, 1800);
        } else {
          msg.textContent = data.error || 'Could not subscribe. Please try again.';
          msg.classList.add('err');
        }
      }
    } catch (_) {
      if (msg) {
        msg.hidden = false;
        msg.textContent = 'Network error. Please try again.';
        msg.classList.add('err');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        if (isPopup) {
          const label = btn.querySelector('span');
          if (label) label.textContent = btn.dataset.defaultLabel || 'Submit';
        } else {
          btn.textContent = btn.dataset.defaultLabel || btn.dataset.prevText || 'Submit';
        }
      }
    }
  }

  function bindForms() {
    document.getElementById('gift-popup-form')?.addEventListener('submit', submitPhone);
    document.getElementById('marketing-subscribe-form')?.addEventListener('submit', submitPhone);

    document.querySelectorAll('[data-gift-popup-close]').forEach((el) => {
      el.addEventListener('click', dismissPopup);
    });

    document.addEventListener('keydown', (e) => {
      const popup = document.getElementById('gift-popup');
      if (e.key === 'Escape' && popup && !popup.hidden) dismissPopup();
    });

    document.addEventListener('raku:navigate', (e) => {
      if (e.detail?.page === 'home') {
        scheduleGiftPopup();
        return;
      }
      cancelGiftPopupTimer();
      closeGiftPopup();
    });
  }

  document.addEventListener('raku:bootstrap', (e) => {
    applyHomeMarketing(e.detail?.settings);
  });

  document.addEventListener('DOMContentLoaded', () => {
    bindForms();
    if (window.__RAKU_BOOTSTRAP?.settings) {
      applyHomeMarketing(window.__RAKU_BOOTSTRAP.settings);
    }
  });

  window._rakuApplyHomeMarketing = applyHomeMarketing;
})();
