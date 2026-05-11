// Redis wrapper test — không cần Redis server thật.
// Mock ioredis trước khi require db/redis.

jest.mock('ioredis', () => {
  const store = new Map();
  class FakeRedis {
    constructor() {
      this.store = store;
      this.handlers = {};
      this._failNext = false;
    }
    on(event, cb) {
      this.handlers[event] = cb;
    }
    async get(key) {
      if (this._failNext) {
        this._failNext = false;
        throw new Error('redis_fail');
      }
      return this.store.has(key) ? this.store.get(key) : null;
    }
    async set(key, value, mode, ttl) {
      this.store.set(key, value);
      return 'OK';
    }
    async del(...keys) {
      let n = 0;
      for (const k of keys) if (this.store.delete(k)) n++;
      return n;
    }
    async quit() {
      this.store.clear();
    }
    failNext() {
      this._failNext = true;
    }
  }
  FakeRedis.__store = store;
  return FakeRedis;
});

// Force-enable in test env — db/redis bình thường skip khi NODE_ENV=test.
const originalEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'development';
process.env.USE_REDIS_CACHE = 'true';
const redis = require('../../db/redis');

describe('db/redis wrapper', () => {
  afterAll(async () => {
    await redis.quit();
    process.env.NODE_ENV = originalEnv;
  });

  beforeEach(async () => {
    await redis.del(
      'k1',
      'k2',
      'k3',
      'wrap:hit',
      'wrap:miss',
      'wrap:nullret',
    );
  });

  test('set + get round-trip', async () => {
    expect(await redis.set('k1', {a: 1}, 60)).toBe(true);
    expect(await redis.get('k1')).toEqual({a: 1});
  });

  test('get returns null when key missing', async () => {
    expect(await redis.get('k2')).toBeNull();
  });

  test('del removes keys', async () => {
    await redis.set('k1', 1, 60);
    await redis.set('k2', 2, 60);
    expect(await redis.del('k1', 'k2')).toBe(2);
    expect(await redis.get('k1')).toBeNull();
  });

  test('wrap hits cache on second call', async () => {
    const fn = jest.fn().mockResolvedValue({fresh: true});
    const v1 = await redis.wrap('wrap:hit', 60, fn);
    const v2 = await redis.wrap('wrap:hit', 60, fn);
    expect(v1).toEqual({fresh: true});
    expect(v2).toEqual({fresh: true});
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('wrap does not cache null/undefined return', async () => {
    const fn = jest.fn().mockResolvedValue(null);
    const v = await redis.wrap('wrap:nullret', 60, fn);
    expect(v).toBeNull();
    await redis.wrap('wrap:nullret', 60, fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('TTL constants present', () => {
    expect(redis.TTL.PERMISSION).toBe(3600);
    expect(redis.TTL.SETTING).toBe(300);
    expect(redis.TTL.MASTER_DATA).toBe(86400);
    expect(redis.TTL.REPORT).toBe(900);
  });
});
