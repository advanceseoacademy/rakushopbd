(function () {
  const API = (window.RAKU_API_BASE || '') + '/api';

  const DOM = {
    privacy: {
      title: 'legal-privacy-title',
      sub: 'legal-privacy-sub',
      body: 'legal-privacy-body',
      icon: 'ti-shield-lock',
      apiSlug: 'privacy',
    },
    terms: {
      title: 'legal-terms-title',
      sub: 'legal-terms-sub',
      body: 'legal-terms-body',
      icon: 'ti-file-text',
      apiSlug: 'terms',
    },
    return: {
      title: 'legal-return-title',
      sub: 'legal-return-sub',
      body: 'legal-return-body',
      icon: 'ti-refresh',
      apiSlug: 'return',
    },
    preorder: {
      title: 'legal-preorder-title',
      sub: 'legal-preorder-sub',
      body: 'legal-preorder-body',
      icon: 'ti-clock-hour-4',
      apiSlug: 'preorder',
    },
  };

  const SETTINGS_KEYS = {
    privacy: { title: 'legal_privacy_title', content: 'legal_privacy_content' },
    terms: { title: 'legal_terms_title', content: 'legal_terms_content' },
    return: { title: 'legal_return_title', content: 'legal_return_content' },
    preorder: { title: 'legal_preorder_title', content: 'legal_preorder_content' },
  };

  const DEFAULTS = {
    privacy: {
      title: 'Privacy Policy',
      sub: 'How we collect and use your information.',
    },
    terms: {
      title: 'Terms & Conditions',
      sub: 'Rules for using our store and placing orders.',
    },
    return: {
      title: 'Return Policy',
      sub: 'Returns within 7 days — eligibility and how to apply.',
    },
    preorder: {
      title: 'Pre-Order Policy',
      sub: 'How pre-orders work for authentic Japanese skincare and beauty products.',
    },
  };

  function pageFromSettings(pageKey, settings) {
    const keys = SETTINGS_KEYS[pageKey];
    const defs = DEFAULTS[pageKey];
    if (!keys || !settings) return null;
    const title = String(settings[keys.title] || '').trim() || defs.title;
    const content = String(settings[keys.content] || '').trim();
    if (!content) return null;
    return { title, subtitle: defs.sub, content };
  }

  function renderPage(pageKey, data) {
    const dom = DOM[pageKey];
    const defs = DEFAULTS[pageKey];
    if (!dom || !data) return;

    const titleEl = document.getElementById(dom.title);
    const subEl = document.getElementById(dom.sub);
    const bodyEl = document.getElementById(dom.body);

    if (titleEl) {
      titleEl.innerHTML = `<i class="ti ${dom.icon}"></i> ${escapeHtml(data.title || defs.title)}`;
    }
    if (subEl && data.subtitle) subEl.textContent = data.subtitle;
    if (bodyEl) bodyEl.innerHTML = data.content;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function loadAndRender(pageKey) {
    const dom = DOM[pageKey];
    if (!dom) return;

    const cached = pageFromSettings(pageKey, window._rakuStoreSettings);
    if (cached) {
      renderPage(pageKey, cached);
      return;
    }

    try {
      const res = await fetch(`${API}/legal-pages/${dom.apiSlug}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (data.ok && data.page) {
        renderPage(pageKey, data.page);
        return;
      }
    } catch (_) {
      /* fall through */
    }

    const bodyEl = document.getElementById(dom.body);
    if (bodyEl) {
      bodyEl.innerHTML =
        '<p style="color:var(--text-muted);">Could not load this page. Please try again or <a href="/contact">contact us</a>.</p>';
    }
  }

  function init(pageKey) {
    const page = document.getElementById(`page-${pageKey}`);
    if (!page || page.style.display === 'none') return;
    void loadAndRender(pageKey);
  }

  window._rakuInitLegalPrivacy = () => init('privacy');
  window._rakuInitLegalTerms = () => init('terms');
  window._rakuInitLegalReturn = () => init('return');
  window._rakuInitLegalPreorder = () => init('preorder');

  document.addEventListener('raku:settings-loaded', (e) => {
    const settings = e.detail || window._rakuStoreSettings;
    ['privacy', 'terms', 'return', 'preorder'].forEach((key) => {
      const page = document.getElementById(`page-${key}`);
      if (page && page.style.display !== 'none') {
        const data = pageFromSettings(key, settings);
        if (data) renderPage(key, data);
      }
    });
  });
})();
