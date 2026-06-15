const POINTS_PER_TAKA = 100;

function pointsForAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n / POINTS_PER_TAKA);
}

function pointsForProductPrice(price, qty = 1) {
  const q = Math.max(1, Number(qty) || 1);
  return pointsForAmount(Number(price) * q);
}

function pointsFromCartItems(cart) {
  if (!Array.isArray(cart)) return 0;
  return cart.reduce(
    (sum, item) => sum + pointsForAmount(Number(item.price) * Number(item.qty || 1)),
    0
  );
}

function pointsFromOrderItems(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce(
    (sum, item) =>
      sum +
      pointsForAmount(
        Number(item.unit_price ?? item.unitPrice ?? item.price) * Number(item.quantity ?? item.qty ?? 1)
      ),
    0
  );
}

async function getUserRewardPoints(query, userId) {
  if (!userId) return 0;
  const rows = await query('SELECT reward_points FROM users WHERE id = ?', [userId]);
  return Number(rows[0]?.reward_points ?? rows[0]?.rewardPoints) || 0;
}

/** Award points when an order is marked delivered (once per order). */
async function awardOrderPointsOnDelivery(query, orderId) {
  const rows = await query(
    'SELECT id, user_id, status, reward_points_awarded FROM orders WHERE id = ?',
    [orderId]
  );
  const order = rows[0];
  if (!order?.user_id) return { earned: 0, balance: null };
  if (Number(order.reward_points_awarded) > 0) {
    return { earned: 0, balance: await getUserRewardPoints(query, order.user_id) };
  }
  if (String(order.status).toLowerCase() !== 'delivered') {
    return { earned: 0, balance: null };
  }

  const items = await query('SELECT unit_price, quantity FROM order_items WHERE order_id = ?', [orderId]);
  const earned = pointsFromOrderItems(items);
  if (earned <= 0) {
    await query('UPDATE orders SET reward_points_awarded = 0 WHERE id = ?', [orderId]);
    return { earned: 0, balance: await getUserRewardPoints(query, order.user_id) };
  }

  await query('UPDATE users SET reward_points = COALESCE(reward_points, 0) + ? WHERE id = ?', [
    earned,
    order.user_id,
  ]);
  await query('UPDATE orders SET reward_points_awarded = ? WHERE id = ?', [earned, orderId]);
  return { earned, balance: await getUserRewardPoints(query, order.user_id) };
}

module.exports = {
  POINTS_PER_TAKA,
  pointsForAmount,
  pointsForProductPrice,
  pointsFromCartItems,
  pointsFromOrderItems,
  getUserRewardPoints,
  awardOrderPointsOnDelivery,
};
