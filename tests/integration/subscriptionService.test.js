const knexPg = require('../../db/connectKnex');
const subscriptionService = require('../../services/subscriptionService');

describe('SubscriptionService (PG-backed)', () => {
  beforeAll(async () => {
    await knexPg.schema.dropTableIfExists('subscriptions');
    await knexPg.schema.createTable('subscriptions', (t) => {
      t.bigIncrements('id').primary();
      t.bigInteger('user_id').notNullable();
      t.text('auth').notNullable().unique();
      t.jsonb('info').notNullable();
      t.timestamp('created_at', {useTz: true})
        .notNullable()
        .defaultTo(knexPg.fn.now());
      t.index('user_id');
    });
  });

  afterAll(async () => {
    await knexPg.schema.dropTableIfExists('subscriptions');
  });

  beforeEach(async () => {
    await knexPg('subscriptions').del();
  });

  const samplePush = (idx) => ({
    endpoint: `https://fcm.googleapis.com/fcm/send/abc${idx}`,
    keys: {p256dh: `key${idx}`, auth: `secret${idx}`},
  });

  it('insertNewSubscription tạo row, trả về auth', async () => {
    const auth = await subscriptionService.insertNewSubscription(
      42,
      samplePush(1),
      'auth-token-1',
    );
    expect(auth).toBe('auth-token-1');

    const row = await knexPg('subscriptions').first();
    expect(Number(row.user_id)).toBe(42);
    expect(row.info.endpoint).toContain('abc1');
  });

  it('insertNewSubscription idempotent với same auth', async () => {
    await subscriptionService.insertNewSubscription(1, samplePush(1), 'a');
    await subscriptionService.insertNewSubscription(2, samplePush(2), 'a');

    const rows = await knexPg('subscriptions');
    expect(rows.length).toBe(1);
    expect(Number(rows[0].user_id)).toBe(2); // updated
  });

  it('getSubscription trả backward-compat shape', async () => {
    await subscriptionService.insertNewSubscription(7, samplePush(1), 'a-7');
    const res = await subscriptionService.getSubscription(7);
    expect(res).toEqual({
      userId: '7',
      auth: 'a-7',
      info: samplePush(1),
    });
  });

  it('getSubscription trả false khi không có', async () => {
    expect(await subscriptionService.getSubscription(999)).toBe(false);
  });

  it('getListSubscription whereIn', async () => {
    await subscriptionService.insertNewSubscription(1, samplePush(1), 'a-1');
    await subscriptionService.insertNewSubscription(2, samplePush(2), 'a-2');
    await subscriptionService.insertNewSubscription(3, samplePush(3), 'a-3');

    const list = await subscriptionService.getListSubscription([1, 3]);
    expect(list.length).toBe(2);
    expect(list.map((r) => r.auth).sort()).toEqual(['a-1', 'a-3']);
  });

  it('getListSubscription trả [] khi sale_id rỗng', async () => {
    expect(await subscriptionService.getListSubscription([])).toEqual([]);
  });

  it('deleteSubscriptionByEnpoint xoá row', async () => {
    await subscriptionService.insertNewSubscription(1, samplePush(1), 'a-1');
    const res = await subscriptionService.deleteSubscriptionByEnpoint('a-1');
    expect(res.auth).toBe('a-1');

    const rows = await knexPg('subscriptions');
    expect(rows.length).toBe(0);
  });

  it('deleteSubscriptionByEnpoint trả false khi không tìm thấy', async () => {
    expect(await subscriptionService.deleteSubscriptionByEnpoint('nope')).toBe(false);
  });
});
