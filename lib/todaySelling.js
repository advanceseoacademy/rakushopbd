/**
 * Homepage hero sidebar — Today Selling (2 admin-picked products).
 */
const PRODUCT_FIELDS = `p.*, c.slug AS category_slug, c.name_bn AS category_name`;

async function getTodaySellingProducts(query, settings) {
  if (settings?.today_selling_enabled === '0') return [];

  return query(
    `SELECT ${PRODUCT_FIELDS}
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.today_selling_slot IN (1, 2)
     ORDER BY p.today_selling_slot ASC`
  ).catch(() => []);
}

function getTodaySellingMeta(settings) {
  return {
    enabled: settings?.today_selling_enabled !== '0',
    title: String(settings?.today_selling_title || 'Today Selling').trim() || 'Today Selling',
  };
}

module.exports = {
  getTodaySellingProducts,
  getTodaySellingMeta,
};
