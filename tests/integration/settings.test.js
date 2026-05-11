/**
 * Sample integration test cho bảng `settings` PG.
 * Pre-req: PG dev đang chạy, DB `tita_test` tồn tại (xem .env.test).
 * Pattern này dùng làm tham chiếu cho tests S1-S4 (DECISIONS F3).
 */
const knexPg = require('../../db/connectKnex');

describe('settings table (PG)', () => {
  beforeAll(async () => {
    await knexPg.schema.dropTableIfExists('settings');
    await knexPg.schema.createTable('settings', (t) => {
      t.text('key').primary();
      t.jsonb('value').notNullable().defaultTo('{}');
      t.timestamp('updated_at', { useTz: true })
        .notNullable()
        .defaultTo(knexPg.fn.now());
    });
  });

  afterAll(async () => {
    await knexPg.schema.dropTableIfExists('settings');
  });

  it('insert + read JSONB value', async () => {
    await knexPg('settings').insert({
      key: 'setting',
      value: { siteName: 'TienThanh', maxUploadMB: 25 },
    });
    const row = await knexPg('settings').where('key', 'setting').first();
    expect(row.value.siteName).toBe('TienThanh');
    expect(row.value.maxUploadMB).toBe(25);
  });

  it('JSONB merge update với operator ||', async () => {
    await knexPg('settings')
      .where('key', 'setting')
      .update({
        value: knexPg.raw('value || ?::jsonb', [
          JSON.stringify({ maxUploadMB: 50 }),
        ]),
      });
    const row = await knexPg('settings').where('key', 'setting').first();
    expect(row.value.maxUploadMB).toBe(50);
    expect(row.value.siteName).toBe('TienThanh');
  });
});
