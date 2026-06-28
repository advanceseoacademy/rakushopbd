/**
 * Homepage marketing cards + configurable popup templates.
 */
(function () {
  const API = (window.RAKU_API_BASE || '') + '/api';
  const LAST_SEEN_KEY = 'raku_popup_last_seen_at';
  const POPUP_PREVIEW_DRAFT_KEY = 'raku_popup_preview_draft';
  const POPUP_DELAY_MS = 1500;

  const MARKETING_DEFAULTS = {
    marketing_enabled: '1',
    marketing_card1_title: 'Save More with Group Shopping!',
    marketing_card1_desc:
      'Join friends and family to unlock amazing discounts on our selected popular products. Our group shopping feature lets you enjoy bulk savings while shopping together.',
    marketing_card1_btn: 'Start Group Shopping',
    marketing_card1_link: '#products',
    marketing_card1_image: '/uploads/1780840201419-groupshopping.webp',
    marketing_card1_bg: '#FDE8EF',
    marketing_card2_title: 'Get Surprise gift',
    marketing_card2_desc:
      'Subscribe with your phone number to get new gifts and updates about our new products and offers',
    marketing_card2_btn: 'Submit',
    marketing_card2_image: '/uploads/1780840201433-surprise-banner.webp',
    marketing_card2_bg: '#E8F3EA',
  };

  let popupTimer = null;
  let marketingEnabled = true;
  let popupEnabled = true;
  let popupIntervalHours = 24;
  let popupActiveTemplateId = 'gift';
  /** @type {any[]} */
  let popupTemplates = [];
  let activeTemplate = null;

  function getUrlParam(name) {
    try {
      return new URLSearchParams(location.search || '').get(name);
    } catch (_) {
      return null;
    }
  }

  function isPopupPreviewMode() {
    return getUrlParam('popup_preview') === '1';
  }

  function readPopupPreviewDraft() {
    if (!isPopupPreviewMode()) return null;
    try {
      const raw = sessionStorage.getItem(POPUP_PREVIEW_DRAFT_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const tpl = data?.template;
      if (tpl && typeof tpl === 'object') return tpl;
    } catch (_) {}
    return null;
  }

  function marketingValue(settings, key) {
    const raw = settings?.[key];
    if (String(raw ?? '').trim()) return raw;
    return MARKETING_DEFAULTS[key] ?? '';
  }

  function parseJson(raw, fallback) {
    try {
      if (raw == null) return fallback;
      if (typeof raw === 'string' && raw.trim()) return JSON.parse(raw);
      if (typeof raw === 'object') return raw;
    } catch (_) {}
    return fallback;
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
      const attrs = window.rakuImageAttrs
        ? window.rakuImageAttrs(src, {
            widths: [480, 640, 960],
            sizes: '(max-width: 768px) 100vw, 560px',
            srcWidth: 640,
          })
        : { src, srcset: '', sizes: '' };
      const srcset = attrs.srcset
        ? ` srcset="${escapeHtml(attrs.srcset)}" sizes="${escapeHtml(attrs.sizes)}"`
        : '';
      el.innerHTML = `<img src="${escapeHtml(attrs.src)}"${srcset} alt="" width="560" height="560" loading="lazy" decoding="async">`;
    } else {
      el.innerHTML = '<i class="ti ti-photo"></i>';
    }
  }

  function isHomePageVisible() {
    const home = document.getElementById('page-home');
    if (!home) return false;
    return home.style.display !== 'none';
  }

  function isHomeRoute() {
    const parts = (location.pathname || '/').split('/').filter(Boolean);
    if (parts.length > 0) return false;
    if (window._rakuVisiblePage && window._rakuVisiblePage !== 'home') return false;
    return isHomePageVisible();
  }

  function cancelGiftPopupTimer() {
    clearTimeout(popupTimer);
    popupTimer = null;
  }

  function getPopupLastSeenAt() {
    try {
      return Number(localStorage.getItem(LAST_SEEN_KEY) || '0') || 0;
    } catch (_) {
      return 0;
    }
  }

  function markPopupSeen() {
    if (isPopupPreviewMode()) return;
    try {
      localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
    } catch (_) {}
  }

  function dismissPopup() {
    markPopupSeen();
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
    if (!isPopupPreviewMode() && !popupEnabled) return;
    if (!isPopupPreviewMode() && !isHomeRoute()) return;
    if (!activeTemplate) return;
    const popup = document.getElementById('gift-popup');
    if (!popup) return;
    popup.hidden = false;
    popup.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gift-popup-open');
    if (activeTemplate.mode === 'subscribe') {
      document.getElementById('gift-popup-phone')?.focus();
    }
  }

  function scheduleGiftPopup() {
    cancelGiftPopupTimer();
    if (!isPopupPreviewMode() && !popupEnabled) return;
    if (isPopupPreviewMode()) return setTimeout(openGiftPopup, 50);
    if (!isHomeRoute()) return;
    const lastSeenAt = getPopupLastSeenAt();
    const intervalMs = Math.max(1, Number(popupIntervalHours) || 24) * 60 * 60 * 1000;
    if (lastSeenAt && Date.now() - lastSeenAt < intervalMs) return;
    popupTimer = setTimeout(openGiftPopup, POPUP_DELAY_MS);
  }

  function pickActiveTemplate() {
    const draft = readPopupPreviewDraft();
    const forced = getUrlParam('popup_template');
    if (draft && (!forced || String(draft.id) === String(forced))) return draft;
    if (forced) {
      const hit = popupTemplates.find((t) => String(t?.id) === String(forced));
      if (hit) return hit;
    }
    const activeId = String(popupActiveTemplateId || '').trim();
    if (activeId) {
      const chosen = popupTemplates.find(
        (t) => String(t?.id) === activeId && t.enabled !== false
      );
      if (chosen) return chosen;
    }
    return popupTemplates.find((t) => t && t.enabled !== false) || null;
  }

  function popupTemplateIsLinkMode(t) {
    if (!t) return false;
    if (String(t.id) === 'points') return true;
    return String(t.mode) === 'link';
  }

  function popupIconClass(icon) {
    const raw = String(icon || 'ti-gift').trim();
    return raw.startsWith('ti ') ? raw : `ti ${raw}`;
  }

  function applyPopupTheme(t) {
    const themeId = String(t?.id || 'gift').trim() || 'gift';
    const card = document.getElementById('gift-popup-card');
    const shell = document.getElementById('gift-popup');
    if (card) card.dataset.popupTheme = themeId;
    if (shell) shell.dataset.popupTheme = themeId;

    const iconClass = popupIconClass(t?.icon);
    const src = String(t?.image || '').trim();
    const showHero = themeId === 'points' || themeId === 'support';
    const themeIcon = document.getElementById('gift-popup-theme-icon');
    if (themeIcon) {
      themeIcon.hidden = !showHero;
      if (showHero) themeIcon.innerHTML = `<i class="${iconClass}"></i>`;
    }

    const imgEl = document.getElementById('gift-popup-img');
    if (imgEl && !src && (themeId === 'delivery' || themeId === 'new')) {
      imgEl.innerHTML = `<i class="${iconClass}"></i>`;
    }
  }

  function paintGiftPopup(settings) {
    const title = document.getElementById('gift-popup-title');
    const desc = document.getElementById('gift-popup-desc');
    const btn = document.getElementById('gift-popup-submit');
    const kicker = document.getElementById('gift-popup-kicker');
    const badge = document.getElementById('gift-popup-badge');
    const badgeIcon = document.getElementById('gift-popup-badge-icon');

    const t = activeTemplate || {};
    if (kicker) kicker.textContent = String(t.kicker || 'Exclusive offer');
    if (badge) badge.textContent = String(t.badge || 'Surprise gift');
    if (badgeIcon) badgeIcon.className = String(t.icon || 'ti ti-gift');
    if (title) title.textContent = String(t.title || marketingValue(settings, 'marketing_card2_title'));
    if (desc) desc.textContent = String(t.desc || marketingValue(settings, 'marketing_card2_desc'));
    if (btn) {
      const label = btn.querySelector('span');
      const text = String(t.button || marketingValue(settings, 'marketing_card2_btn'));
      btn.dataset.defaultLabel = text;
      if (label) label.textContent = text;
    }
    const imgSrc =
      String(t.image || '').trim() ||
      (String(t.id) === 'gift' ? String(marketingValue(settings, 'marketing_card2_image') || '').trim() : '');
    paintImage(document.getElementById('gift-popup-img'), imgSrc);
    applyPopupTheme({ ...t, image: imgSrc });

    // mode: link (signup/button) vs subscribe (phone)
    const form = document.getElementById('gift-popup-form');
    const phone = document.getElementById('gift-popup-phone');
    const phoneField = form?.querySelector('.gift-popup-field');
    const note = document.querySelector('.gift-popup-note');
    const isLink = popupTemplateIsLinkMode(t);
    const isSubscribe = !isLink;

    if (form) {
      form.dataset.popupMode = isSubscribe ? 'subscribe' : 'link';
      form.style.display = '';
    }
    if (phoneField) {
      phoneField.hidden = isLink;
      phoneField.style.display = isLink ? 'none' : '';
    }
    if (phone) phone.required = isSubscribe;
    if (note) {
      note.hidden = isLink;
      note.style.display = isLink ? 'none' : '';
    }

    if (btn) {
      if (isLink) {
        btn.type = 'button';
        const href = String(t.link || '/account?signup=1').trim() || '/account?signup=1';
        btn.onclick = () => {
          try {
            if (!isPopupPreviewMode()) markPopupSeen();
          } catch (_) {}
          window.location.href = href;
        };
      } else {
        btn.type = 'submit';
        btn.onclick = null;
      }
    }
  }

  function loadPopupConfig(settings) {
    if (!settings) return;
    popupEnabled = String(settings.popup_enabled ?? '1') !== '0';
    popupIntervalHours = Number(settings.popup_interval_hours || 24) || 24;
    popupActiveTemplateId = String(settings.popup_active_template || 'gift').trim() || 'gift';
    popupTemplates = (parseJson(settings.popup_templates, []) || []).map((t) => {
      if (!t || typeof t !== 'object') return t;
      if (String(t.id) === 'points') {
        return {
          ...t,
          mode: 'link',
          link: String(t.link || '/account?signup=1').trim() || '/account?signup=1',
          button: String(t.button || 'Sign up now').trim() || 'Sign up now',
        };
      }
      return t;
    });
    if (!Array.isArray(popupTemplates)) popupTemplates = [];
    activeTemplate = pickActiveTemplate();
  }

  function applyPopupFromSettings(settings) {
    loadPopupConfig(settings);
    if (!popupEnabled && !isPopupPreviewMode()) {
      cancelGiftPopupTimer();
      closeGiftPopup();
      return;
    }
    if (!activeTemplate) {
      cancelGiftPopupTimer();
      closeGiftPopup();
      return;
    }
    paintGiftPopup(settings);
    if (isHomeRoute() || isPopupPreviewMode()) scheduleGiftPopup();
    else {
      cancelGiftPopupTimer();
      closeGiftPopup();
    }
  }

  function applyMarketingCards(settings) {
    const section = document.getElementById('home-marketing');
    if (!section || !settings) return;

    marketingEnabled = settings.marketing_enabled !== '0';
    if (!marketingEnabled && !isPopupPreviewMode()) {
      section.hidden = true;
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
  }

  function applyHomeMarketing(settings) {
    if (!settings) return;
    applyPopupFromSettings(settings);
    applyMarketingCards(settings);
  }

  function bootHomeMarketing(settings) {
    if (!settings) return;
    applyPopupFromSettings(settings);
    if (isPopupPreviewMode()) {
      applyMarketingCards(settings);
      return;
    }
    const section = document.getElementById('home-marketing');
    if (!section) return;
    const runCards = () => applyMarketingCards(settings);
    if (window.rakuWhenVisible) {
      window.rakuWhenVisible('home-marketing', runCards, { rootMargin: '320px' });
    } else if (window.rakuScheduleIdle) {
      window.rakuScheduleIdle(runCards, { timeout: 3500 });
    } else {
      runCards();
    }
  }

  async function submitPhone(e) {
    e.preventDefault();
    const form = e.currentTarget;
    if (String(form?.dataset?.popupMode || 'subscribe') !== 'subscribe') return;
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
        const settings = window.__RAKU_BOOTSTRAP?.settings || window._rakuStoreSettings;
        if (settings) applyPopupFromSettings(settings);
        else scheduleGiftPopup();
        return;
      }
      cancelGiftPopupTimer();
      closeGiftPopup();
    });
  }

  document.addEventListener('raku:bootstrap', (e) => {
    bootHomeMarketing(e.detail?.settings);
  });

  function bootWhenReady() {
    const settings = window.__RAKU_BOOTSTRAP?.settings || window._rakuStoreSettings;
    if (settings) bootHomeMarketing(settings);
  }

  document.addEventListener('raku:ready', bootWhenReady);
  document.addEventListener('DOMContentLoaded', () => {
    bindForms();
    bootWhenReady();
  });

  window._rakuApplyHomeMarketing = applyHomeMarketing;
})();
