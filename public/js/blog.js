(function () {
  const API = (window.RAKU_API_BASE || '') + '/api';
  const LIST_CACHE_MS = 60 * 1000;
  const POST_CACHE_MS = 5 * 60 * 1000;
  let listPage = 1;
  let readProgressBound = false;
  let listCache = null;
  let listCacheAt = 0;
  let listInflight = null;
  const postCache = new Map();
  const postInflight = new Map();

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-BD', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (_) {
      return '';
    }
  }

  function estimateReadMinutes(html) {
    const text = String(html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return 1;
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  }

  function imageSrc(url) {
    const u = String(url || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return window.rakuShopUrl ? window.rakuShopUrl(u) : u;
  }

  function currentBlogSlug() {
    const parts = (location.pathname || '').split('/').filter(Boolean);
    if (parts[0] === 'blog' && parts[1]) return decodeURIComponent(parts[1]);
    // Only trust SSR slug when URL is still a single-post path.
    if (parts[0] === 'blog' && !parts[1] && window.__RAKU_BLOG_SLUG) {
      try {
        delete window.__RAKU_BLOG_SLUG;
      } catch (_) {
        window.__RAKU_BLOG_SLUG = '';
      }
    }
    return null;
  }

  function bindReadProgress() {
    if (readProgressBound) return;
    readProgressBound = true;
    const bar = document.getElementById('blog-read-progress-bar');
    if (!bar) return;

    const update = () => {
      const page = document.getElementById('page-blog');
      if (!page?.classList.contains('blog-mode-single')) {
        bar.style.width = '0';
        return;
      }
      const article = document.querySelector('.blog-article');
      if (!article) return;
      const rect = article.getBoundingClientRect();
      const total = article.offsetHeight - window.innerHeight;
      if (total <= 0) {
        bar.style.width = '100%';
        return;
      }
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      bar.style.width = `${Math.round((scrolled / total) * 100)}%`;
    };

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    document.addEventListener('raku:navigate', update);
    update();
  }

  function setBlogMode(mode) {
    const list = document.getElementById('blog-list-view');
    const single = document.getElementById('blog-single-view');
    const heroTitle = document.getElementById('blog-hero-title');
    const heroSub = document.getElementById('blog-hero-sub');
    const page = document.getElementById('page-blog');
    if (!list || !single) return;

    page?.classList.toggle('blog-mode-single', mode === 'single');

    if (mode === 'single') {
      list.hidden = true;
      single.hidden = false;
      if (heroTitle) heroTitle.textContent = 'Article';
      if (heroSub) heroSub.textContent = 'RakuShopBD blog';
      bindReadProgress();
    } else {
      list.hidden = false;
      single.hidden = true;
      if (heroTitle) heroTitle.textContent = 'Blog';
      if (heroSub) heroSub.textContent = 'Tips, guides and updates from RakuShopBD.';
      const bar = document.getElementById('blog-read-progress-bar');
      if (bar) bar.style.width = '0';
    }
  }

  function renderList(posts, pagination) {
    const grid = document.getElementById('blog-grid');
    const pagEl = document.getElementById('blog-pagination');
    if (!grid) return;

    if (!posts.length) {
      grid.innerHTML =
        '<p class="blog-empty">No articles published yet. Check back soon.</p>';
      if (pagEl) pagEl.hidden = true;
      return;
    }

    grid.innerHTML = posts
      .map((p) => {
        const href = p.url || `/blog/${encodeURIComponent(p.slug)}`;
        const img = p.featuredImageUrl
          ? `<a href="${escapeHtml(href)}" class="blog-card-image-link"><img src="${escapeHtml(imageSrc(p.featuredImageUrl))}" alt="${escapeHtml(p.imageAlt || p.title || '')}" class="blog-card-image" loading="lazy" decoding="async"></a>`
          : '';
        const excerpt = p.excerpt
          ? escapeHtml(p.excerpt)
          : escapeHtml(String(p.content || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 160)) +
            (String(p.content || '').length > 160 ? '…' : '');
        const mins = estimateReadMinutes(p.content || p.excerpt);
        return `<article class="blog-card">
          ${img}
          <div class="blog-card-body">
            <div class="blog-card-meta">${escapeHtml(formatDate(p.publishedAt || p.createdAt))} · ${mins} min read</div>
            <h2 class="blog-card-title"><a href="${escapeHtml(href)}">${escapeHtml(p.title)}</a></h2>
            <p class="blog-card-excerpt">${excerpt}</p>
            <a class="blog-card-more" href="${escapeHtml(href)}">Read more <i class="ti ti-arrow-right"></i></a>
          </div>
        </article>`;
      })
      .join('');

    if (pagEl && pagination && pagination.pages > 1) {
      pagEl.hidden = false;
      pagEl.innerHTML = `<span>Page ${pagination.page} of ${pagination.pages}</span>
        <div class="blog-pagination-actions">
          <button type="button" class="btn btn-outline btn-sm" id="blog-prev" ${pagination.page <= 1 ? 'disabled' : ''}>← Prev</button>
          <button type="button" class="btn btn-outline btn-sm" id="blog-next" ${pagination.page >= pagination.pages ? 'disabled' : ''}>Next →</button>
        </div>`;
      document.getElementById('blog-prev')?.addEventListener('click', () => loadBlogList(pagination.page - 1));
      document.getElementById('blog-next')?.addEventListener('click', () => loadBlogList(pagination.page + 1));
    } else if (pagEl) {
      pagEl.hidden = true;
    }
  }

  function adoptWarmList(data) {
    if (data?.ok) {
      listCache = data;
      listCacheAt = Date.now();
    }
    return data;
  }

  async function fetchBlogList(page) {
    const p = Math.max(1, Number(page) || 1);
    if (p === 1 && listCache && Date.now() - listCacheAt < LIST_CACHE_MS) {
      return listCache;
    }
    if (p === 1 && listInflight) return listInflight;

    // Early fetch started from app.js before blog.js finished loading.
    if (p === 1 && window.__RAKU_BLOG_LIST_WARM) {
      const warm = window.__RAKU_BLOG_LIST_WARM;
      window.__RAKU_BLOG_LIST_WARM = null;
      listInflight = Promise.resolve(warm)
        .then(adoptWarmList)
        .finally(() => {
          listInflight = null;
        });
      return listInflight;
    }

    const job = (async () => {
      const res = await fetch(`${API}/blog/posts?limit=12&page=${p}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (p === 1) return adoptWarmList(data);
      return data;
    })();

    if (p === 1) {
      listInflight = job.finally(() => {
        listInflight = null;
      });
      return listInflight;
    }
    return job;
  }

  async function fetchBlogPost(slug) {
    const key = String(slug || '');
    const hit = postCache.get(key);
    if (hit && Date.now() - hit.at < POST_CACHE_MS) return hit.data;
    if (postInflight.has(key)) return postInflight.get(key);

    const job = (async () => {
      const res = await fetch(`${API}/blog/posts/${encodeURIComponent(key)}`, {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (data?.ok && data.post) postCache.set(key, { at: Date.now(), data });
      return data;
    })().finally(() => postInflight.delete(key));

    postInflight.set(key, job);
    return job;
  }

  async function loadBlogList(page) {
    if (page) listPage = page;
    setBlogMode('list');
    const grid = document.getElementById('blog-grid');

    const cached =
      listPage === 1 && listCache && Date.now() - listCacheAt < LIST_CACHE_MS ? listCache : null;
    if (cached?.ok) {
      renderList(cached.posts || [], cached.pagination);
    } else if (grid && !grid.querySelector('.blog-card')) {
      grid.innerHTML = '<p class="blog-loading">Loading articles…</p>';
    }

    try {
      const data = await fetchBlogList(listPage);
      if (data?.ok) {
        renderList(data.posts || [], data.pagination);
        return;
      }
    } catch (_) {}
    if (grid && !grid.querySelector('.blog-card')) {
      grid.innerHTML = '<p class="blog-empty">Could not load articles. Please try again later.</p>';
    }
  }

  async function loadBlogSingle(slug) {
    setBlogMode('single');
    const titleEl = document.getElementById('blog-single-title');
    const metaEl = document.getElementById('blog-single-meta');
    const readEl = document.getElementById('blog-single-read-time');
    const excerptEl = document.getElementById('blog-single-excerpt');
    const breadcrumbEl = document.getElementById('blog-breadcrumb-current');
    const contentEl = document.getElementById('blog-single-content');
    const imgEl = document.getElementById('blog-single-image');
    const heroWrap = document.getElementById('blog-single-hero');

    const cached = postCache.get(String(slug || ''));
    const hasFresh = cached && Date.now() - cached.at < POST_CACHE_MS && cached.data?.post;
    if (!hasFresh) {
      if (titleEl) titleEl.textContent = 'Loading…';
      if (contentEl) contentEl.innerHTML = '';
      if (excerptEl) excerptEl.hidden = true;
      if (heroWrap) heroWrap.hidden = true;
    }

    try {
      const data = await fetchBlogPost(slug);
      if (!data.ok || !data.post) {
        if (titleEl) titleEl.textContent = 'Article not found';
        if (contentEl) {
          contentEl.innerHTML =
            '<p>This article may have been removed or is not published yet. <a href="/blog">Back to blog</a>.</p>';
        }
        if (imgEl) imgEl.hidden = true;
        if (heroWrap) heroWrap.hidden = true;
        if (breadcrumbEl) breadcrumbEl.textContent = 'Not found';
        return;
      }

      const p = data.post;
      const published = p.publishedAt || p.createdAt;
      const mins = estimateReadMinutes(p.content);

      if (titleEl) titleEl.textContent = p.title || '';
      if (breadcrumbEl) breadcrumbEl.textContent = p.title || 'Article';
      if (metaEl) {
        metaEl.textContent = formatDate(published);
        if (published) metaEl.setAttribute('datetime', String(published));
      }
      if (readEl) readEl.textContent = `${mins} min read`;
      if (excerptEl) {
        const lead = String(p.excerpt || '').trim();
        if (lead) {
          excerptEl.textContent = lead;
          excerptEl.hidden = false;
        } else {
          excerptEl.hidden = true;
          excerptEl.textContent = '';
        }
      }
      if (contentEl) contentEl.innerHTML = p.content || '';

      if (imgEl && heroWrap) {
        if (p.featuredImageUrl) {
          imgEl.src = imageSrc(p.featuredImageUrl);
          imgEl.alt = p.imageAlt || p.title || '';
          heroWrap.hidden = false;
        } else {
          heroWrap.hidden = true;
          imgEl.removeAttribute('src');
          imgEl.removeAttribute('alt');
        }
      }

      if (window.RakuSEO?.forBlogPost) {
        window.RakuSEO.apply(window.RakuSEO.forBlogPost(p));
      } else if (window.RakuSEO?.apply) {
        window.RakuSEO.apply({
          title: `${p.title} — RakuShopBD`,
          description: String(p.seoDescription || p.excerpt || p.content || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 160),
        });
      }

      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('scroll'));
      });
    } catch (_) {
      if (titleEl) titleEl.textContent = 'Could not load article';
    }
  }

  function initBlogPage(forcedSlug) {
    const slug =
      forcedSlug === undefined || forcedSlug === null || forcedSlug === ''
        ? currentBlogSlug()
        : String(forcedSlug);
    if (slug) loadBlogSingle(slug);
    else loadBlogList(listPage);
  }

  window._rakuInitBlogPage = initBlogPage;
  window._rakuPrefetchBlogList = function () {
    void fetchBlogList(1).catch(() => {});
  };

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.getElementById('page-blog');
    if (page && page.style.display !== 'none') initBlogPage();
  });

  document.getElementById('blog-back-link')?.addEventListener('click', (e) => {
    if (window.showPage) {
      e.preventDefault();
      window.showPage('blog');
    }
  });

  document.getElementById('blog-breadcrumb-list')?.addEventListener('click', (e) => {
    if (window.showPage) {
      e.preventDefault();
      window.showPage('blog');
    }
  });
})();
