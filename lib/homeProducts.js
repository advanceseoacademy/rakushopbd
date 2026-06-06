/**
 * Homepage product sections: best sellers (by order qty) and new arrivals (by created_at).
 */
const PRODUCT_FIELDS = `p.*, c.slug AS category_slug, c.name_bn AS category_name`;

async function getBestSellingProducts(query, limit = 24) {
  return query(
    `SELECT ${PRODUCT_FIELDS}, COALESCE(sales.qty, 0) AS sold_qty
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN (
       SELECT oi.product_id, SUM(oi.quantity) AS qty
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
       GROUP BY oi.product_id
     ) sales ON sales.product_id = p.id
     ORDER BY sold_qty DESC, p.created_at DESC, p.id DESC
     LIMIT ?`,
    [limit]
  ).catch(() => []);
}

async function getNewArrivalProducts(query, limit = 24) {
  // Newest uploads last: highest product id + latest created_at first
  return query(
    `SELECT ${PRODUCT_FIELDS}
     FROM products p
     JOIN categories c ON c.id = p.category_id
     ORDER BY p.id DESC, p.created_at DESC
     LIMIT ?`,
    [limit]
  ).catch(() => []);
}

module.exports = { getBestSellingProducts, getNewArrivalProducts };
