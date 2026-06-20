const { formatPrice, starsFromRating, toBnNumber } = require('./format');
const { buildImgAttributes, preferWebpUrl } = require('./imageDelivery');
const { categoryHref } = require('./normalizeStoreUrl');

const CAT_PALETTE = [
  { bg: '#E8F3EA', color: '#2D6B32' },
  { bg: '#FDE8EF', color: '#E91E8C' },
  { bg: '#faf3e0', color: '#8a6914' },
  { bg: '#FDE8EF', color: '#C21872' },
  { bg: '#E8F3EA', color: '#1E4620' },
  { bg: '#FDE8EF', color: '#F062A8' },
];

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function palette(i) {
  return CAT_PALETTE[i % CAT_PALETTE.length];
}

function partitionCategories(categories) {
  const all = categories || [];
  const catParentId = (c) => {
    const p = c?.parent_id;
    return p == null || p === '' ? null : Number(p);
  };
  const topLevel = all.filter((c) => catParentId(c) == null);
  const childrenOf = (parentId) => all.filter((c) => catParentId(c) === Number(parentId));
  const withTotals = topLevel.map((c) => {
    const subs = childrenOf(c.id);
    const direct = Number(c.product_count) || 0;
    const subTotal = subs.reduce((sum, ch) => sum + (Number(ch.product_count) || 0), 0);
    return { ...c, product_count: direct + subTotal };
  });
  return { topLevel: withTotals };
}

function formatStatNum(n) {
  const x = Number(n) || 0;
  if (x >= 10000) return `${Math.floor(x / 1000)}k+`;
  if (x >= 1000) return `${(x / 1000).toFixed(1).replace('.0', '')}k+`;
  return `${x}+`;
}

function discountPercent(p) {
  const pct = Number(p.discount_percent ?? p.discountPercent);
  if (Number.isFinite(pct) && pct > 0 && pct < 100) return Math.round(pct);
  return null;
}

function tagHtml(p) {
  const pct = discountPercent(p);
  if (pct) return `<span class="prod-discount">-${toBnNumber(pct)}%</span>`;
  if (p.tag_type === 'bestseller' && p.tag_text) {
    return `<span class="prod-tag" style="background:#EAF3DE;color:#3B6D11;">${escapeHtml(p.tag_text)}</span>`;
  }
  if (p.tag_type === 'hot' && p.tag_text) {
    return `<span class="prod-tag" style="background:#FAEEDA;color:#854F0B;">${escapeHtml(p.tag_text)}</span>`;
  }
  if (p.tag_type === 'new' && p.tag_text) {
    return `<span class="prod-tag" style="background:#E8F3EA;color:#2D6B32;">${escapeHtml(p.tag_text)}</span>`;
  }
  return '';
}

function normalizeIconClass(icon) {
  const raw = String(icon || '').trim();
  if (!raw) return 'ti ti-package';
  if (raw.startsWith('ti ')) return raw;
  if (raw.startsWith('ti-')) return `ti ${raw}`;
  return raw;
}

