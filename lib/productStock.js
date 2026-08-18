const { query, usePostgres } = require('../config/db');

let ensuredStockCommitted = false;

function isDuplicateColumnError(err) {
  const code = err?.code || err?.errno;
  return code === 'ER_DUP_FIELDNAME' || code === '42701' || /duplicate column/i.test(String(err?.message));
}

function isTruthy(val) {
  return val === true || val === 1 || val === '1' || val === 't' || val === 'true';
}

function lineProductId(item) {
  return Number(item?.productId ?? item?.product_id) || 0;
}

function lineQty(item) {
  return Math.max(0, Math.floor(Number(item?.qty ?? item?.quantity) || 0));
}

function aggregateStockLines(items) {
  const map = new Map();
  for (const item of items || []) {
    const productId = lineProductId(item);
    const qty = lineQty(item);
    if (!productId || qty < 1) continue;
    map.set(productId, (map.get(productId) || 0) + qty);
  }
  return [...map.entries()].map(([productId, qty]) => ({ productId, qty }));
}

function mysqlAffected(result) {
  if (!result) return 0;
  if (Array.isArray(result)) return Number(result[0]?.affectedRows || 0);
  return Number(result.affectedRows || 0);
}

function clearProductCaches() {
  try {
    require('./storeBootstrap').clearStoreBootstrapCache();
  } catch (_) {}
}

async function ensureOrderStockCommittedColumn() {
  if (ensuredStockCommitted) return true;
  const pg = usePostgres();
  const boolDef = pg ? 'BOOLEAN NOT NULL DEFAULT false' : 'TINYINT(1) NOT NULL DEFAULT 0';
  try {
    await query(`ALTER TABLE orders ADD COLUMN stock_committed ${boolDef}`);
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }
  ensuredStockCommitted = true;
  return true;
}

async function decrementProductStock(productId, qty) {
  const id = Number(productId);
  const n = Math.max(0, Math.floor(Number(qty) || 0));
  if (!id || n < 1) return false;

  if (usePostgres()) {
    const rows = await query(
      `UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ? RETURNING id`,
      [n, id, n]
    );
    return Boolean(rows?.length);
  }

  const result = await query(
    `UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?`,
    [n, id, n]
  );
  return mysqlAffected(result) > 0;
}

async function incrementProductStock(productId, qty) {
  const id = Number(productId);
  const n = Math.max(0, Math.floor(Number(qty) || 0));
  if (!id || n < 1) return;
  await query(`UPDATE products SET stock = stock + ? WHERE id = ?`, [n, id]);
}

async function releaseStockLines(lines) {
  for (const line of aggregateStockLines(lines)) {
    await incrementProductStock(line.productId, line.qty);
  }
  if (lines?.length) clearProductCaches();
}

async function takeStockLines(items) {
  await ensureOrderStockCommittedColumn();
  const lines = aggregateStockLines(items);
  const taken = [];
  for (const line of lines) {
    const ok = await decrementProductStock(line.productId, line.qty);
    if (!ok) {
      await releaseStockLines(taken);
      const rows = await query('SELECT name_bn, stock FROM products WHERE id = ? LIMIT 1', [
        line.productId,
      ]);
      const name = rows[0]?.nameBn || rows[0]?.name_bn || 'This product';
      const stock = Number(rows[0]?.stock) || 0;
      return {
        ok: false,
        taken: [],
        error:
          stock <= 0
            ? `${name} is out of stock.`
            : `${name} only has ${stock} left in stock.`,
      };
    }
    taken.push(line);
  }
  if (taken.length) clearProductCaches();
  return { ok: true, taken };
}

async function markOrderStockCommitted(orderId, committed) {
  const id = Number(orderId);
  if (!id) return;
  await ensureOrderStockCommittedColumn();
  const flag = usePostgres() ? Boolean(committed) : committed ? 1 : 0;
  await query('UPDATE orders SET stock_committed = ? WHERE id = ?', [flag, id]).catch(() => {});
}

async function releaseCommittedOrderStock(orderId) {
  const id = Number(orderId);
  if (!id) return { released: false };
  await ensureOrderStockCommittedColumn();
  const orders = await query('SELECT id, stock_committed FROM orders WHERE id = ? LIMIT 1', [id]);
  if (!orders.length || !isTruthy(orders[0].stockCommitted ?? orders[0].stock_committed)) {
    return { released: false };
  }
  const items = await query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [id]);
  await releaseStockLines(items);
  await markOrderStockCommitted(id, false);
  return { released: true };
}

async function takeStockForExistingOrder(orderId) {
  const id = Number(orderId);
  if (!id) return { ok: false, error: 'Invalid order' };
  await ensureOrderStockCommittedColumn();
  const orders = await query('SELECT id, stock_committed FROM orders WHERE id = ? LIMIT 1', [id]);
  if (!orders.length) return { ok: false, error: 'Order not found' };
  if (isTruthy(orders[0].stockCommitted ?? orders[0].stock_committed)) {
    return { ok: true, alreadyCommitted: true };
  }
  const items = await query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [id]);
  const result = await takeStockLines(items);
  if (!result.ok) return result;
  await markOrderStockCommitted(id, true);
  return { ok: true };
}

module.exports = {
  ensureOrderStockCommittedColumn,
  takeStockLines,
  releaseStockLines,
  markOrderStockCommitted,
  releaseCommittedOrderStock,
  takeStockForExistingOrder,
};
