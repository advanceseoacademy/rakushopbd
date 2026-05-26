/** PostgreSQL returns unquoted aliases lowercased (adminCount → admincount). */
const ALIAS_MAP = {
  admincount: 'adminCount',
  productcount: 'productCount',
  totalorders: 'totalOrders',
  pendingorders: 'pendingOrders',
  totalrevenue: 'totalRevenue',
  monthrevenue: 'monthRevenue',
  totalproducts: 'totalProducts',
  lowstock: 'lowStock',
  ordercount: 'orderCount',
  monthorders: 'monthOrders',
  monthcustomers: 'monthCustomers',
  monthnew: 'monthNew',
  avgorder: 'avgOrder',
  avgspent: 'avgSpent',
  avg_rating: 'avg_rating',
  avgrating: 'avgRating',
  items_preview: 'items_preview',
  itemspreview: 'itemsPreview',
  category_name: 'category_name',
  category_slug: 'category_slug',
};

function camelizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  for (const [k, v] of Object.entries(row)) {
    const snakeCamel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (snakeCamel !== k) out[snakeCamel] = v;
    const mapped = ALIAS_MAP[k.toLowerCase()];
    if (mapped) out[mapped] = v;
  }
  return out;
}

module.exports = { camelizeRow };
