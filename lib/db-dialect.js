/** SQL helpers for PostgreSQL (Supabase) vs MySQL */

function isPostgres() {
  if (process.env.DB_DRIVER === 'mysql') return false;
  if (process.env.DB_DRIVER === 'postgres') return true;
  return Boolean(
    process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL
  );
}

function convertPlaceholders(sql, params, postgres = isPostgres()) {
  if (!postgres) return { text: sql, values: params };
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values: params };
}

/** site_settings upsert */
function upsertSiteSettingSql() {
  if (isPostgres()) {
    return `INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
      ON CONFLICT (setting_key) DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        updated_at = CURRENT_TIMESTAMP`;
  }
  return `INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`;
}

function returningId() {
  return isPostgres() ? ' RETURNING id' : '';
}

/** Case-insensitive substring match (ILIKE on Postgres, LOWER+LIKE on MySQL). */
function likeFragment(column) {
  if (isPostgres()) return `${column} ILIKE ?`;
  return `LOWER(${column}) LIKE LOWER(?)`;
}

module.exports = {
  isPostgres,
  convertPlaceholders,
  upsertSiteSettingSql,
  returningId,
  likeFragment,
  sql: {
    curDateOrLater: () =>
      isPostgres()
        ? `(expires_at IS NULL OR expires_at >= CURRENT_DATE)`
        : `(expires_at IS NULL OR expires_at >= CURDATE())`,
    ordersThisMonth: () =>
      isPostgres()
        ? `DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_TIMESTAMP)`
        : `MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())`,
    revenueLast12Months: () =>
      isPostgres()
        ? `created_at >= (CURRENT_DATE - INTERVAL '12 months')`
        : `created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)`,
    revenueGroupByMonth: () =>
      isPostgres()
        ? `DATE_TRUNC('month', created_at)`
        : `YEAR(created_at), MONTH(created_at)`,
    revenueSelectMonth: () =>
      isPostgres()
        ? `EXTRACT(MONTH FROM DATE_TRUNC('month', created_at))::int AS m`
        : `MONTH(created_at) AS m`,
    revenueOrderByMonth: () =>
      isPostgres() ? `DATE_TRUNC('month', created_at)` : `YEAR(created_at), MONTH(created_at)`,
    orderItemsPreview: (orderAlias = 'o') =>
      isPostgres()
        ? `(SELECT STRING_AGG(sub.product_name, ', ') FROM (
            SELECT oi.product_name FROM order_items oi WHERE oi.order_id = ${orderAlias}.id LIMIT 2
          ) sub)`
        : `(SELECT GROUP_CONCAT(oi.product_name SEPARATOR ', ') FROM order_items oi WHERE oi.order_id = ${orderAlias}.id LIMIT 2)`,
  },
};
