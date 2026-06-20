/** In-memory ISR-style cache for SSR HTML payloads (product SEO + view model). */
const cache = new Map();
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function get(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

function delPrefix(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

function clearAll() {
  cache.clear();
}

module.exports = { get, set, delPrefix, clearAll, DEFAULT_TTL_MS };
