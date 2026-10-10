/** Logged-in customers' carts mirrored to the DB so admin can see what they left in the cart. */
const { query, usePostgres } = require('../config/db');

let ensurePromise = null;

function ensureUserCartsTable() {
  if (!ensurePromise) {
    const pg = usePostgres();
    const sql = pg
      ? `CREATE TABLE IF NOT EXISTS user_carts (
          user_id INT PRIMARY KEY,
          items TEXT NOT NULL,
          item_count INT NOT NULL DEFAULT 0,
          subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )`
      : `CREATE TABLE IF NOT EXISTS user_carts (
          user_id INT PRIMARY KEY,
          items TEXT NOT NULL,
          item_count INT NOT NULL DEFAULT 0,
          subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;
    ensurePromise = query(sql).catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  return ensurePromise;
}

function compactItems(cart) {
  return (Array.isArray(cart) ? cart : [])
    .filter((i) => i && i.productId)
    .slice(0, 100)
    .map((i) => ({
      productId: Number(i.productId),
      name: String(i.name || '').slice(0, 300),
      price: Number(i.price) || 0,
      qty: Math.max(1, Number(i.qty) || 1),
      imageUrl: i.imageUrl || null,
    }));
}

async function writeUserCart(userId, cart) {
  await ensureUserCartsTable();
  const items = compactItems(cart);
  if (!items.length) {
    await query('DELETE FROM user_carts WHERE user_id = ?', [userId]);
    return;
  }
  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const json = JSON.stringify(items);
  const now = new Date();
  if (usePostgres()) {
    await query(
      `INSERT INTO user_carts (user_id, items, item_count, subtotal, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET
         items = EXCLUDED.items, item_count = EXCLUDED.item_count,
         subtotal = EXCLUDED.subtotal, updated_at = EXCLUDED.updated_at`,
      [userId, json, count, subtotal, now, now]
    );
  } else {
    await query(
      `INSERT INTO user_carts (user_id, items, item_count, subtotal, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE items = VALUES(items), item_count = VALUES(item_count),
         subtotal = VALUES(subtotal), updated_at = VALUES(updated_at)`,
      [userId, json, count, subtotal, now, now]
    );
  }
}

const pendingWrites = new Map();

/** Fire-and-forget mirror of the session cart for a logged-in customer (writes per user run in order). */
function saveUserCart(userId, cart) {
  const id = Number(userId);
  if (!id) return;
  const snapshot = compactItems(cart);
  const prev = pendingWrites.get(id) || Promise.resolve();
  const next = prev
    .then(() => writeUserCart(id, snapshot))
    .catch((err) => console.warn('save user cart failed:', err.message))
    .finally(() => {
      if (pendingWrites.get(id) === next) pendingWrites.delete(id);
    });
  pendingWrites.set(id, next);
}

async function loadUserCartItems(userId) {
  const id = Number(userId);
  if (!id) return [];
  await ensureUserCartsTable();
  const rows = await query('SELECT items FROM user_carts WHERE user_id = ? LIMIT 1', [id]);
  if (!rows.length) return [];
  try {
    const items = JSON.parse(rows[0].items);
    return Array.isArray(items) ? items : [];
  } catch (_) {
    return [];
  }
}

/**
 * On login/register: keep the account's saved cart in sync with the session.
 * A non-empty session cart wins; an empty session restores the saved cart.
 */
async function syncCartOnLogin(req) {
  const userId = Number(req.session?.userId);
  if (!userId) return;
  try {
    const sessionCart = Array.isArray(req.session.cart) ? req.session.cart : [];
    if (sessionCart.length) {
      await writeUserCart(userId, sessionCart);
      return;
    }
    const saved = await loadUserCartItems(userId);
    if (saved.length) req.session.cart = saved;
  } catch (err) {
    console.warn('cart sync on login failed:', err.message);
  }
}

module.exports = { ensureUserCartsTable, saveUserCart, syncCartOnLogin };
