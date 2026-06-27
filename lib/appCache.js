const { getRedisClient, isRedisReady } = require('./redis');

const KEY_PREFIX = String(process.env.REDIS_KEY_PREFIX || 'rakushopbd:').trim() || 'rakushopbd:';
const memory = new Map();

function fullKey(key) {
  return `${KEY_PREFIX}${key}`;
}

function memoryGet(key) {
  const hit = memory.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    memory.delete(key);
    return null;
  }
  return hit.value;
}

function memorySet(key, value, ttlSec) {
  memory.set(key, { value, expires: Date.now() + ttlSec * 1000 });
}

function memoryDel(key) {
  memory.delete(key);
}

function memoryDelPrefix(prefix) {
  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

async function getJson(key) {
  const local = memoryGet(key);
  if (local != null) return local;

  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const raw = await redis.get(fullKey(key));
    if (!raw) return null;
    const value = JSON.parse(raw);
    const ttl = await redis.ttl(fullKey(key));
    const ttlSec = Number.isFinite(ttl) && ttl > 0 ? ttl : 300;
    memorySet(key, value, ttlSec);
    return value;
  } catch (err) {
    console.warn('appCache get failed:', key, err.message);
    return null;
  }
}

async function setJson(key, value, ttlSec = 300) {
  const ttl = Math.max(1, Number(ttlSec) || 300);
  memorySet(key, value, ttl);

  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(fullKey(key), JSON.stringify(value), { EX: ttl });
  } catch (err) {
    console.warn('appCache set failed:', key, err.message);
  }
}

async function del(key) {
  memoryDel(key);
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.del(fullKey(key));
  } catch (err) {
    console.warn('appCache del failed:', key, err.message);
  }
}

async function delByPrefix(prefix) {
  memoryDelPrefix(prefix);
  const redis = getRedisClient();
  if (!redis) return;

  const match = `${fullKey(prefix)}*`;
  const keys = [];
  try {
    for await (const key of redis.scanIterator({ MATCH: match, COUNT: 100 })) {
      keys.push(key);
      if (keys.length >= 500) {
        await redis.del(keys);
        keys.length = 0;
      }
    }
    if (keys.length) await redis.del(keys);
  } catch (err) {
    console.warn('appCache delByPrefix failed:', prefix, err.message);
  }
}

function cacheBackendLabel() {
  return isRedisReady() ? 'redis' : 'memory';
}

module.exports = {
  getJson,
  setJson,
  del,
  delByPrefix,
  cacheBackendLabel,
  KEY_PREFIX,
};
