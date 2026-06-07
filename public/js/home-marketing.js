/**
 * Homepage marketing cards — content from site settings (admin editable)
 */
(function () {
  const API = (window.RAKU_API_BASE || '') + '/api';

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
    if (card1) card1.style.background = settings.marketing_card1_bg || '#fce4ec';
    if (card2) card2.style.background = settings.marketing_card2_bg || '#ede7f6';

    const t1 = document.getElementById('marketing-title-1');
    const d1 = document.getElementById('marketing-desc-1');
    const b1 = document.getElementById('marketing-btn-1');
    if (t1) t1.textContent = settings.marketing_card1_title || '';
    if (d1) d1.textContent = settings.marketing_card1_desc || '';
    if (b1) {
      b1.textContent = settings.marketing_card1_btn || 'Learn more';
      b1.href = settings.marketing_card1_link || '#products';
    }

    paintImage(document.getElementById('marketing-img-1'), settings.marketing_card1_image);

    const t2 = document.getElementById('marketing-title-2');
    const d2 = document.getElementById('marketing-desc-2');
    const b2 = document.getElementById('marketing-btn-2');
    if (t2) t2.textContent = settings.marketing_card2_title || '';
    if (d2) d2.textContent = settings.marketing_card2_desc || '';
    if (b2) b2.textContent = settings.marketing_card2_btn || 'Submit';

    paintImage(document.getElementById('marketing-img-2'), settings.marketing_card2_image);
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
