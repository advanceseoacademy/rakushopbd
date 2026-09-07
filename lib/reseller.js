const { query } = require('../config/db');

function roundToNearest5(amount) {
  const n = Number(amount) || 0;
  return Math.round(n / 5) * 5;
}

function sellingFromMarkup(basePrice, markupPercent) {
  const base = Number(basePrice) || 0;
  const pct = Number(markupPercent) || 0;
  return roundToNearest5(base * (1 + pct / 100));
}

function sanitizeReseller(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    status: row.status,
    defaultMarkupPercent: Number(row.default_markup_percent) || 0,
    walletBalance: Number(row.wallet_balance) || 0,
    pendingBalance: Number(row.pending_balance) || 0,
    totalEarned: Number(row.total_earned) || 0,
    applyNote: row.apply_note || null,
    createdAt: row.created_at,
  };
}

async function getResellerByUserId(userId) {
  const rows = await query('SELECT * FROM resellers WHERE user_id = ? LIMIT 1', [userId]);
  return rows[0] || null;
}

async function getResellerById(id) {
  const rows = await query('SELECT * FROM resellers WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

function lineProfitTotal(lines) {
  return (lines || []).reduce(
    (s, r) => s + (Number(r.reseller_profit_snapshot) || 0) * (Number(r.quantity) || 0),
    0
  );
}

async function addPendingProfit(resellerId, profit) {
  const amt = Math.max(0, Number(profit) || 0);
  if (!amt) return;
  await query(
    `UPDATE resellers SET pending_balance = pending_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [amt, resellerId]
  );
}

async function creditWalletOnDelivered(orderId) {
  const orders = await query(`SELECT id, reseller_id, status FROM orders WHERE id = ? LIMIT 1`, [
    orderId,
  ]);
  const order = orders[0];
  if (!order?.reseller_id) return { ok: true, credited: 0 };
  if (String(order.status).toLowerCase() !== 'delivered') return { ok: true, credited: 0 };

  const lines = await query(
    `SELECT quantity, reseller_profit_snapshot FROM order_items WHERE order_id = ?`,
    [orderId]
  );
  const profit = lineProfitTotal(lines);
  if (profit <= 0) return { ok: true, credited: 0 };

  await query(
    `UPDATE resellers SET
      pending_balance = GREATEST(0, pending_balance - ?),
      wallet_balance = wallet_balance + ?,
      total_earned = total_earned + ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [profit, profit, profit, order.reseller_id]
  );
  return { ok: true, credited: profit };
}

async function reversePendingOnCancel(orderId, { alreadyDelivered = false } = {}) {
  const orders = await query(`SELECT id, reseller_id FROM orders WHERE id = ? LIMIT 1`, [orderId]);
  const order = orders[0];
  if (!order?.reseller_id) return { ok: true, reversed: 0 };

  const lines = await query(
    `SELECT quantity, reseller_profit_snapshot FROM order_items WHERE order_id = ?`,
    [orderId]
  );
  const profit = lineProfitTotal(lines);
  if (profit <= 0) return { ok: true, reversed: 0 };

  if (alreadyDelivered) {
    await query(
      `UPDATE resellers SET
        wallet_balance = GREATEST(0, wallet_balance - ?),
        total_earned = GREATEST(0, total_earned - ?),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [profit, profit, order.reseller_id]
    );
  } else {
    await query(
      `UPDATE resellers SET
        pending_balance = GREATEST(0, pending_balance - ?),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [profit, order.reseller_id]
    );
  }
  return { ok: true, reversed: profit };
}

module.exports = {
  roundToNearest5,
  sellingFromMarkup,
  sanitizeReseller,
  getResellerByUserId,
  getResellerById,
  addPendingProfit,
  creditWalletOnDelivered,
  reversePendingOnCancel,
  lineProfitTotal,
};
