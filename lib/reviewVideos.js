const { firstInsertId } = require('../config/db');
const { returningId } = require('./db-dialect');

function mapVideoRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    orderId: row.order_id ?? row.orderId,
    productId: row.product_id ?? row.productId,
    productName: row.product_name ?? row.productName ?? '',
    videoUrl: row.video_url ?? row.videoUrl ?? '',
    status: row.status,
    adminNote: row.admin_note ?? row.adminNote ?? '',
    createdAt: row.created_at ?? row.createdAt,
    reviewedAt: row.reviewed_at ?? row.reviewedAt,
    customerName: row.customer_name ?? row.customerName ?? '',
    orderNumber: row.order_number ?? row.orderNumber ?? '',
  };
}

async function listUserReviewVideos(query, userId) {
  const rows = await query(
    `SELECT id, user_id, order_id, product_id, product_name, video_url, status, admin_note, created_at, reviewed_at
     FROM product_review_videos
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 100`,
    [userId]
  );
  return rows.map(mapVideoRow);
}

async function listEligibleReviewVideoProducts(query, userId) {
  const orders = await query(
    `SELECT id, order_number, created_at
     FROM orders
     WHERE user_id = ? AND LOWER(status) = 'delivered'
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  );

  const eligible = [];

  for (const order of orders) {
    const items = await query(
      `SELECT oi.product_id, oi.product_name, oi.quantity
       FROM order_items oi
       WHERE oi.order_id = ? AND oi.product_id IS NOT NULL`,
      [order.id]
    );

    for (const item of items) {
      const productId = Number(item.product_id ?? item.productId);
      if (!productId) continue;

      const existing = await query(
        `SELECT id, status FROM product_review_videos
         WHERE user_id = ? AND order_id = ? AND product_id = ?
         LIMIT 1`,
        [userId, order.id, productId]
      );

      const status = String(existing[0]?.status || '').toLowerCase();
      if (existing.length && (status === 'pending' || status === 'approved')) continue;

      eligible.push({
        orderId: order.id,
        orderNumber: order.order_number ?? order.orderNumber,
        orderDate: order.created_at ?? order.createdAt,
        productId,
        productName: item.product_name ?? item.productName ?? 'Product',
        quantity: Number(item.quantity) || 1,
        canResubmit: status === 'rejected',
      });
    }
  }

  return eligible;
}

async function createReviewVideoSubmission(query, userId, { orderId, productId, videoUrl }) {
  const oid = Number(orderId);
  const pid = Number(productId);
  const url = String(videoUrl || '').trim();

  if (!oid || !pid || !url) {
    return { ok: false, error: 'Order, product, and video are required' };
  }
  if (!url.startsWith('/uploads/review-videos/')) {
    return { ok: false, error: 'Invalid video URL' };
  }

  const orders = await query(
    `SELECT id, order_number FROM orders WHERE id = ? AND user_id = ? AND LOWER(status) = 'delivered' LIMIT 1`,
    [oid, userId]
  );
  if (!orders.length) {
    return { ok: false, error: 'Delivered order not found' };
  }

  const items = await query(
    `SELECT product_name FROM order_items WHERE order_id = ? AND product_id = ? LIMIT 1`,
    [oid, pid]
  );
  if (!items.length) {
    return { ok: false, error: 'Product was not in this order' };
  }

  const existing = await query(
    `SELECT id, status FROM product_review_videos
     WHERE user_id = ? AND order_id = ? AND product_id = ?
     LIMIT 1`,
    [userId, oid, pid]
  );
  const prevStatus = String(existing[0]?.status || '').toLowerCase();
  if (existing.length && (prevStatus === 'pending' || prevStatus === 'approved')) {
    return { ok: false, error: 'You already submitted a review video for this product' };
  }

  const productName = String(items[0].product_name ?? items[0].productName ?? 'Product').trim();

  if (existing.length && prevStatus === 'rejected') {
    await query(
      `UPDATE product_review_videos
       SET video_url = ?, status = 'pending', admin_note = '', reviewed_at = NULL, created_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [url, existing[0].id, userId]
    );
    const rows = await query('SELECT * FROM product_review_videos WHERE id = ? LIMIT 1', [existing[0].id]);
    return { ok: true, video: mapVideoRow(rows[0]) };
  }

  const result = await query(
    `INSERT INTO product_review_videos (user_id, order_id, product_id, product_name, video_url, status)
     VALUES (?, ?, ?, ?, ?, 'pending')${returningId()}`,
    [userId, oid, pid, productName, url]
  );
  const newId = firstInsertId(result);
  const rows = await query('SELECT * FROM product_review_videos WHERE id = ? LIMIT 1', [newId]);
  return { ok: true, video: mapVideoRow(rows[0]) };
}

async function listAdminReviewVideos(query, statusFilter) {
  let sql = `SELECT v.*, u.full_name AS customer_name, o.order_number
             FROM product_review_videos v
             JOIN users u ON u.id = v.user_id
             JOIN orders o ON o.id = v.order_id`;
  const params = [];
  if (statusFilter && statusFilter !== 'all') {
    sql += ' WHERE v.status = ?';
    params.push(statusFilter);
  }
  sql += ' ORDER BY v.created_at DESC LIMIT 200';
  const rows = await query(sql, params);
  return rows.map(mapVideoRow);
}

async function countPendingReviewVideos(query) {
  const rows = await query(
    `SELECT COUNT(*) AS pending FROM product_review_videos WHERE status = 'pending'`
  );
  return Number(rows[0]?.pending) || 0;
}

module.exports = {
  mapVideoRow,
  listUserReviewVideos,
  listEligibleReviewVideoProducts,
  createReviewVideoSubmission,
  listAdminReviewVideos,
  countPendingReviewVideos,
};
