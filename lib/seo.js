const { query } = require('../config/db');
const { productPublicPath } = require('./productUrl');
const { parseRewardsContent, getRewardsSeoDescription } = require('./rewardsPage');

const NOINDEX_PAGES = new Set(['cart', 'checkout', 'account', 'wishlist', 'success']);

const VIRTUAL_COLLECTION_SLUGS = new Set(['best-selling', 'new-arrivals', 'today-deals', 'all']);

function resolveVirtualCollection(slug, settings = {}) {
  const key = String(slug || '').trim();
  if (!VIRTUAL_COLLECTION_SLUGS.has(key)) return null;
  const titles = {
    all: 'All Products',
    'best-selling': 'Best Selling Products',
    'new-arrivals': 'New Arrivals',
    'today-deals': String(settings.today_deals_title || 'Today Deals').trim() || 'Today Deals',
  };
  return { slug: key, name_bn: titles[key], icon: 'ti-tag' };
}

function normalizeSiteBaseUrl(raw, fallback = 'https://rakushopbd.com') {
  let s = String(raw || '').trim();
  if (!s) return fallback.replace(/\/$/, '');

  if (s.includes(',')) {
    const parts = s
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    s = parts.find((part) => /^https?:\/\//i.test(part)) || parts[parts.length - 1];
  }

  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s.replace(/^\/+/, '')}`;
  }

  try {
    const url = new URL(s);
    return `${url.protocol}//${url.host}`;
  } catch {
    return fallback.replace(/\/$/, '');
  }
}

function getSiteBaseUrl(req, settings) {
  const fromEnv = (process.env.SITE_URL || process.env.PUBLIC_SITE_URL || '').trim();
  if (fromEnv) return normalizeSiteBaseUrl(fromEnv);
  const configured = (settings?.site_url || '').trim();
  if (configured) return normalizeSiteBaseUrl(configured);
  if (req) {
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const host = req.get('x-forwarded-host') || req.get('host');
    if (host) return normalizeSiteBaseUrl(`${proto}://${host}`);
  }
  return normalizeSiteBaseUrl('');
}

