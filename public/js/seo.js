/**
 * Client-side SEO — dynamic title, meta, canonical, Open Graph on SPA navigation.
 */
(function () {
  const NOINDEX = new Set(['cart', 'checkout', 'account', 'wishlist', 'success']);

  function settings() {
    return window.__RAKU_BOOTSTRAP?.settings || {};
  }

  function normalizeSiteUrl(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    const m = s.match(/https?:\/\/[^\s,<>"']+/i);
    if (m) {
      try {
        const u = new URL(m[0]);
        return `${u.protocol}//${u.host}`;
      } catch (_) {
        return m[0].replace(/\/+$/, '');
      }
    }
    const host = s.split(/[\s,]/)[0].replace(/^\/+|\/+$/g, '');
    if (!host) return '';
    try {
      const u = new URL(host.includes('://') ? host : `https://${host}`);
      return `${u.protocol}//${u.host}`;
    } catch (_) {
      return s.replace(/\/+$/, '');
    }
  }

  function baseUrl() {
    const s = settings();
    if (s.site_url) return normalizeSiteUrl(s.site_url);
    return `${location.origin}`;
  }

  function upsertMetaByName(name, content) {
    if (content == null || content === '') return;
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function upsertMetaByProperty(prop, content) {
    if (content == null || content === '') return;
    let el = document.querySelector(`meta[property="${prop}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', prop);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function applyOgMetaList(list) {
    if (!list?.length) return;
    list.forEach((m) => {
      if (!m?.content) return;
      if (m.attr === 'property') upsertMetaByProperty(m.key, m.content);
      else upsertMetaByName(m.key, m.content);
    });
  }

  function upsertCanonical(href) {
    if (!href) return;
    let el = document.querySelector('link[rel="canonical"]');
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', 'canonical');
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }

  function upsertJsonLd(graph) {
    let el = document.getElementById('raku-jsonld-dynamic');
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = 'raku-jsonld-dynamic';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(graph);
  }

  function abs(pathOrUrl) {
    if (!pathOrUrl) return baseUrl();
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    return `${baseUrl()}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
  }

  function truncate(text, max) {
    const s = String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (s.length <= max) return s;
    return `${s.slice(0, max - 1).trim()}…`;
  }

  function siteName() {
    return settings().site_name || 'RakuShopBD';
  }

  function defaultDesc() {
    const s = settings();
    return truncate(
      s.seo_meta_description || s.site_tagline || `${siteName()} — online shopping in Bangladesh`,
      160
    );
  }

  function defaultOgImage() {
    const s = settings();
    return s.seo_og_image ? abs(s.seo_og_image) : abs('/images/rakushopbd-logo.png');
  }

  function productDisplayName(p) {
    return p?.name_bn || p?.name_en || p?.name || 'Product';
  }

  function productOgImage(p) {
    if (p?.og_image) return abs(p.og_image);
    if (p?.image_url) return abs(p.image_url);
    return defaultOgImage();
  }

  function productOgImageAlt(p) {
    const alt = String(p?.image_alt || '').trim();
    return truncate(alt || productDisplayName(p), 200);
  }

  function buildOgMetaList({
    ogType = 'website',
    ogSiteName,
    ogTitle,
    ogDescription,
    ogUrl,
    ogImage,
    ogImageAlt = '',
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
    pushProp('og:locale', 'en_BD');
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

  function apply(cfg, opts) {
    if (!cfg) return;
    const o = opts || {};
    if (cfg.title) document.title = cfg.title;
    upsertMetaByName('description', cfg.description);
    upsertMetaByName('robots', cfg.robots);
    if (cfg.keywords) upsertMetaByName('keywords', cfg.keywords);
    upsertCanonical(cfg.canonical);

    if (cfg.ogMeta?.length) {
      applyOgMetaList(cfg.ogMeta);
    } else {
      upsertMetaByProperty('og:title', cfg.ogTitle || cfg.title);
      upsertMetaByProperty('og:description', cfg.ogDescription || cfg.description);
      upsertMetaByProperty('og:url', cfg.ogUrl || cfg.canonical);
      upsertMetaByProperty('og:image', cfg.ogImage);
      upsertMetaByProperty('og:type', cfg.ogType || 'website');
      upsertMetaByProperty('og:site_name', cfg.ogSiteName || siteName());
      upsertMetaByProperty('og:locale', 'en_BD');
      if (cfg.ogImageAlt) upsertMetaByProperty('og:image:alt', cfg.ogImageAlt);
      upsertMetaByName('twitter:title', cfg.ogTitle || cfg.title);
      upsertMetaByName('twitter:description', cfg.ogDescription || cfg.description);
      upsertMetaByName('twitter:image', cfg.ogImage);
      upsertMetaByName('twitter:card', 'summary_large_image');
    }

    if (o.updateJsonLd !== false && cfg.jsonLd) {
      try {
        const graph = typeof cfg.jsonLd === 'string' ? JSON.parse(cfg.jsonLd) : cfg.jsonLd;
        upsertJsonLd(graph);
      } catch (_) {}
    }

    document.dispatchEvent(
      new CustomEvent('raku:seo-applied', {
        detail: { title: cfg.title || document.title, canonical: cfg.canonical || '' },
      })
    );
  }

  function twitterHandle() {
    return settings().seo_twitter_handle || '';
  }

  function forHome() {
    const name = siteName();
    const s = settings();
    const title = s.seo_home_title || `${name} — Best Online Shopping in Bangladesh`;
    const description = defaultDesc();
    const ogTitle = s.seo_home_title || `${name} — Best Online Shopping`;
    const ogImage = defaultOgImage();
    const canonical = abs('/');
    return {
      title,
      description,
      keywords: s.seo_meta_keywords || '',
      canonical,
      robots: 'index, follow',
      ogTitle,
      ogDescription: description,
      ogUrl: canonical,
      ogImage,
      ogType: 'website',
      ogSiteName: name,
      ogImageAlt: name,
      ogMeta: buildOgMetaList({
        ogType: 'website',
        ogSiteName: name,
        ogTitle,
        ogDescription: description,
        ogUrl: canonical,
        ogImage,
        ogImageAlt: name,
        twitterSite: twitterHandle(),
        includeImageDimensions: false,
      }),
    };
  }

  function productPath(p) {
    if (p?.slug) return `/product/${encodeURIComponent(p.slug)}`;
    if (p?.id) return `/product/${p.id}`;
    return '/';
  }

  function forProduct(p) {
    const name = productDisplayName(p);
    const sn = siteName();
    const path = productPath(p);
    const seoTitle = String(p.seo_title || '').trim();
    const seoDesc = String(p.seo_description || '').trim();
    const seoKw = String(p.seo_keywords || '').trim();
    const title = seoTitle || `${name} — Buy Online | ${sn}`;
    const description = truncate(
      seoDesc ||
        p.description_bn ||
        String(p.short_description || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim() ||
        `${name}. Order from ${sn} with fast delivery.`
    );
    const ogTitle = seoTitle || `${name} | ${sn}`;
    const ogImage = productOgImage(p);
    const canonical = abs(path);
    const ogImageAlt = productOgImageAlt(p);
    return {
      title,
      description,
      keywords: seoKw || settings().seo_meta_keywords || '',
      canonical,
      robots: 'index, follow',
      ogTitle,
      ogDescription: description,
      ogUrl: canonical,
      ogImage,
      ogType: 'product',
      ogSiteName: sn,
      ogImageAlt,
      ogMeta: buildOgMetaList({
        ogType: 'product',
        ogSiteName: sn,
        ogTitle,
        ogDescription: description,
        ogUrl: canonical,
        ogImage,
        ogImageAlt,
        twitterSite: twitterHandle(),
        product: p,
        includeImageDimensions: ogImage !== defaultOgImage(),
      }),
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name,
          description,
          image: [ogImage],
          sku: String(p.sku || p.id || ''),
          url: canonical,
          brand: { '@type': 'Brand', name: sn },
          offers: {
            '@type': 'Offer',
            price: String(Number(p.price) || 0),
            priceCurrency: 'BDT',
            availability:
              p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url: canonical,
            itemCondition: 'https://schema.org/NewCondition',
            seller: { '@type': 'Organization', name: sn, url: abs('/') },
          },
          ...(Number(p.review_count) > 0 && Number(p.rating) > 0
            ? {
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: Number(p.rating).toFixed(1),
                  reviewCount: Number(p.review_count),
                  bestRating: '5',
                  worstRating: '1',
                },
              }
            : {}),
        },
      ],
    };
  }

  function forCategory(cat) {
    const name = cat.name_bn || cat.name_en || cat.slug;
    const sn = siteName();
    const path = `/category/${encodeURIComponent(cat.slug)}`;
    const description = truncate(`Browse ${name} at ${sn}. Best prices and delivery in Bangladesh.`);
    const title = `${name} — Shop Online | ${sn}`;
    const ogTitle = `${name} | ${sn}`;
    const canonical = abs(path);
    const ogImage = defaultOgImage();
    return {
      title,
      description,
      keywords: settings().seo_meta_keywords || '',
      canonical,
      robots: 'index, follow',
      ogTitle,
      ogDescription: truncate(`Shop ${name} at ${sn}`),
      ogUrl: canonical,
      ogImage,
      ogType: 'website',
      ogSiteName: sn,
      ogImageAlt: truncate(name, 200),
      ogMeta: buildOgMetaList({
        ogType: 'website',
        ogSiteName: sn,
        ogTitle,
        ogDescription: description,
        ogUrl: canonical,
        ogImage,
        ogImageAlt: truncate(name, 200),
        twitterSite: twitterHandle(),
        includeImageDimensions: false,
      }),
    };
  }

  function forPrivatePage(page) {
    const labels = {
      cart: 'Shopping Cart',
      checkout: 'Checkout',
      account: 'My Account',
      wishlist: 'Wishlist',
      success: 'Order Confirmed',
      appointment: 'Book Appointment',
      track: 'Track Order',
      faq: 'FAQ',
      blog: 'Blog',
      about: 'About Us',
      contact: 'Contact Us',
    };
    const label = labels[page] || page;
    const sn = siteName();
    const path =
      page === 'home'
        ? '/'
        : page === 'privacy'
          ? '/privacy-policy'
          : page === 'terms'
            ? '/terms-and-conditions'
            : page === 'return'
              ? '/return-policy'
              : page === 'preorder'
                ? '/pre-order-policy'
                : page === 'points'
                  ? '/reward-point-policy'
                  : page === 'about'
                    ? '/about'
                    : `/${page}`;
    const title = `${label} • ${sn}`;
    const description = defaultDesc();
    const canonical = abs(path);
    const ogImage = defaultOgImage();
    const robots = NOINDEX.has(page) ? 'noindex, nofollow' : 'index, follow';
    return {
      title,
      description,
      canonical,
      robots,
      ogTitle: title,
      ogDescription: description,
      ogUrl: canonical,
      ogImage,
      ogType: 'website',
      ogSiteName: sn,
      ogImageAlt: label,
      ogMeta: buildOgMetaList({
        ogType: 'website',
        ogSiteName: sn,
        ogTitle: title,
        ogDescription: description,
        ogUrl: canonical,
        ogImage,
        ogImageAlt: label,
        twitterSite: twitterHandle(),
        includeImageDimensions: false,
      }),
    };
  }

  function forLegalPage(page) {
    const s = settings();
    const sn = siteName();
    const paths = {
      privacy: '/privacy-policy',
      terms: '/terms-and-conditions',
      return: '/return-policy',
      preorder: '/pre-order-policy',
      points: '/reward-point-policy',
    };
    const titles = {
      privacy: s.legal_privacy_title || 'Privacy Policy',
      terms: s.legal_terms_title || 'Terms & Conditions',
      return: s.legal_return_title || 'Return Policy',
      preorder: s.legal_preorder_title || 'Pre-Order Policy',
      points: s.legal_points_title || 'Reward Point Policy',
    };
    const path = paths[page] || '/';
    const label = titles[page] || page;
    const title = `${label} • ${sn}`;
    const raw =
      page === 'privacy'
        ? s.legal_privacy_content
        : page === 'terms'
          ? s.legal_terms_content
          : page === 'return'
            ? s.legal_return_content
            : page === 'preorder'
              ? s.legal_preorder_content
              : s.legal_points_content;
    const description = raw
      ? truncate(String(raw).replace(/<[^>]+>/g, ' '))
      : defaultDesc();
    const canonical = abs(path);
    const ogImage = defaultOgImage();
    return {
      title,
      description,
      canonical,
      robots: 'index, follow',
      ogTitle: title,
      ogDescription: description,
      ogUrl: canonical,
      ogImage,
      ogType: 'website',
      ogSiteName: sn,
      ogImageAlt: label,
      ogMeta: buildOgMetaList({
        ogType: 'website',
        ogSiteName: sn,
        ogTitle: title,
        ogDescription: description,
        ogUrl: canonical,
        ogImage,
        ogImageAlt: label,
        twitterSite: twitterHandle(),
        includeImageDimensions: false,
      }),
    };
  }

  function forBlogPost(post) {
    const sn = siteName();
    const path = post?.url || (post?.slug ? `/blog/${encodeURIComponent(post.slug)}` : '/blog');
    const seoTitle = String(post?.seoTitle || post?.seo_title || '').trim();
    const seoDesc = String(post?.seoDescription || post?.seo_description || '').trim();
    const seoKw = String(post?.seoKeywords || post?.seo_keywords || '').trim();
    const headline = String(post?.title || '').trim() || 'Blog';
    const title = seoTitle || `${headline} • ${sn}`;
    const description = truncate(
      seoDesc ||
        String(post?.excerpt || '').trim() ||
        String(post?.content || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim() ||
        `${headline} — ${sn} blog.`
    );
    const ogTitle = seoTitle || `${headline} | ${sn}`;
    const shareImage =
      String(post?.ogImage || post?.og_image || '').trim() ||
      String(post?.featuredImageUrl || post?.featured_image_url || '').trim();
    const ogImage = shareImage ? abs(shareImage) : defaultOgImage();
    const ogImageAlt = String(post?.imageAlt || post?.image_alt || '').trim() || headline;
    const canonical = abs(path);
    return {
      title,
      description,
      keywords: seoKw || settings().seo_meta_keywords || '',
      canonical,
      robots: 'index, follow',
      ogTitle,
      ogDescription: description,
      ogUrl: canonical,
      ogImage,
      ogType: 'article',
      ogSiteName: sn,
      ogImageAlt,
      ogMeta: buildOgMetaList({
        ogType: 'article',
        ogSiteName: sn,
        ogTitle,
        ogDescription: description,
        ogUrl: canonical,
        ogImage,
        ogImageAlt,
        twitterSite: twitterHandle(),
        includeImageDimensions: ogImage !== defaultOgImage(),
      }),
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline,
          description,
          datePublished: post?.publishedAt || post?.published_at || post?.createdAt,
          dateModified: post?.updatedAt || post?.updated_at || post?.publishedAt || post?.createdAt,
          author: { '@type': 'Organization', name: sn },
          publisher: {
            '@type': 'Organization',
            name: sn,
            logo: { '@type': 'ImageObject', url: abs('/images/rakushopbd-logo.png') },
          },
          mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
          url: canonical,
          ...(ogImage !== defaultOgImage() ? { image: [ogImage] } : {}),
        },
      ],
    };
  }

  function onNavigate(page, opts) {
    if (window.__RAKU_SEO && !window.__RAKU_SEO_CLIENT_READY) {
      return;
    }
    if (page === 'home') return apply(forHome());
    if (NOINDEX.has(page)) return apply(forPrivatePage(page));
    if (page === 'appointment' || page === 'track') return apply(forPrivatePage(page));
    if (page === 'faq' || page === 'contact' || page === 'about') return apply(forPrivatePage(page));
    if (page === 'blog' && opts?.blogSlug) return;
    if (page === 'blog') return apply(forPrivatePage(page));
    if (page === 'privacy' || page === 'terms' || page === 'return' || page === 'preorder' || page === 'points') return apply(forLegalPage(page));
    if (page === 'product' && opts?.product) return apply(forProduct(opts.product));
    if (page === 'category' && opts?.category) return apply(forCategory(opts.category));
    if (page === 'category' && opts?.categorySlug) {
      const slug = String(opts.categorySlug);
      const virtualTitles = {
        all: 'All Products',
        'best-selling': 'Best Selling Products',
        'new-arrivals': 'New Arrivals',
        'today-deals': 'Today Deals',
      };
      const cats = window._rakuCategories || [];
      const cat = cats.find((c) => c.slug === slug) || {
        slug,
        name_bn: virtualTitles[slug] || slug.replace(/-/g, ' '),
      };
      return apply(forCategory(cat));
    }
  }

  window.RakuSEO = {
    apply,
    applyOgMetaList,
    buildOgMetaList,
    forHome,
    forProduct,
    forCategory,
    forPrivatePage,
    forLegalPage,
    forBlogPost,
    onNavigate,
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.__RAKU_SEO_CLIENT_READY = true;
    if (window.__RAKU_SEO) {
      apply(window.__RAKU_SEO, { updateJsonLd: false });
      return;
    }
    const route = (location.pathname || '/').split('/').filter(Boolean);
    if (!route.length) apply(forHome());
  });
})();
