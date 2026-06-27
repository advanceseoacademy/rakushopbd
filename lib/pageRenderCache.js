/** SSR cache for product SEO + view model (Redis + in-memory). */
const appCache = require('./appCache');

const DEFAULT_TTL_MS = 5 * 60 * 1000;

async function get(key) {
  if (!key) return null;
  return appCache.getJson(key);
}

async function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  if (!key) return;
  await appCache.setJson(key, value, Math.max(1, Math.ceil(ttlMs / 1000)));
}

async function delPrefix(prefix) {
  await appCache.delByPrefix(prefix);
}

async function clearAll() {
  await appCache.delByPrefix('ssr:');
}

module.exports = { get, set, delPrefix, clearAll, DEFAULT_TTL_MS };
