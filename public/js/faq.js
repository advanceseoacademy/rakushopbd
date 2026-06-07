(function () {
  const API = (window.RAKU_API_BASE || '') + '/api';

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function bindFaqAccordion(root) {
    root.querySelectorAll('.faq-q').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        if (!item) return;
        const wasOpen = item.classList.contains('open');
        root.querySelectorAll('.faq-item.open').forEach((el) => {
          el.classList.remove('open');
          el.querySelector('.faq-q')?.setAttribute('aria-expanded', 'false');
        });
        if (!wasOpen) {
          item.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  function renderFaqs(faqs) {
    const list = document.getElementById('faq-list');
    if (!list) return;

    if (!faqs.length) {
      list.innerHTML =
        '<p style="text-align:center;color:var(--text-muted);padding:24px;">No FAQs available right now. Please <a href="/contact">contact us</a>.</p>';
      return;
    }

    list.innerHTML = faqs
      .map(
        (f, i) => `<div class="faq-item${i === 0 ? ' open' : ''}">
          <button type="button" class="faq-q" aria-expanded="${i === 0 ? 'true' : 'false'}">${escapeHtml(f.question)}<i class="ti ti-chevron-down"></i></button>
          <div class="faq-a">${f.answer}</div>
        </div>`
      )
      .join('');

    bindFaqAccordion(list);
  }

  async function loadFaqs() {
    const list = document.getElementById('faq-list');
    if (!list) return;
    try {
      const res = await fetch(`${API}/faqs`, { credentials: 'same-origin' });
      const data = await res.json();
      if (data.ok && Array.isArray(data.faqs)) {
        renderFaqs(data.faqs);
        return;
      }
    } catch (_) {}
    list.innerHTML =
      '<p style="text-align:center;color:var(--text-muted);padding:24px;">Could not load FAQs. Please try again later or <a href="/contact">contact us</a>.</p>';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.getElementById('page-faq');
    if (page && page.style.display !== 'none') loadFaqs();
  });

  window._rakuInitFaqPage = loadFaqs;
})();
