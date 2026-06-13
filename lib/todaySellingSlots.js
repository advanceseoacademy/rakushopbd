/**
 * Assign homepage hero "Today Selling" slots (1 or 2) on products.
 */
function normalizeSlot(value) {
  const n = Number(value);
  return n === 1 || n === 2 ? n : 0;
}

async function clearTodaySellingSlot(query, slot, exceptProductId = null) {
  if (slot !== 1 && slot !== 2) return;
  if (exceptProductId) {
    await query('UPDATE products SET today_selling_slot = 0 WHERE today_selling_slot = ? AND id != ?', [
      slot,
      exceptProductId,
    ]);
    return;
  }
  await query('UPDATE products SET today_selling_slot = 0 WHERE today_selling_slot = ?', [slot]);
}

async function setProductTodaySellingSlot(query, productId, slot) {
  const id = Number(productId);
  if (!id) return;
  const next = normalizeSlot(slot);
  if (next === 1 || next === 2) {
    await clearTodaySellingSlot(query, next, id);
    await query('UPDATE products SET today_selling_slot = ? WHERE id = ?', [next, id]);
    return;
  }
  await query('UPDATE products SET today_selling_slot = 0 WHERE id = ?', [id]);
}

async function setTodaySellingProducts(query, productId1) {
  await query('UPDATE products SET today_selling_slot = 0 WHERE today_selling_slot IN (1, 2)');
  if (productId1) await setProductTodaySellingSlot(query, productId1, 1);
}

module.exports = {
  normalizeSlot,
  setProductTodaySellingSlot,
  setTodaySellingProducts,
};
