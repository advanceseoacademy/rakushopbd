#!/usr/bin/env node
/**
 * Verify Redis config and connectivity.
 * Run: node scripts/redis-check.js
 */
require('dotenv').config();

const { redisConfigured, initRedis, isRedisReady, closeRedis } = require('../lib/redis');
const { cacheBackendLabel, setJson, getJson, del } = require('../lib/appCache');

async function main() {
  const url = String(process.env.REDIS_URL || '').trim();
  console.log('REDIS_URL set:', url ? 'yes' : 'no');
  if (url) console.log('REDIS_URL:', url.replace(/:[^:@/]+@/, ':***@'));

  if (!redisConfigured()) {
    console.log('Status: Redis not configured — using in-memory cache only');
    console.log('Add to .env: REDIS_URL=redis://127.0.0.1:6379');
    process.exit(0);
  }

  const ok = await initRedis();
  console.log('Connected:', ok && isRedisReady());
  console.log('Cache backend:', cacheBackendLabel());

  if (!ok) {
    console.error('FAIL: Could not connect to Redis');
    process.exit(1);
  }

  const testKey = '__redis_check__';
  await setJson(testKey, { t: Date.now() }, 30);
  const hit = await getJson(testKey);
  await del(testKey);

  if (!hit) {
    console.error('FAIL: Redis read/write test failed');
    process.exit(1);
  }

  console.log('Read/write test: OK');
  await closeRedis();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
