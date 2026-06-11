const CATEGORY_SELECT = `
  SELECT c.id, c.slug, c.name_bn, c.icon, c.icon_url, c.sort_order, c.parent_id,
         p.slug AS parent_slug, p.name_bn AS parent_name,
         (SELECT COUNT(*) FROM products prod WHERE prod.category_id = c.id) AS product_count
  FROM categories c
  LEFT JOIN categories p ON p.id = c.parent_id
  ORDER BY COALESCE(c.parent_id, c.id), (c.parent_id IS NOT NULL), c.sort_order ASC, c.name_bn ASC`;

function normalizeCategoryId(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeCategoryRow(row) {
  if (!row) return row;
  return {
    ...row,
    id: normalizeCategoryId(row.id),
    parent_id: normalizeCategoryId(row.parent_id),
    product_count: Number(row.product_count) || 0,
    sort_order: Number(row.sort_order) || 0,
  };
}

function normalizeCategoryList(rows) {
  return (rows || []).map(normalizeCategoryRow).filter((c) => c.id);
}

async function listCategoriesWithCounts(query) {
  const rows = await query(CATEGORY_SELECT).catch(() => []);
  return normalizeCategoryList(rows);
}

async function resolveCategoryIdsBySlug(query, slug) {
  const s = String(slug || '').trim();
  if (!s || s === 'all') return [];
  const rows = await query('SELECT id, parent_id FROM categories WHERE slug = ? LIMIT 1', [s]);
  if (!rows.length) return [];
  const root = rows[0];
  const children = await query('SELECT id FROM categories WHERE parent_id = ?', [root.id]);
  return [root.id, ...children.map((c) => c.id)];
}

function categoryInClause(ids) {
  if (!ids.length) return { clause: '1=0', params: [] };
  return { clause: `p.category_id IN (${ids.map(() => '?').join(', ')})`, params: ids };
}

module.exports = {
  CATEGORY_SELECT,
  normalizeCategoryId,
  normalizeCategoryRow,
  normalizeCategoryList,
  listCategoriesWithCounts,
  resolveCategoryIdsBySlug,
  categoryInClause,
};
