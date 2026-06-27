const { slugify } = require('./slugify');

function getBlogPublicBaseUrl() {
  return '/blog';
}

function blogPostPublicUrl(slug) {
  const s = String(slug || '').trim();
  if (!s) return '/blog';
  return `/blog/${encodeURIComponent(s)}`;
}

function blogPostToPublic(row, opts = {}) {
  if (!row) return null;
  const includeContent = opts.includeContent !== false;
  const slug = row.slug;
  const out = {
    id: row.id,
    title: row.title,
    slug,
    excerpt: row.excerpt || '',
    featuredImageUrl: row.featured_image_url || row.featuredImageUrl || null,
    seoTitle: row.seo_title || row.seoTitle || '',
    seoDescription: row.seo_description || row.seoDescription || '',
    seoKeywords: row.seo_keywords || row.seoKeywords || '',
    imageAlt: row.image_alt || row.imageAlt || '',
    ogImage: row.og_image || row.ogImage || '',
    status: row.status || 'draft',
    publishedAt: row.published_at || row.publishedAt || null,
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    url: blogPostPublicUrl(slug),
  };
  if (includeContent) out.content = row.content || '';
  return out;
}

function blogPlainText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function blogPostShareImage(post) {
  return (
    String(post?.ogImage || post?.og_image || '').trim() ||
    String(post?.featuredImageUrl || post?.featured_image_url || '').trim() ||
    ''
  );
}

function resolveBlogPostSeo(post, siteName = 'RakuShopBD') {
  const title = String(post?.seoTitle || post?.seo_title || '').trim();
  const description = String(post?.seoDescription || post?.seo_description || '').trim();
  const keywords = String(post?.seoKeywords || post?.seo_keywords || '').trim();
  const headline = String(post?.title || '').trim() || 'Blog';
  const resolvedTitle = title || `${headline} • ${siteName}`;
  const resolvedDescription =
    description ||
    String(post?.excerpt || '').trim() ||
    blogPlainText(post?.content).slice(0, 160) ||
    `${headline} — ${siteName} blog.`;
  const ogImageAlt =
    String(post?.imageAlt || post?.image_alt || '').trim() || headline;
  return {
    title: resolvedTitle,
    description: resolvedDescription,
    keywords,
    ogImageAlt,
    shareImage: blogPostShareImage(post),
    ogType: 'article',
  };
}

function parseBlogSeoFields(body) {
  return {
    seoTitle: String(body?.seoTitle || '').trim().slice(0, 255) || null,
    seoDescription: String(body?.seoDescription || '').trim().slice(0, 320) || null,
    seoKeywords: String(body?.seoKeywords || '').trim().slice(0, 255) || null,
    imageAlt: String(body?.imageAlt || '').trim().slice(0, 255) || null,
    ogImage: String(body?.ogImage || '').trim().slice(0, 500) || null,
  };
}

async function ensureUniqueBlogSlug(queryFn, baseSlug, excludeId) {
  let slug = slugify(baseSlug);
  let n = 0;
  for (;;) {
    const candidate = n ? `${slug}-${n}` : slug;
    const params = excludeId ? [candidate, excludeId] : [candidate];
    const sql = excludeId
      ? 'SELECT id FROM blog_posts WHERE slug = ? AND id != ? LIMIT 1'
      : 'SELECT id FROM blog_posts WHERE slug = ? LIMIT 1';
    const rows = await queryFn(sql, params);
    if (!rows?.length) return candidate;
    n += 1;
    if (n > 200) return `${slug}-${Date.now()}`;
  }
}

function normalizeBlogStatus(value) {
  return String(value || '').trim().toLowerCase() === 'published' ? 'published' : 'draft';
}

async function getPublishedBlogPost(queryFn, slug) {
  const s = String(slug || '').trim();
  if (!s) return null;
  try {
    const { ensureBlogPostsTable } = require('./ensureBlogPostsTable');
    const { ensureBlogSeoColumns } = require('./ensureBlogSeoColumns');
    await ensureBlogPostsTable();
    await ensureBlogSeoColumns();
    const rows = await queryFn(
      `SELECT * FROM blog_posts WHERE slug = ? AND status = 'published' LIMIT 1`,
      [s]
    );
    if (!rows?.length) return null;
    return blogPostToPublic(rows[0]);
  } catch (_) {
    return null;
  }
}

module.exports = {
  blogPostToPublic,
  blogPostPublicUrl,
  getBlogPublicBaseUrl,
  ensureUniqueBlogSlug,
  normalizeBlogStatus,
  getPublishedBlogPost,
  blogPlainText,
  blogPostShareImage,
  resolveBlogPostSeo,
  parseBlogSeoFields,
};
