/**
 * Homepage marketing cards — content from site settings (admin editable)
 */
(function () {
  const API = (window.RAKU_API_BASE || '') + '/api';

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

  function applyHomeMarketing(settings) {
    const section = document.getElementById('home-marketing');
    if (!section || !settings) return;

    if (settings.marketing_enabled === '0') {
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
    if (b2) b2.textContent = marketingValue(settings, 'marketing_card2_btn');

    paintImage(document.getElementById('marketing-img-2'), marketingValue(settings, 'marketing_card2_image'));
  }

  async function submitPhone(e) {
    e.preventDefault();
    const form = document.getElementById('marketing-subscribe-form');
    const input = document.getElementById('marketing-phone');
    const msg = document.getElementById('marketing-subscribe-msg');
    const btn = document.getElementById('marketing-btn-2');
    if (!form || !input) return;

    const phone = input.value.replace(/\s/g, '').trim();
    if (msg) {
      msg.hidden = true;
      msg.className = 'home-marketing-msg';
    }
    if (btn) btn.disabled = true;

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
      if (btn) btn.disabled = false;
    }
  }

  function bindForm() {
    document.getElementById('marketing-subscribe-form')?.addEventListener('submit', submitPhone);
  }

  document.addEventListener('raku:bootstrap', (e) => {
    applyHomeMarketing(e.detail?.settings);
  });

  document.addEventListener('DOMContentLoaded', () => {
    bindForm();
    if (window.__RAKU_BOOTSTRAP?.settings) {
      applyHomeMarketing(window.__RAKU_BOOTSTRAP.settings);
    }
  });

  window._rakuApplyHomeMarketing = applyHomeMarketing;
})();
