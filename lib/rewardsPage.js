/**
 * Raku Rewards page — structured content (admin-editable, design-safe JSON).
 */
function getDefaultRewardsContent() {
  return {
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
}

function normalizeTier(t, fallback) {
  const fb = fallback || {};
  return {
    key: t?.key || fb.key || 'silver',
    name: String(t?.name || fb.name || '').trim(),
    intro: String(t?.intro || fb.intro || '').trim(),
    pointsLine: String(t?.pointsLine || t?.points || fb.pointsLine || '').trim(),
    valueLine: String(t?.valueLine || t?.value || fb.valueLine || '').trim(),
    note: String(t?.note || fb.note || '').trim(),
  };
}

function parseRewardsContent(settings) {
  const defaults = getDefaultRewardsContent();
  let raw = settings?.rewards_page_content;
  let data = null;
  try {
    if (typeof raw === 'string' && raw.trim()) data = JSON.parse(raw);
    else if (raw && typeof raw === 'object') data = raw;
  } catch (_) {
    data = null;
  }
  if (!data) return defaults;

  const tiersIn = Array.isArray(data.tiers) ? data.tiers : [];
  const tiers = defaults.tiers.map((def, i) => normalizeTier(tiersIn[i] || {}, def));

  const extraItems = Array.isArray(data.extra?.items) ? data.extra.items : [];
  const extra = {
    title: String(data.extra?.title || defaults.extra.title).trim() || defaults.extra.title,
    subtitle: String(data.extra?.subtitle || defaults.extra.subtitle).trim() || defaults.extra.subtitle,
    items: defaults.extra.items.map((def, i) => ({
      icon: String(extraItems[i]?.icon || def.icon).trim() || def.icon,
      text: String(extraItems[i]?.text || def.text).trim() || def.text,
    })),
  };

  const redeemItems = Array.isArray(data.redeem?.items) ? data.redeem.items : [];
  const redeem = {
    title: String(data.redeem?.title || defaults.redeem.title).trim() || defaults.redeem.title,
    items: defaults.redeem.items.map((def, i) => String(redeemItems[i] || def).trim() || def),
  };

  const cta = {
    title: String(data.cta?.title || defaults.cta.title).trim() || defaults.cta.title,
    text: String(data.cta?.text || defaults.cta.text).trim() || defaults.cta.text,
    shopLabel: String(data.cta?.shopLabel || defaults.cta.shopLabel).trim() || defaults.cta.shopLabel,
    accountLabel: String(data.cta?.accountLabel || defaults.cta.accountLabel).trim() || defaults.cta.accountLabel,
  };

  return {
    eyebrow: String(data.eyebrow || defaults.eyebrow).trim() || defaults.eyebrow,
    title: String(data.title || defaults.title).trim() || defaults.title,
    intro: String(data.intro || defaults.intro).trim() || defaults.intro,
    tiers,
    extra,
    redeem,
    cta,
  };
}

function getRewardsSeoDescription(content) {
  const c = content || getDefaultRewardsContent();
  return String(c.intro || '').slice(0, 160);
}

/** True when stored JSON is missing key rewards fields (needs DB backfill). */
function needsRewardsContentBackfill(raw) {
  if (!String(raw || '').trim() || String(raw).trim() === '{}' || String(raw).trim() === 'null') {
    return true;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (_) {
    return true;
  }
  if (!data || typeof data !== 'object') return true;
  if (!String(data.intro || '').trim()) return true;
  const tiers = Array.isArray(data.tiers) ? data.tiers : [];
  if (tiers.length < 3) return true;
  if (tiers.some((t) => !String(t?.name || '').trim() || !String(t?.intro || '').trim())) return true;
  const extraItems = Array.isArray(data.extra?.items) ? data.extra.items : [];
  if (extraItems.length < 3 || extraItems.some((it) => !String(it?.text || it || '').trim())) return true;
  const redeemItems = Array.isArray(data.redeem?.items) ? data.redeem.items : [];
  if (redeemItems.length < 4 || redeemItems.some((it) => !String(it || '').trim())) return true;
  if (!String(data.cta?.text || '').trim()) return true;
  return false;
}

module.exports = {
  getDefaultRewardsContent,
  parseRewardsContent,
  getRewardsSeoDescription,
  needsRewardsContentBackfill,
};
