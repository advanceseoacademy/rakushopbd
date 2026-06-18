/**
 * Apply footer / logo / social settings from site_settings (storefront + track).
 */
(function () {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeFooterLink(link) {
    if (!link) return link;
    const label = String(link.label || '').trim();
    if (label === 'FAQ' && (!link.href || link.href === '#')) {
      return { label: 'FAQ', href: '/faq' };
    }
    if (
      (label === 'Contact Us' || label === 'Contact / Appointment') &&
      (link.page === 'appointment' || !link.href || link.href === '#')
    ) {
      return { label: 'Contact Us', href: '/contact' };
    }
    if (link.page === 'faq') return { label: label || 'FAQ', href: '/faq' };
    if (link.page === 'contact') return { label: label || 'Contact Us', href: '/contact' };
    if (link.page === 'privacy') return { label: label || 'Privacy Policy', href: '/privacy-policy' };
    if (link.page === 'terms') return { label: label || 'Terms & Conditions', href: '/terms-and-conditions' };
    if (link.page === 'return') return { label: label || 'Return Policy', href: '/return-policy' };
    if (link.page === 'points') return { label: label || 'Reward Point Policy', href: '/reward-point-policy' };
    return link;
  }

  function parseFooterLinks(raw) {
    if (!raw) return null;
    const text = String(raw).trim();
    if (!text) return null;
    let links = null;
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) links = parsed;
    } catch (_) {
      /* line format fallback */
    }
    if (!links) {
      links = text
        .split('\n')
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return null;
          const pipe = trimmed.indexOf('|');
          const label = pipe >= 0 ? trimmed.slice(0, pipe).trim() : trimmed;
          const target = pipe >= 0 ? trimmed.slice(pipe + 1).trim() : '#';
          if (!label) return null;
          if (target.startsWith('page:')) return { label, page: target.slice(5) };
          return { label, href: target || '#' };
        })
        .filter(Boolean);
    }
    return links.map(normalizeFooterLink);
  }

  const PAGE_HREFS = {
    home: '/',
    cart: '/cart',
    account: '/account',
    appointment: '/appointment',
    track: '/track',
    faq: '/faq',
    contact: '/contact',
    privacy: '/privacy-policy',
    terms: '/terms-and-conditions',
    return: '/return-policy',
    preorder: '/pre-order-policy',
    points: '/reward-point-policy',
  };

  const LEGAL_HREFS = new Set([
    '/privacy-policy',
    '/terms-and-conditions',
    '/return-policy',
    '/pre-order-policy',
    '/reward-point-policy',
  ]);

  function footerLinkDest(link) {
    const normalized = normalizeFooterLink(link);
    if (!normalized) return '';
    if (normalized.page) {
      const href = PAGE_HREFS[normalized.page] || '';
      if (href) return href;
      return `page:${normalized.page}`;
    }
    const href = String(normalized.href || '#').trim();
    if (href && href !== '#') return href;
    return '';
  }

  function footerLinkKey(link) {
    const normalized = normalizeFooterLink(link);
    if (!normalized) return '';
    const label = String(normalized.label || '').trim().toLowerCase();
    const dest = footerLinkDest(link);
    if (label && dest) return `${label}::${dest}`;
    if (dest) return dest;
    return label ? `label:${label}` : '';
  }

  function footerLinkDestKey(link) {
    const dest = footerLinkDest(link);
    return dest ? `dest:${dest}` : footerLinkKey(link);
  }

  function dedupeFooterLinks(links) {
    const seen = new Set();
    const out = [];
    (links || []).forEach((link) => {
      const key = footerLinkKey(link);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(normalizeFooterLink(link));
    });
    return out;
  }

  function isLegalFooterLink(link) {
    const normalized = normalizeFooterLink(link);
    if (!normalized) return false;
    const label = String(normalized.label || '').trim().toLowerCase();
    if (
      label === 'privacy policy' ||
      label === 'terms & conditions' ||
      label === 'terms' ||
      label === 'return policy' ||
      label === 'pre-order policy' ||
      label === 'reward point policy'
    ) {
      return true;
    }
    if (
      normalized.page === 'privacy' ||
      normalized.page === 'terms' ||
      normalized.page === 'return' ||
      normalized.page === 'preorder' ||
      normalized.page === 'points'
    ) {
      return true;
    }
    return LEGAL_HREFS.has(String(normalized.href || '').trim());
  }

  function prepareFooterColumnLinks(links, excludeDestKeys) {
    return dedupeFooterLinks(links).filter((link) => {
      if (isLegalFooterLink(link)) return false;
      const key = footerLinkKey(link);
      return key && !excludeDestKeys.has(footerLinkDestKey(link));
    });
  }

  function linkHtml(link, usePageRoutes) {
    const label = escapeHtml(link.label || 'Link');
    if (link.page) {
      if (usePageRoutes) {
        const href = escapeHtml(PAGE_HREFS[link.page] || '/');
        return `<li><a href="${href}"><i class="ti ti-chevron-right"></i>${label}</a></li>`;
      }
      return `<li><a href="#" data-footer-page="${escapeHtml(link.page)}"><i class="ti ti-chevron-right"></i>${label}</a></li>`;
    }
    const href = escapeHtml(link.href || '#');
    return `<li><a href="${href}"><i class="ti ti-chevron-right"></i>${label}</a></li>`;
  }

  const DEFAULT_LOGO_URL = '/images/rakushopbd-logo.png?v=9';

  function normalizeLogoUrl(url) {
    const u = String(url || '').trim();
    if (!u) return DEFAULT_LOGO_URL;
    if (u === '/images/rakushopbd-logo.png' || /^\/images\/rakushopbd-logo\.png\?v=\d+$/.test(u)) {
      return DEFAULT_LOGO_URL;
    }
    return u;
  }

  function applyFooterSettings(settings) {
    if (!settings) return;
    const name = settings.site_name || 'RakuShopBD';

    const logoUrl = normalizeLogoUrl(settings.site_logo_url);
    document.querySelectorAll('.site-logo-img').forEach((img) => {
      if (img.getAttribute('src') !== logoUrl) img.setAttribute('src', logoUrl);
    });

    const fd = document.querySelector('.footer-desc');
    if (fd) {
      fd.textContent =
        settings.footer_desc ||
        settings.site_tagline ||
        "Bangladesh's trusted online shopping platform. Huge selection, great prices, and fast delivery.";
    }

    const phone = document.getElementById('footer-phone');
    if (phone && settings.contact_phone) {
      phone.href = `tel:${String(settings.contact_phone).replace(/\s/g, '')}`;
      phone.innerHTML = `<i class="ti ti-phone"></i>${escapeHtml(settings.contact_phone)}`;
    }
    const email = document.getElementById('footer-email');
    if (email && settings.contact_email) {
      email.href = `mailto:${settings.contact_email}`;
      email.innerHTML = `<i class="ti ti-mail"></i>${escapeHtml(settings.contact_email)}`;
    }
    const addr = document.getElementById('footer-address');
    if (addr && settings.contact_address) {
      addr.innerHTML = `<i class="ti ti-map-pin"></i>${escapeHtml(settings.contact_address)}`;
    }
    const hours = document.getElementById('footer-hours');
    if (hours) {
      const h = settings.store_hours || '9 AM — 10 PM';
      hours.innerHTML = `<i class="ti ti-clock"></i>${escapeHtml(h)}`;
    }
    const copy = document.getElementById('footer-copyright');
    if (copy) copy.textContent = `© ${new Date().getFullYear()} ${name} — All rights reserved`;

    const socialWrap = document.getElementById('footer-social');
    if (socialWrap) {
      const items = [
        { key: 'social_facebook', icon: 'ti-brand-facebook' },
        { key: 'social_instagram', icon: 'ti-brand-instagram' },
        { key: 'social_youtube', icon: 'ti-brand-youtube' },
        { key: 'social_whatsapp', icon: 'ti-brand-whatsapp' },
      ];
      socialWrap.innerHTML = items
        .map(({ key, icon }) => {
          const url = (settings[key] || '').trim() || '#';
          const external = url !== '#';
          return `<a href="${escapeHtml(url)}" class="social-btn"${
            external ? ' target="_blank" rel="noopener noreferrer"' : ''
          } aria-label="${key.replace('social_', '')}"><i class="ti ${icon}"></i></a>`;
        })
        .join('');
    }

    const standalone = !!window.RAKU_FOOTER_AUTOLOAD;
    const helpRaw = parseFooterLinks(settings.footer_help_links);
    const help = prepareFooterColumnLinks(helpRaw, new Set());
    const helpKeys = new Set(help.map((link) => footerLinkDestKey(link)).filter(Boolean));

    const quickRaw = parseFooterLinks(settings.footer_quick_links);
    const quick = prepareFooterColumnLinks(quickRaw, helpKeys);

    const quickUl = document.getElementById('footer-quick-links');
    if (quickUl && quick?.length) {
      quickUl.innerHTML = quick.map((link) => linkHtml(link, standalone)).join('');
    }

    const helpUl = document.getElementById('footer-help-links');
    if (helpUl && help?.length) {
      helpUl.innerHTML = help.map((link) => linkHtml(link, standalone)).join('');
    }

    const legalHeading = document.getElementById('footer-legal-heading');
    if (legalHeading) {
      legalHeading.textContent = (settings.footer_legal_heading || '').trim() || 'Legal';
    }
    const mobileLegalLabel = document.getElementById('mobile-legal-menu-label');
    if (mobileLegalLabel) {
      mobileLegalLabel.textContent = (settings.footer_legal_heading || '').trim() || 'Legal';
    }

    const legalLinks = [
      {
        label: (settings.legal_privacy_title || '').trim() || 'Privacy Policy',
        href: '/privacy-policy',
      },
      {
        label: (settings.legal_terms_title || '').trim() || 'Terms & Conditions',
        href: '/terms-and-conditions',
      },
      {
        label: (settings.legal_return_title || '').trim() || 'Return Policy',
        href: '/return-policy',
      },
      {
        label: (settings.legal_preorder_title || '').trim() || 'Pre-Order Policy',
        href: '/pre-order-policy',
      },
      {
        label: 'Reward Point Policy',
        href: '/reward-point-policy',
      },
    ];
    const legalUl = document.getElementById('footer-legal-links');
    if (legalUl) {
      legalUl.innerHTML = legalLinks
        .map((link) => linkHtml(link, standalone))
        .join('');
    }

    if (window._rakuBindFooterLinks) window._rakuBindFooterLinks();
  }

  window._rakuApplyFooterSettings = applyFooterSettings;

  document.addEventListener('raku:settings-loaded', (e) => {
    applyFooterSettings(e.detail || window._rakuStoreSettings);
  });

  if (window._rakuStoreSettings) applyFooterSettings(window._rakuStoreSettings);

  if (window.RAKU_FOOTER_AUTOLOAD) {
    document.addEventListener('DOMContentLoaded', async () => {
      if (window._rakuStoreSettings) {
        applyFooterSettings(window._rakuStoreSettings);
        return;
      }
      try {
        const res = await fetch(`${window.RAKU_API_BASE || ''}/api/settings`);
        const data = await res.json();
        if (data.ok && data.settings) {
          window._rakuStoreSettings = data.settings;
          applyFooterSettings(data.settings);
        }
      } catch (_) {
        /* keep static footer defaults */
      }
    });
  }
})();
