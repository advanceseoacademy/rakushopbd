/**
 * Optional Redis client — set REDIS_URL on VPS (e.g. redis://127.0.0.1:6379).
 * Falls back gracefully; app cache works in-memory when Redis is unavailable.
 */
let client = null;
let connected = false;
let connectPromise = null;

function redisConfigured() {
  return Boolean(String(process.env.REDIS_URL || '').trim());
}

function isRedisReady() {
  return connected && client?.isOpen;
}

async function initRedis() {
  if (!redisConfigured()) return false;
  if (connected && client?.isOpen) return true;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    try {
      const { createClient } = require('redis');
      const url = String(process.env.REDIS_URL).trim();
      client = createClient({
        url,
        socket: {
          connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 5000,
          reconnectStrategy(retries) {
            if (retries > 8) return false;
            return Math.min(retries * 200, 3000);
          },
        },
      });
      client.on('error', (err) => {
        console.warn('Redis error:', err.message);
      });
      await client.connect();
      connected = true;
      return true;
    } catch (err) {
      connected = false;
      client = null;
      console.warn('Redis connect failed — in-memory cache only:', err.message);
      return false;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

async function closeRedis() {
  if (!client?.isOpen) {
    connected = false;
    client = null;
    return;
  }
  try {
    await client.quit();
  } catch (_) {
    try {
      await client.disconnect();
    } catch (_) {}
  }
  connected = false;
  client = null;
}

function getRedisClient() {
  return isRedisReady() ? client : null;
}

module.exports = {
  redisConfigured,
  isRedisReady,
  initRedis,
  closeRedis,
  getRedisClient,
};