function productMediaHtml(p) {
  const url = String(p.image_url || p.imageUrl || '').trim();
  if (!url) {
    return `<i class="${normalizeIconClass(p.icon)}" style="color:${escapeHtml(p.icon_color || p.iconColor || '#2D6B32')};"></i>`;
  }
  const alt = escapeHtml((p.image_alt || p.name_bn || p.nameBn || 'Product').trim() || 'Product');
  const srcUrl = preferWebpUrl(url.startsWith('/') || /^https?:\/\//i.test(url) ? url : `/${url}`);
  const attrs = buildImgAttributes(srcUrl, {
    widths: [320, 480, 640],
    sizes: '(max-width: 480px) 46vw, 240px',
    srcWidth: 480,
    width: 240,
    height: 240,
  });
  const icon = normalizeIconClass(p.icon);
  const color = escapeHtml(p.icon_color || p.iconColor || '#2D6B32');
  const srcset = attrs.srcset ? ` srcset="${escapeHtml(attrs.srcset)}" sizes="${escapeHtml(attrs.sizes)}"` : '';
  return `<img src="${escapeHtml(attrs.src || srcUrl)}"${srcset} alt="${alt}" width="240" height="240" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:contain;padding:8px;border-radius:inherit;"><i class="${icon}" style="color:${color};" hidden></i>`;
}

function productCardActionBtn(p) {
  const stock = Number(p.stock);
  const out = Number.isFinite(stock) && stock <= 0;
  if (!out) {
    return `<button class="add-cart-btn" type="button" data-id="${p.id}"><i class="ti ti-shopping-cart-plus"></i> Add to Cart</button>`;
  }
  return `<button class="preorder-btn" type="button" data-id="${p.id}"><i class="ti ti-clock-hour-4"></i> Pre-order</button>`;
}

function buildProductCardHtml(p) {
  const pct = discountPercent(p);
  const price = Number(p.price) || 0;
  const oldVal = pct && price > 0 ? p.old_price || Math.round(price / (1 - pct / 100)) : null;
  const oldPrice = oldVal ? `<span class="prod-old">${formatPrice(oldVal)}</span>` : '';
  const reviewCount = Number(p.review_count ?? p.reviewCount) || 0;
  return `<div class="product-card" data-cat="${escapeHtml(p.category_slug || p.categorySlug || '')}" data-id="${p.id}" data-price="${price}">
    <div class="prod-img" style="background:${escapeHtml(p.bg_color || p.bgColor || '#E8F3EA')};">
      ${tagHtml(p)}
      <button class="prod-wish" type="button" data-id="${p.id}" aria-label="Add to wishlist"><i class="ti ti-heart"></i></button>
      ${productMediaHtml(p)}
    </div>
    <div class="prod-info">
      <div class="prod-category">${escapeHtml(p.category_name || p.categoryName || '')}</div>
      <div class="prod-name">${escapeHtml(p.name_bn || p.nameBn || '')}</div>
      <div class="prod-rating"><span class="stars">${starsFromRating(p.rating)}</span><span class="rating-count">(${toBnNumber(reviewCount)})</span></div>
      <div class="prod-foot">
        <div><span class="prod-price">${formatPrice(price)}</span>${oldPrice}</div>
        ${productCardActionBtn(p)}
      </div>
    </div>
  </div>`;
}

function buildStatsGridHtml(stats) {
  if (!stats) return '';
  const items = [
    { icon: 'ti-box', bg: '#E8F3EA', color: '#2D6B32', num: `${formatStatNum(stats.productCount)}`, label: 'Total Products' },
    { icon: 'ti-users', bg: '#FDE8EF', color: '#E91E8C', num: '500+', label: 'Happy Customers' },
    { icon: 'ti-truck', bg: '#FDE8EF', color: '#E91E8C', num: `${stats.districts || 64} Districts`, label: 'Delivery Coverage' },
    { icon: 'ti-star', bg: '#E8F3EA', color: '#1E4620', num: `${Number(stats.avgRating || 4.8).toFixed(1)} ⭐`, label: 'Average Rating' },
  ];
  return items
    .map(
      (s) => `<div class="stat-card stat-card--colored" style="background:${s.bg};border-color:${s.bg};">
      <div class="stat-icon" style="background:rgba(255,255,255,0.82);"><i class="ti ${s.icon}" style="color:${s.color};"></i></div>
      <div><div class="stat-num">${escapeHtml(s.num)}</div><div class="stat-label">${escapeHtml(s.label)}</div></div>
    </div>`
    )
    .join('');
}

function categoryIconHtml(c, pal) {
  const paletteItem = pal || palette(0);
  const url = c?.icon_url || c?.iconUrl;
  if (url) {
    const src = preferWebpUrl(String(url).trim().startsWith('/') ? url : `/${url}`);
    const attrs = buildImgAttributes(src, { widths: [128], srcWidth: 128, width: 64, height: 64 });
    return `<div class="cat-icon cat-icon--img" style="background:${paletteItem.bg};"><img src="${escapeHtml(attrs.src || src)}" alt="" width="64" height="64" loading="lazy" decoding="async"><i class="ti ${escapeHtml(c.icon || 'ti-category')}" style="color:${paletteItem.color};" hidden></i></div>`;
  }
  return `<div class="cat-icon" style="background:${paletteItem.bg};"><i class="ti ${escapeHtml(c.icon || 'ti-category')}" style="color:${paletteItem.color};"></i></div>`;
}

function buildCategoryTrackHtml(categories) {
  const { topLevel } = partitionCategories(categories);
  if (!topLevel.length) return '';
  return topLevel
    .map((c, i) => {
      const pal = palette(i);
      const count = Number(c.product_count) || 0;
      const slug = escapeHtml(c.slug || '');
      const href = escapeHtml(categoryHref(c.slug || ''));
      return `<a href="${href}" class="cat-card" data-cat-slug="${slug}">
        ${categoryIconHtml(c, pal)}
        <div class="cat-card-label">
          <div class="cat-name">${escapeHtml(c.name_bn || c.nameBn || '')}</div>
          <div class="cat-count">${count} product${count !== 1 ? 's' : ''}</div>
        </div>
      </a>`;
    })
    .join('');
}

function buildProductTrackHtml(products) {
  if (!Array.isArray(products) || !products.length) return '';
  return products.map(buildProductCardHtml).join('');
}

function buildTrustBarHtml(settings = {}) {
  const freeMin = settings.free_delivery_min || '500';
  const trust = [
    { icon: 'ti-truck-delivery', color: '#2D6B32', bg: '#E8F3EA', title: settings.trust_1_title || 'Free & fast delivery', sub: settings.trust_1_sub || `Nationwide on orders over ৳${freeMin}` },
    { icon: 'ti-shield-check', color: '#E91E8C', bg: '#FDE8EF', title: settings.trust_2_title || '100% authentic products', sub: settings.trust_2_sub || 'Full refund on counterfeit items' },
    { icon: 'ti-refresh', color: '#B45309', bg: '#FEF3C7', title: settings.trust_3_title || 'Easy returns policy', sub: settings.trust_3_sub || 'No-questions return within 7 days' },
    { icon: 'ti-headset', color: '#2563EB', bg: '#DBEAFE', title: settings.trust_4_title || '24/7 customer support', sub: settings.trust_4_sub || 'Call or chat anytime' },
  ];
  return trust
    .map(
      (t) => `<div class="trust-item trust-item--colored" style="background:${t.bg};border-color:${t.bg};">
        <i class="ti ${t.icon} trust-icon" style="color:${t.color};"></i>
        <div><div class="trust-title">${escapeHtml(t.title)}</div><div class="trust-sub">${escapeHtml(t.sub)}</div></div>
      </div>`
    )
    .join('');
}

function buildHomePageSsr(bootstrap) {
  if (!bootstrap?.ok) return null;
  const settings = bootstrap.settings || {};
  const messengerChats = (bootstrap.messengerChats || []).filter(
    (c) => c?.image_url || c?.imageUrl
  );
  const statsHtml = buildStatsGridHtml(bootstrap.stats);
  const categoriesHtml = buildCategoryTrackHtml(bootstrap.categories);
  const bestSellingHtml = buildProductTrackHtml(bootstrap.bestSelling);
  const newArrivalsHtml = buildProductTrackHtml(bootstrap.newArrivals);
  const trustBarHtml = buildTrustBarHtml(bootstrap.settings);
  const messengerEnabled = settings.messenger_chats_enabled !== '0';
  return {
    statsHtml,
    categoriesHtml,
    bestSellingHtml,
    newArrivalsHtml,
    trustBarHtml,
    hasStats: Boolean(statsHtml),
    hasCategories: Boolean(categoriesHtml),
    hasBestSelling: Boolean(bestSellingHtml),
    hasNewArrivals: Boolean(newArrivalsHtml),
    hasTrustBar: Boolean(trustBarHtml),
    messengerEnabled,
    messengerHasChats: messengerChats.length > 0,
  };
}

module.exports = { buildHomePageSsr, buildProductCardHtml, buildStatsGridHtml };
