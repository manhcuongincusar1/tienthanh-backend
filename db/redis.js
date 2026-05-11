// Redis client wrapper — cache layer cho hot path (DECISIONS A9/C5).
// TTL per DECISIONS C5: permission 1h, settings 5m, master data 24h, report 15m.
//
// Fail-open: nếu Redis down, mọi `get/wrap` trả về null/fn() để fallback DB. Không throw.
// Disable hoàn toàn qua env `USE_REDIS_CACHE=false`.

const Redis = require('ioredis');

const enabled =
  process.env.USE_REDIS_CACHE !== 'false' &&
  process.env.NODE_ENV !== 'test';

let client = null;
let lastErrorLogAt = 0;

function logErrorThrottled(err) {
  const now = Date.now();
  if (now - lastErrorLogAt > 60000) {
    console.warn('redis_error', err?.message || err);
    lastErrorLogAt = now;
  }
}

function getClient() {
  if (!enabled) return null;
  if (client) return client;

  client = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    connectTimeout: 2000,
    commandTimeout: 1000,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });

  client.on('error', logErrorThrottled);
  return client;
}

async function get(key) {
  const c = getClient();
  if (!c) return null;
  try {
    const raw = await c.get(key);
    if (raw === null || raw === undefined) return null;
    return JSON.parse(raw);
  } catch (err) {
    logErrorThrottled(err);
    return null;
  }
}

async function set(key, value, ttlSeconds) {
  const c = getClient();
  if (!c) return false;
  try {
    const payload = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await c.set(key, payload, 'EX', ttlSeconds);
    } else {
      await c.set(key, payload);
    }
    return true;
  } catch (err) {
    logErrorThrottled(err);
    return false;
  }
}

async function del(...keys) {
  const c = getClient();
  if (!c || keys.length === 0) return 0;
  try {
    return await c.del(...keys);
  } catch (err) {
    logErrorThrottled(err);
    return 0;
  }
}

// wrap(key, ttl, fn) — get-or-set pattern. Cache miss thì gọi fn(), set + return.
async function wrap(key, ttlSeconds, fn) {
  const cached = await get(key);
  if (cached !== null) return cached;
  const fresh = await fn();
  if (fresh !== null && fresh !== undefined) {
    await set(key, fresh, ttlSeconds);
  }
  return fresh;
}

async function quit() {
  if (client) {
    try {
      await client.quit();
    } catch {
      /* ignore */
    }
    client = null;
  }
}

// TTL constants (DECISIONS C5).
const TTL = {
  PERMISSION: 3600,
  SETTING: 300,
  MASTER_DATA: 86400,
  REPORT: 900,
};

module.exports = {get, set, del, wrap, quit, TTL, isEnabled: () => enabled};
