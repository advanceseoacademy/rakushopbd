/**
 * Homepage "Today Deals" — admin-picked products + countdown end time.
 */
const PRODUCT_FIELDS = `p.*, c.slug AS category_slug, c.name_bn AS category_name`;

function parseProductIds(settings) {
  try {
    const raw = settings?.today_deals_product_ids;
    if (typeof raw === 'string' && raw.trim()) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return [...new Set(arr.map((id) => Number(id)).filter((id) => id > 0))].slice(0, 12);
      }
    }
  } catch (_) {}
  return [];
}

function parseEndsAt(settings) {
  const raw = String(settings?.today_deals_ends_at || '').trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function isExpired(endsAtIso) {
  if (!endsAtIso) return false;
  return Date.parse(endsAtIso) <= Date.now();
}

async function getTodayDealsProducts(query, settings) {
  if (settings?.today_deals_enabled === '0') return [];
  const endsAt = parseEndsAt(settings);
  if (isExpired(endsAt)) return [];

  const ids = parseProductIds(settings);
  if (!ids.length) return [];

  const placeholders = ids.map(() => '?').join(', ');
  const rows = await query(
    `SELECT ${PRODUCT_FIELDS}
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.id IN (${placeholders})`,
    ids
  ).catch(() => []);

  const byId = new Map(rows.map((row) => [Number(row.id), row]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

function getTodayDealsMeta(settings) {
  const endsAt = parseEndsAt(settings);
  const expired = isExpired(endsAt);
  return {
    enabled: settings?.today_deals_enabled !== '0' && !expired,
    title: String(settings?.today_deals_title || 'Today Deals').trim() || 'Today Deals',
    endsAt,
  };
}

module.exports = {
  parseProductIds,
  getTodayDealsProducts,
  getTodayDealsMeta,
};