function truncate(text, max = 160) {
  const s = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trim()}…`;
}

function absoluteUrl(base, path) {
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function productName(p) {
  return p?.name_bn || p?.name_en || p?.name || 'Product';
}

function buildOrganizationJsonLd(base, settings) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: settings.site_name || 'RakuShopBD',
    url: base,
    logo: absoluteUrl(base, '/images/rakushopbd-logo.png'),
    contactPoint: settings.contact_phone
      ? {
          '@type': 'ContactPoint',
          telephone: settings.contact_phone,
          contactType: 'customer service',
          areaServed: 'BD',
          availableLanguage: ['en', 'bn'],
        }
      : undefined,
  };
}

function buildWebSiteJsonLd(base, settings) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: settings.site_name || 'RakuShopBD',
    url: base,
    description: truncate(settings.seo_meta_description || settings.site_tagline, 200),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${base}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

function productSeoDescription(product, settings) {
  const custom = String(product.seo_description || '').trim();
  if (custom) return custom;
  const longDesc = String(product.description_bn || '').trim();
  if (longDesc) return longDesc;
  const shortDesc = String(product.short_description || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (shortDesc) return shortDesc;
  return settings.seo_meta_description || '';
}

function productOgImage(base, product, fallback) {
  if (product.og_image) return absoluteUrl(base, product.og_image);
  if (product.image_url) return absoluteUrl(base, product.image_url);
  return fallback;
}

function productOgImageAlt(product) {
  const alt = String(product?.image_alt || '').trim();
  if (alt) return truncate(alt, 200);
  return truncate(productName(product), 200);
}

/** Full Open Graph + Twitter + product tags for crawlers and social shares. */
function buildOgMetaList({
  ogType = 'website',
  ogSiteName,
  ogTitle,
  ogDescription,
  ogUrl,
  ogImage,
  ogImageAlt = '',
  ogLocale = 'en_BD',
  twitterSite = '',
  product = null,
  includeImageDimensions = true,
}) {
  const meta = [];
  const pushProp = (key, content) => {
    if (content == null || content === '') return;
    meta.push({ attr: 'property', key, content: String(content) });
  };
  const pushName = (key, content) => {
    if (content == null || content === '') return;
    meta.push({ attr: 'name', key, content: String(content) });
  };

  pushProp('og:type', ogType);
  pushProp('og:site_name', ogSiteName);
  pushProp('og:title', ogTitle);
  pushProp('og:description', ogDescription);
  pushProp('og:url', ogUrl);
  pushProp('og:image', ogImage);
  pushProp('og:locale', ogLocale);
  if (ogImage) {
    pushProp('og:image:secure_url', ogImage);
    if (includeImageDimensions) {
      pushProp('og:image:width', '1200');
      pushProp('og:image:height', '630');
    }
  }
  if (ogImageAlt) pushProp('og:image:alt', ogImageAlt);

  pushName('twitter:card', 'summary_large_image');
  pushName('twitter:title', ogTitle);
  pushName('twitter:description', ogDescription);
  pushName('twitter:image', ogImage);
  if (twitterSite) {
    const handle = twitterSite.startsWith('@') ? twitterSite : `@${twitterSite}`;
    pushName('twitter:site', handle);
  }

  if (ogType === 'product' && product) {
    const price = Number(product.price) || 0;
    const inStock = Number(product.stock) > 0;
    pushProp('product:price:amount', price.toFixed(2));
    pushProp('product:price:currency', 'BDT');
    pushProp('product:availability', inStock ? 'in stock' : 'out of stock');
    pushProp('product:condition', 'new');
    pushProp('product:retailer_item_id', String(product.id || ''));
    if (product.slug) pushProp('product:custom_label_0', product.slug);
  }

  return meta;
}

function buildProductJsonLd(base, product, settings) {
  const name = productName(product);
  const url = `${base}${productPublicPath(product)}`;
  const img = productOgImage(base, product, absoluteUrl(base, '/images/rakushopbd-logo.png'));
  const price = Number(product.price) || 0;
  const offer = {
    '@type': 'Offer',
    price: price.toFixed(2),
    priceCurrency: 'BDT',
    availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    url,
  };
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: truncate(productSeoDescription(product, settings), 300),
    image: [img],
    sku: String(product.id),
    brand: { '@type': 'Brand', name: settings.site_name || 'RakuShopBD' },
    offers: offer,
  };
}

function buildBreadcrumbJsonLd(base, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url ? absoluteUrl(base, item.url) : undefined,
    })),
  };
}

async function getCategoryBySlug(slug, settings = {}) {
  if (!slug) return null;
  const virtual = resolveVirtualCollection(slug, settings);
  if (virtual) return virtual;
  const rows = await query(
    `SELECT id, slug, name_bn, icon FROM categories WHERE slug = ? LIMIT 1`,
    [slug]
  );
  return rows[0] || null;
}

function resolvePageType(req) {
  const path = req.path || '/';
  if (path === '/' || path === '') return 'home';
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'product' && parts[1]) return 'product';
  if (parts[0] === 'category' && parts[1]) return 'category';
  if (NOINDEX_PAGES.has(parts[0])) return parts[0];
  if (parts[0] === 'appointment') return 'appointment';
  if (parts[0] === 'track') return 'track';
  if (parts[0] === 'faq') return 'faq';
  if (parts[0] === 'rewards') return 'rewards';
  if (parts[0] === 'contact') return 'contact';
  if (parts[0] === 'privacy-policy') return 'privacy';
  if (parts[0] === 'terms-and-conditions') return 'terms';
  if (parts[0] === 'return-policy') return 'return';
  if (parts[0] === 'pre-order-policy') return 'preorder';
  return 'page';
}

async function buildPageSeo(req, { bootstrap, product, category } = {}) {
  const settings = bootstrap?.settings || {};
  const base = getSiteBaseUrl(req, settings);
  const siteName = settings.site_name || 'RakuShopBD';
  const defaultDesc =
    settings.seo_meta_description ||
    settings.site_tagline ||
    `${siteName} — shop quality products online in Bangladesh with fast delivery.`;
  const defaultKeywords = settings.seo_meta_keywords || 'online shopping, Bangladesh, RakuShopBD, ecommerce';
  const ogImageDefault =
    settings.seo_og_image || absoluteUrl(base, '/images/rakushopbd-logo.png');
  const pageType = resolvePageType(req);
  const path = req.path || '/';
  const canonical = absoluteUrl(base, path === '/' ? '/' : path);

  let title = `${siteName} — Best Online Shopping`;
  let description = truncate(defaultDesc);
  let keywords = defaultKeywords;
  let robots = 'index, follow';
  let ogType = 'website';
  let ogImage = ogImageDefault;
  const jsonLd = [buildOrganizationJsonLd(base, settings), buildWebSiteJsonLd(base, settings)];

  if (NOINDEX_PAGES.has(pageType)) {
    robots = 'noindex, nofollow';
    const labels = {
      cart: 'Shopping Cart',
      checkout: 'Checkout',
      account: 'My Account',
      wishlist: 'Wishlist',
      success: 'Order Confirmed',
    };
    title = `${labels[pageType] || pageType} • ${siteName}`;
    description = truncate(`${labels[pageType] || pageType} — ${siteName}`);
  } else if (pageType === 'product' && product) {
    const name = productName(product);
    const seoTitle = String(product.seo_title || '').trim();
    const seoDesc = String(product.seo_description || '').trim();
    const seoKw = String(product.seo_keywords || '').trim();
    title = seoTitle || `${name} — Buy Online | ${siteName}`;
    description = truncate(
      seoDesc ||
        product.description_bn ||
        String(product.short_description || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim() ||
        `${name}. Order from ${siteName} with fast delivery in Bangladesh.`
    );
    if (seoKw) keywords = seoKw;
    ogType = 'product';
    ogImage = productOgImage(base, product, ogImageDefault);
    jsonLd.push(buildProductJsonLd(base, product, settings));
    jsonLd.push(
      buildBreadcrumbJsonLd(base, [
        { name: 'Home', url: '/' },
        { name: product.category_name || 'Category', url: product.category_slug ? `/category/${product.category_slug}` : undefined },
        { name, url: productPublicPath(product) },
      ])
    );
  } else if (pageType === 'category') {
    const slugFromPath = decodeURIComponent((path.match(/^\/category\/([^/]+)/) || [])[1] || '');
    const cat = category || (slugFromPath ? resolveVirtualCollection(slugFromPath, settings) : null);
    if (cat) {
      const name = cat.name_bn || cat.slug;
      title = `${name} — Shop Online | ${siteName}`;
      description = truncate(`Browse ${name} products at ${siteName}. Best prices and delivery across Bangladesh.`);
      jsonLd.push(
        buildBreadcrumbJsonLd(base, [
          { name: 'Home', url: '/' },
          { name, url: `/category/${cat.slug}` },
        ])
      );
    }
  } else if (pageType === 'appointment') {
    title = `Book Appointment • ${siteName}`;
    description = truncate(`Book a consultation or service appointment with ${siteName}.`);
    robots = 'index, follow';
  } else if (pageType === 'track') {
    title = `Track Order • ${siteName}`;
    description = truncate(`Track your ${siteName} order status online.`);
  } else if (pageType === 'faq') {
    title = `FAQ • ${siteName}`;
    description = truncate(`Frequently asked questions about shopping, delivery and returns at ${siteName}.`);
  } else if (pageType === 'rewards') {
    const rewardsContent = parseRewardsContent(settings);
    title = `${rewardsContent.title || 'Raku Rewards'} • ${siteName}`;
    description = truncate(getRewardsSeoDescription(rewardsContent));
  } else if (pageType === 'contact') {
    title = `Contact Us • ${siteName}`;
    description = truncate(`Contact ${siteName} for order support, product questions and delivery help.`);
  } else if (pageType === 'privacy') {
    title = `${settings.legal_privacy_title || 'Privacy Policy'} • ${siteName}`;
    description = truncate(
      settings.legal_privacy_content
        ? String(settings.legal_privacy_content).replace(/<[^>]+>/g, ' ').slice(0, 160)
        : `Privacy Policy — how ${siteName} handles your personal data.`
    );
  } else if (pageType === 'terms') {
    title = `${settings.legal_terms_title || 'Terms & Conditions'} • ${siteName}`;
    description = truncate(
      settings.legal_terms_content
        ? String(settings.legal_terms_content).replace(/<[^>]+>/g, ' ').slice(0, 160)
        : `Terms and Conditions for shopping at ${siteName}.`
    );
  } else if (pageType === 'return') {
    title = `${settings.legal_return_title || 'Return Policy'} • ${siteName}`;
    description = truncate(
      settings.legal_return_content
        ? String(settings.legal_return_content).replace(/<[^>]+>/g, ' ').slice(0, 160)
        : `Return and refund policy for ${siteName} orders.`
    );
  } else if (pageType === 'preorder') {
    title = `${settings.legal_preorder_title || 'Pre-Order Policy'} • ${siteName}`;
    description = truncate(
      settings.legal_preorder_content
        ? String(settings.legal_preorder_content).replace(/<[^>]+>/g, ' ').slice(0, 160)
        : `Pre-order policy for Japanese skincare and beauty products at ${siteName}.`
    );
  } else if (pageType === 'home') {
    title = settings.seo_home_title || `${siteName} — Best Online Shopping in Bangladesh`;
    description = truncate(defaultDesc);
  } else if (pageType === 'page') {
    const segment = (path.split('/').filter(Boolean)[0] || 'page').replace(/-/g, ' ');
    const label = segment.charAt(0).toUpperCase() + segment.slice(1);
    title = `${label} • ${siteName}`;
    description = truncate(`${label} — ${siteName}`);
  }

  let ogTitle = title;
  let ogImageAlt = '';
  if (pageType === 'product' && product) {
    const name = productName(product);
    const seoTitle = String(product.seo_title || '').trim();
    ogTitle = seoTitle || `${name} | ${siteName}`;
    ogImageAlt = productOgImageAlt(product);
  } else if (pageType === 'category') {
    const slugFromPath = decodeURIComponent((path.match(/^\/category\/([^/]+)/) || [])[1] || '');
    const cat = category || (slugFromPath ? resolveVirtualCollection(slugFromPath, settings) : null);
    if (cat) {
      const name = cat.name_bn || cat.slug;
      ogTitle = `${name} | ${siteName}`;
      ogImageAlt = truncate(name, 200);
    }
  } else if (pageType === 'home') {
    ogTitle = settings.seo_home_title || `${siteName} — Best Online Shopping`;
    ogImageAlt = siteName;
  } else {
    ogImageAlt = truncate(ogTitle, 200);
  }

  const ogMeta = buildOgMetaList({
    ogType,
    ogSiteName: siteName,
    ogTitle,
    ogDescription: description,
    ogUrl: canonical,
    ogImage,
    ogImageAlt,
    twitterSite: settings.seo_twitter_handle || '',
    product: pageType === 'product' ? product : null,
    includeImageDimensions: Boolean(ogImage && ogImage !== ogImageDefault),
  });

  return {
    title,
    description,
    keywords,
    canonical,
    robots,
    ogTitle,
    ogDescription: description,
    ogImage,
    ogUrl: canonical,
    ogType,
    ogSiteName: siteName,
    ogImageAlt,
    ogMeta,
    twitterCard: 'summary_large_image',
    twitterSite: settings.seo_twitter_handle || '',
    googleVerification: settings.seo_google_verification || '',
    jsonLd: JSON.stringify(jsonLd.filter(Boolean)),
    siteUrl: base,
    pageType,
  };
}

async function buildSitemapXml(req) {
  const settings = {};
  try {
    const { getSiteSettings } = require('./siteSettings');
    Object.assign(settings, await getSiteSettings(query));
  } catch (_) {}
  const base = getSiteBaseUrl(req, settings);
  const urls = [];
  const add = (loc, changefreq = 'weekly', priority = '0.8') => {
    urls.push({ loc: absoluteUrl(base, loc), changefreq, priority });
  };

  add('/', 'daily', '1.0');
  add('/appointment', 'monthly', '0.6');
  add('/track', 'monthly', '0.5');
  add('/faq', 'monthly', '0.5');
  add('/rewards', 'monthly', '0.6');
  add('/contact', 'monthly', '0.6');
  add('/privacy-policy', 'monthly', '0.4');
  add('/terms-and-conditions', 'monthly', '0.4');
  add('/return-policy', 'monthly', '0.5');
  add('/pre-order-policy', 'monthly', '0.5');

  try {
    const categories = await query(
      'SELECT slug, updated_at FROM categories ORDER BY sort_order ASC, id ASC'
    );
    categories.forEach((c) => {
      if (c.slug) add(`/category/${encodeURIComponent(c.slug)}`, 'weekly', '0.85');
    });
  } catch (_) {}

  try {
    const products = await query(
      'SELECT id, slug, updated_at FROM products ORDER BY id DESC LIMIT 5000'
    );
    products.forEach((p) => {
      add(productPublicPath(p), 'weekly', '0.9');
    });
  } catch (_) {
    try {
      const products = await query('SELECT id, slug FROM products ORDER BY id DESC LIMIT 5000');
      products.forEach((p) => add(productPublicPath(p), 'weekly', '0.9'));
    } catch (__) {}
  }

  const lastmod = new Date().toISOString().slice(0, 10);
  const body = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function robotsTxt(base) {
  const siteBase = normalizeSiteBaseUrl(base);
  const sitemapUrl = `${siteBase}/sitemap.xml`;
  return `User-agent: *
Allow: /

Disallow: /admin
Disallow: /api/
Disallow: /cart
Disallow: /checkout
Disallow: /account
Disallow: /wishlist
Disallow: /success

Sitemap: ${sitemapUrl}
`;
}

module.exports = {
  buildPageSeo,
  buildOgMetaList,
  buildSitemapXml,
  robotsTxt,
  getSiteBaseUrl,
  normalizeSiteBaseUrl,
  getCategoryBySlug,
  NOINDEX_PAGES,
  truncate,
  productName,
  productOgImage,
  productOgImageAlt,
};
