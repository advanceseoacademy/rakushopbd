/**
 * In-memory sliding window rate limiter (per process).
 * Fine for single-node / PM2 cluster with sticky sessions; not shared across hosts.
 */
function createRateLimiter({ windowMs = 60_000, max = 10, message = 'Too many requests — please wait' } = {}) {
  const hits = new Map();

  function prune(now) {
    if (hits.size < 500) return;
    for (const [key, bucket] of hits) {
      if (now - bucket.start > windowMs) hits.delete(key);
    }
  }

  return function rateLimit(req, res, next) {
    const ip = String(req.ip || req.socket?.remoteAddress || 'anon');
    const identity = String(req.body?.username || req.body?.email || req.body?.phone || '').trim().toLowerCase();
    const key = `${ip}:${identity}`;
    const now = Date.now();
    prune(now);
    let bucket = hits.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      hits.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return res.status(429).json({ ok: false, error: message });
    }
    next();
  };
}

module.exports = { createRateLimiter };
