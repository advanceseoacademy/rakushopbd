/**
 * Homepage blog row — latest published posts, horizontal scroll (4 desktop / 2 mobile).
 */
(function () {
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
        month: 'short',
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
    return Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 200));
  }

  function imageSrc(url) {
    const u = String(url || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return window.rakuShopUrl ? window.rakuShopUrl(u) : u;
  }

  function excerptText(post) {
    if (post.excerpt) return String(post.excerpt).trim();
    const plain = String(post.content || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return plain.length > 120 ? `${plain.slice(0, 117)}…` : plain;
  }

  function homeBlogCardHtml(post) {
    const href = post.url || `/blog/${encodeURIComponent(post.slug)}`;
    const imgUrl = post.featuredImageUrl || post.featured_image_url || '';
    const imgBlock = imgUrl
      ? `<a href="${escapeHtml(href)}" class="home-blog-card-image-link"><img src="${escapeHtml(imageSrc(imgUrl))}" alt="${escapeHtml(post.imageAlt || post.image_alt || post.title || '')}" class="home-blog-card-image" loading="lazy" decoding="async"></a>`
      : `<a href="${escapeHtml(href)}" class="home-blog-card-image-link"><div class="home-blog-card-image--placeholder" aria-hidden="true"><i class="ti ti-article"></i></div></a>`;
    const mins = estimateReadMinutes(post.content || post.excerpt);
    const date = formatDate(post.publishedAt || post.published_at || post.createdAt || post.created_at);

    return `<article class="home-blog-card" data-blog-slug="${escapeHtml(post.slug || '')}">
      ${imgBlock}
      <div class="home-blog-card-body">
        <div class="home-blog-card-meta">${escapeHtml(date)} · ${mins} min read</div>
        <h3 class="home-blog-card-title"><a href="${escapeHtml(href)}">${escapeHtml(post.title || 'Untitled')}</a></h3>
        <p class="home-blog-card-excerpt">${escapeHtml(excerptText(post))}</p>
        <a class="home-blog-card-more" href="${escapeHtml(href)}">Read more <i class="ti ti-arrow-right"></i></a>
      </div>
    </article>`;
  }

  function bindHomeBlogLinks() {
    const track = document.getElementById('track-home-blog');
    if (!track || track._rakuBlogLinksBound) return;
    track._rakuBlogLinksBound = true;
    track.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="/blog"]');
      if (!link || !window.showPage || window.RAKU_STANDALONE) return;
      const href = link.getAttribute('href') || '';
      if (href === '/blog') {
        e.preventDefault();
        window.showPage('blog');
        return;
      }
      if (href.startsWith('/blog/')) {
        e.preventDefault();
        window.showPage('blog', { blogSlug: decodeURIComponent(href.slice('/blog/'.length)) });
      }
    });
  }

  function bindSeeAllBlog() {
    const seeAll = document.getElementById('see-all-home-blog');
    if (!seeAll || seeAll._rakuBound) return;
    seeAll._rakuBound = true;
    seeAll.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.showPage) window.showPage('blog');
      else window.location.href = '/blog';
    });
  }

  async function fetchHomeBlogPosts() {
    const base = window.RAKU_API_BASE || '';
    try {
      const res = await fetch(`${base}/api/blog/posts?limit=12&page=1`, { credentials: 'same-origin' });
      const data = await res.json();
      if (data?.ok && Array.isArray(data.posts)) return data.posts;
    } catch (_) {}
    return [];
  }

  let lastBlogKey = '';

  async function paintHomeBlogSection() {
    const section = document.getElementById('section-home-blog');
    const track = document.getElementById('track-home-blog');
    if (!track) return;

    const posts = await fetchHomeBlogPosts();
    if (!posts.length) {
      if (section) section.hidden = true;
      return;
    }

    const key = posts.map((p) => p.id || p.slug).join(',');
    if (key === lastBlogKey && track._rakuBlogPainted) return;
    lastBlogKey = key;

    if (section) section.hidden = false;
    track.innerHTML = posts.map(homeBlogCardHtml).join('');
    track._rakuBlogPainted = true;
    bindHomeBlogLinks();
    bindSeeAllBlog();

    requestAnimationFrame(() => {
      if (window._rakuSyncHomeCarouselCardWidths) {
        window._rakuSyncHomeCarouselCardWidths('track-home-blog', '.home-blog-card', 140);
      } else if (window._rakuSyncHomeScrollCardWidths) {
        window._rakuSyncHomeScrollCardWidths();
      }
      if (window._rakuInitHomeScrollAuto) {
        window._rakuInitHomeScrollAuto('track-home-blog', 4200);
      }
    });
  }

  function scheduleHomeBlogPaint() {
    bindSeeAllBlog();
    void paintHomeBlogSection();
    setTimeout(() => {
      const track = document.getElementById('track-home-blog');
      if (track?.querySelector('.home-blog-card--skeleton')) void paintHomeBlogSection();
    }, 3000);
  }

  document.addEventListener('raku:ready', scheduleHomeBlogPaint);
  document.addEventListener('raku:bootstrap', scheduleHomeBlogPaint);

  if (window.__RAKU_READY__) scheduleHomeBlogPaint();
})();
