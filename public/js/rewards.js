/**
 * Raku Rewards page — render admin-managed content (design preserved).
 */
(function () {
  const API = (window.RAKU_API_BASE || '') + '/api';

  const TIER_ICONS = { silver: 'silver', gold: 'gold', platinum: 'platinum' };

  const DEFAULTS = {
    eyebrow: 'Earn More as You Shop!',
    title: 'Raku Rewards Program',
    intro:
      'We reward loyal customers for shopping and engaging with RakuShopBD. The more you shop, the more benefits you unlock — earn points on every order and redeem them on future purchases.',
    tiers: [
      {
        key: 'silver',
        name: 'Raku Silver',
        intro: 'Become a Raku Silver member with just one successful order!',
        pointsLine: 'Earn 1 point for every ৳100 spent',
        valueLine: '1 point = ৳1',
        note: 'Start earning points right away and redeem them on your next purchase.',
      },
      {
        key: 'gold',
        name: 'Raku Gold',
        intro: 'Earn 100 points within the last 6 months to reach Gold status.',
        pointsLine: 'Earn 1.5 points for every ৳100 spent',
        valueLine: '1 point = ৳1',
        note: 'Exclusive benefits: special discounts on selected products and early access to offers.',
      },
      {
        key: 'platinum',
        name: 'Raku Platinum',
        intro: 'Achieve Platinum by earning 300 points in the last 6 months.',
        pointsLine: 'Earn 2 points for every ৳100 spent',
        valueLine: '1 point = ৳1',
        note: 'Platinum perks: exclusive discounts, special gifts, and first access to promotions.',
      },
    ],
    extra: {
      title: 'Extra Ways to Earn Points',
      subtitle: 'Not only shopping — we also reward your activity on our site.',
      items: [
        { icon: 'ti-message-circle', text: 'Product reviews: Earn 5 points per approved review' },
        { icon: 'ti-users', text: 'Community engagement: Earn bonus points on selected campaigns' },
        { icon: 'ti-shopping-bag', text: 'Every purchase: Keep earning points on all eligible orders' },
      ],
    },
    redeem: {
      title: 'How to Redeem Points',
      items: [
        'Minimum 100 points required to redeem',
        'After 100 points, redeem in multiples of 50',
        'Apply points at checkout on your RakuShopBD account',
        'Points cannot be exchanged for cash',
      ],
    },
    cta: {
      title: 'Unlock Rewards with Ease',
      text: 'Whether you are buying skincare favourites or leaving a helpful review, points add up quickly. Join today and start collecting rewards!',
      shopLabel: 'Start Shopping',
      accountLabel: 'My Account',
    },
  };

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function parseContent(settings) {
    let raw = settings?.rewards_page_content;
    let data = null;
    try {
      if (typeof raw === 'string' && raw.trim()) data = JSON.parse(raw);
      else if (raw && typeof raw === 'object') data = raw;
    } catch (_) {}
    if (!data) return DEFAULTS;

    const tiers = DEFAULTS.tiers.map((def, i) => {
      const t = data.tiers?.[i] || {};
      return {
        key: def.key,
        name: String(t.name || def.name).trim() || def.name,
        intro: String(t.intro || def.intro).trim() || def.intro,
        pointsLine: String(t.pointsLine || t.points || def.pointsLine).trim() || def.pointsLine,
        valueLine: String(t.valueLine || t.value || def.valueLine).trim() || def.valueLine,
        note: String(t.note || def.note).trim() || def.note,
      };
    });

    return {
      eyebrow: String(data.eyebrow || DEFAULTS.eyebrow).trim() || DEFAULTS.eyebrow,
      title: String(data.title || DEFAULTS.title).trim() || DEFAULTS.title,
      intro: String(data.intro || DEFAULTS.intro).trim() || DEFAULTS.intro,
      tiers,
      extra: {
        title: String(data.extra?.title || DEFAULTS.extra.title).trim() || DEFAULTS.extra.title,
        subtitle: String(data.extra?.subtitle || DEFAULTS.extra.subtitle).trim() || DEFAULTS.extra.subtitle,
        items: DEFAULTS.extra.items.map((def, i) => ({
          icon: String(data.extra?.items?.[i]?.icon || def.icon).trim() || def.icon,
          text: String(data.extra?.items?.[i]?.text || def.text).trim() || def.text,
        })),
      },
      redeem: {
        title: String(data.redeem?.title || DEFAULTS.redeem.title).trim() || DEFAULTS.redeem.title,
        items: DEFAULTS.redeem.items.map((def, i) => String(data.redeem?.items?.[i] || def).trim() || def),
      },
      cta: {
        title: String(data.cta?.title || DEFAULTS.cta.title).trim() || DEFAULTS.cta.title,
        text: String(data.cta?.text || DEFAULTS.cta.text).trim() || DEFAULTS.cta.text,
        shopLabel: String(data.cta?.shopLabel || DEFAULTS.cta.shopLabel).trim() || DEFAULTS.cta.shopLabel,
        accountLabel: String(data.cta?.accountLabel || DEFAULTS.cta.accountLabel).trim() || DEFAULTS.cta.accountLabel,
      },
    };
  }

  function formatBulletText(text) {
    const parts = String(text || '').split(':');
    if (parts.length < 2) return esc(text);
    return `<strong>${esc(parts[0].trim())}:</strong> ${esc(parts.slice(1).join(':').trim())}`;
  }

  function tierHtml(tier) {
    const key = TIER_ICONS[tier.key] || tier.key || 'silver';
    return `<article class="rewards-tier rewards-tier--${esc(key)}">
      <div class="rewards-tier-badge"><i class="ti ti-award"></i></div>
      <h2 class="rewards-tier-name">${esc(tier.name)}</h2>
      <p class="rewards-tier-intro">${esc(tier.intro)}</p>
      <ul class="rewards-tier-list">
        <li><strong>Points:</strong> ${esc(tier.pointsLine)}</li>
        <li><strong>Value:</strong> ${esc(tier.valueLine)}</li>
      </ul>
      <p class="rewards-tier-note">${esc(tier.note)}</p>
    </article>`;
  }

  function renderRewardsPage(content) {
    const c = content || DEFAULTS;

    const eyebrow = document.getElementById('rewards-eyebrow');
    const titleText = document.getElementById('rewards-title-text');
    const intro = document.getElementById('rewards-hero-intro');
    if (eyebrow) eyebrow.textContent = c.eyebrow;
    if (titleText) titleText.textContent = c.title;
    if (intro) intro.textContent = c.intro;

    const tiersEl = document.getElementById('rewards-tiers');
    if (tiersEl) tiersEl.innerHTML = c.tiers.map(tierHtml).join('');

    const extraTitle = document.querySelector('#rewards-extra-title span');
    const extraSub = document.getElementById('rewards-extra-sub');
    const extraList = document.getElementById('rewards-extra-list');
    if (extraTitle) extraTitle.textContent = c.extra.title;
    if (extraSub) extraSub.textContent = c.extra.subtitle;
    if (extraList) {
      extraList.innerHTML = c.extra.items
        .map(
          (item) =>
            `<li><i class="ti ${esc(item.icon || 'ti-star')}"></i> <span>${formatBulletText(item.text)}</span></li>`
        )
        .join('');
    }

    const redeemTitle = document.querySelector('#rewards-redeem-title span');
    const redeemList = document.getElementById('rewards-redeem-list');
    if (redeemTitle) redeemTitle.textContent = c.redeem.title;
    if (redeemList) {
      redeemList.innerHTML = c.redeem.items.map((item) => `<li>${esc(item)}</li>`).join('');
    }

    const ctaTitle = document.getElementById('rewards-cta-title');
    const ctaText = document.getElementById('rewards-cta-text');
    const shopSpan = document.querySelector('#rewards-cta-shop span');
    const accountSpan = document.querySelector('#rewards-cta-account span');
    if (ctaTitle) ctaTitle.textContent = c.cta.title;
    if (ctaText) ctaText.textContent = c.cta.text;
    if (shopSpan) shopSpan.textContent = c.cta.shopLabel;
    if (accountSpan) accountSpan.textContent = c.cta.accountLabel;
  }

  function isRewardsPageVisible() {
    const page = document.getElementById('page-rewards');
    return Boolean(page && page.style.display !== 'none');
  }

  function bindRewardsLinks() {
    const page = document.getElementById('page-rewards');
    if (!page || page._rakuLinksBound) return;
    page._rakuLinksBound = true;

    page.querySelector('[data-rewards-shop]')?.addEventListener('click', (e) => {
      if (window.RAKU_STANDALONE || !window.showPage) return;
      e.preventDefault();
      window.showPage('home');
      requestAnimationFrame(() => {
        document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
      });
    });

    page.querySelector('[data-rewards-account]')?.addEventListener('click', (e) => {
      if (window.RAKU_STANDALONE || !window.showPage) return;
      e.preventDefault();
      window.showPage('account');
    });
  }

  async function loadAndRender() {
    renderRewardsPage(parseContent(window._rakuStoreSettings));

    if (window._rakuStoreSettings?.rewards_page_content) return;

    try {
      const res = await fetch(`${API}/settings`, { credentials: 'same-origin' });
      const data = await res.json();
      if (data.ok && data.settings) {
        renderRewardsPage(parseContent(data.settings));
      }
    } catch (_) {}
  }

  function initRewardsPageIfVisible() {
    if (!isRewardsPageVisible()) return;
    bindRewardsLinks();
    void loadAndRender();
  }

  window._rakuInitRewardsPage = initRewardsPageIfVisible;

  document.addEventListener('raku:settings-loaded', (e) => {
    if (!isRewardsPageVisible()) return;
    renderRewardsPage(parseContent(e.detail || window._rakuStoreSettings));
  });

  document.addEventListener('raku:navigate', (e) => {
    if (e.detail?.page === 'rewards') initRewardsPageIfVisible();
  });

  document.addEventListener('raku:ready', () => {
    setTimeout(initRewardsPageIfVisible, 0);
  });

  function bootRewards() {
    bindRewardsLinks();
    setTimeout(initRewardsPageIfVisible, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootRewards);
  } else {
    bootRewards();
  }
})();
