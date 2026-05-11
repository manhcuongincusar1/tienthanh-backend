const knexPg = require('../../db/connectKnex');
const repo = require('../../services/repositories/realEstateHistoryRepo');

describe('realEstateHistoryRepo (PG partitioned)', () => {
  beforeAll(async () => {
    // Setup minimal schema cần cho test
    await knexPg.raw('DROP TABLE IF EXISTS real_estate_history CASCADE');
    await knexPg.raw('DROP TABLE IF EXISTS real_estate_details CASCADE');
    await knexPg.raw('DROP TABLE IF EXISTS real_estate CASCADE');
    await knexPg.schema.createTable('real_estate', (t) => {
      t.bigIncrements('id').primary();
      t.text('title');
    });
    // Tạo bảng partitioned + 1 partition cho test range
    await knexPg.raw(`
      CREATE TABLE real_estate_history (
        id BIGSERIAL,
        real_estate_id BIGINT NOT NULL REFERENCES real_estate(id) ON DELETE CASCADE,
        previous_real_estate_status JSONB,
        next_real_estate_status JSONB,
        creator_full_name TEXT,
        note_change TEXT,
        is_internal BOOLEAN DEFAULT false,
        category_title TEXT,
        full_address TEXT,
        real_estate_type SMALLINT,
        price NUMERIC,
        status SMALLINT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (id, created_at)
      ) PARTITION BY RANGE (created_at);
    `);
    await knexPg.raw(`
      CREATE TABLE real_estate_history_2026_05 PARTITION OF real_estate_history
      FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
    `);
    await knexPg.raw(`
      CREATE TABLE real_estate_history_2026_06 PARTITION OF real_estate_history
      FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
    `);
    await knexPg.raw(`
      CREATE TABLE real_estate_history_2026_07 PARTITION OF real_estate_history
      FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
    `);

    await knexPg('real_estate').insert([
      {id: 1, title: 'BĐS 1'},
      {id: 2, title: 'BĐS 2'},
    ]);
  });

  afterAll(async () => {
    await knexPg.raw('DROP TABLE IF EXISTS real_estate_history CASCADE');
    await knexPg.raw('DROP TABLE IF EXISTS real_estate CASCADE');
  });

  beforeEach(async () => {
    await knexPg('real_estate_history').del();
  });

  it('insertHistory: ghi đủ field + return id', async () => {
    const id = await repo.insertHistory({
      real_estate_id: 1,
      created_at: '2026-05-15T10:00:00Z',
      previous_real_estate_status: null,
      next_real_estate_status: {id: 5, title: 'Bán', type: 1},
      creator_full_name: 'Cường',
      note_change: 'tạo mới',
      is_internal: false,
      category_title: 'Nhà phố',
      full_address: 'Q1 HCM',
      real_estate_type: 1,
      price: 5000000000,
      status: 1,
      branch_id: 7, // → metadata
    });
    expect(Number(id)).toBeGreaterThan(0);

    const row = await knexPg('real_estate_history').first();
    expect(Number(row.real_estate_id)).toBe(1);
    expect(row.next_real_estate_status).toEqual({id: 5, title: 'Bán', type: 1});
    expect(row.metadata).toEqual({branch_id: 7});
  });

  it('insertHistory chuyển ISO string created_at → Date đúng partition', async () => {
    const id = await repo.insertHistory({
      real_estate_id: 1,
      created_at: '2026-06-10T08:00:00Z',
      status: 1,
    });
    const row = await knexPg('real_estate_history_2026_06').first();
    expect(Number(row.id)).toBe(Number(id));
  });

  it('batchInsertHistory ghi nhiều rows', async () => {
    const rows = Array.from({length: 5}, (_, i) => ({
      real_estate_id: 1,
      created_at: `2026-05-${10 + i}T00:00:00Z`,
      status: 1,
      idx: i, // → metadata
    }));
    await repo.batchInsertHistory(rows);

    const count = await knexPg('real_estate_history').count('* as c').first();
    expect(Number(count.c)).toBe(5);
  });

  it('findByRealEstateId sort DESC, filter status', async () => {
    await repo.insertHistory({
      real_estate_id: 1,
      created_at: '2026-05-01',
      status: 1,
      note_change: 'first',
    });
    await repo.insertHistory({
      real_estate_id: 1,
      created_at: '2026-05-15',
      status: 1,
      note_change: 'second',
    });
    await repo.insertHistory({
      real_estate_id: 1,
      created_at: '2026-05-20',
      status: 0, // inactive — filtered out
      note_change: 'inactive',
    });

    const rows = await repo.findByRealEstateId(1, {status: 1});
    expect(rows.length).toBe(2);
    expect(rows[0].note_change).toBe('second'); // DESC
    expect(rows[1].note_change).toBe('first');
  });

  it('deleteOneById + deleteManyByIds', async () => {
    const id1 = await repo.insertHistory({
      real_estate_id: 1,
      created_at: '2026-05-15',
      status: 1,
    });
    const id2 = await repo.insertHistory({
      real_estate_id: 1,
      created_at: '2026-05-16',
      status: 1,
    });
    const id3 = await repo.insertHistory({
      real_estate_id: 1,
      created_at: '2026-05-17',
      status: 1,
    });
    expect(await repo.deleteOneById(id1)).toBe(1);
    expect(await repo.deleteManyByIds([id2, id3])).toBe(2);
    const remaining = await knexPg('real_estate_history').count('* as c').first();
    expect(Number(remaining.c)).toBe(0);
  });

  it('updateById: $set tương đương', async () => {
    const id = await repo.insertHistory({
      real_estate_id: 1,
      created_at: '2026-05-15',
      status: 1,
    });
    await repo.updateById(id, {
      next_real_estate_status: {id: 9, title: 'Đã bán', type: 1},
      note_change: 'Đổi trạng thái',
      custom_field: 'X', // metadata
    });
    const row = await knexPg('real_estate_history').first();
    expect(row.next_real_estate_status.id).toBe(9);
    expect(row.note_change).toBe('Đổi trạng thái');
    expect(row.metadata.custom_field).toBe('X');
  });

  it('findRowsNeedingStatusFix: prev NOT NULL, next NULL', async () => {
    await repo.insertHistory({
      real_estate_id: 1,
      created_at: '2026-05-01',
      previous_real_estate_status: {id: 1, title: 'Bán'},
      next_real_estate_status: null,
      status: 1,
    });
    await repo.insertHistory({
      real_estate_id: 1,
      created_at: '2026-05-02',
      previous_real_estate_status: {id: 1},
      next_real_estate_status: {id: 2},
      status: 1,
    });
    const rows = await repo.findRowsNeedingStatusFix();
    expect(rows.length).toBe(1);
    expect(rows[0].previous_real_estate_status.title).toBe('Bán');
  });

  describe('aggregateHistoryByRealEstateId (thay aggregate :1291)', () => {
    it('match + sort DESC, drop _id & real_estate_id từ output', async () => {
      await repo.insertHistory({
        real_estate_id: 1,
        created_at: '2026-05-10',
        creator_full_name: 'A',
        status: 1,
      });
      await repo.insertHistory({
        real_estate_id: 1,
        created_at: '2026-05-20',
        creator_full_name: 'B',
        status: 1,
      });
      await repo.insertHistory({
        real_estate_id: 2,
        created_at: '2026-05-15',
        creator_full_name: 'C',
        status: 1,
      });
      const out = await repo.aggregateHistoryByRealEstateId(1);
      expect(out.length).toBe(2);
      expect(out[0].creator_full_name).toBe('B'); // DESC
      expect(out[0].real_estate_id).toBeUndefined(); // dropped
    });
  });

  describe('reportChartData (thay aggregate :2042 + :2082)', () => {
    beforeEach(async () => {
      // Seed 4 events tháng 5 + 2 events tháng 6
      await repo.batchInsertHistory([
        {
          real_estate_id: 1,
          created_at: '2026-05-05T03:00:00Z',
          next_real_estate_status: {id: 5, title: 'Bán'},
          status: 1,
          is_internal: false,
          real_estate_type: 1,
          price: 1000,
        },
        {
          real_estate_id: 1,
          created_at: '2026-05-15T03:00:00Z',
          next_real_estate_status: {id: 5, title: 'Bán'},
          status: 1,
          is_internal: false,
          real_estate_type: 1,
          price: 2000,
        },
        {
          real_estate_id: 1,
          created_at: '2026-05-20T03:00:00Z',
          next_real_estate_status: {id: 9, title: 'Đã bán'},
          status: 1,
          is_internal: false,
          real_estate_type: 1,
          price: 3000,
        },
        {
          real_estate_id: 2,
          created_at: '2026-05-25T03:00:00Z',
          next_real_estate_status: {id: 5, title: 'Bán'},
          status: 1,
          is_internal: true, // internal event
          real_estate_type: 1,
          price: 4000,
        },
        {
          real_estate_id: 1,
          created_at: '2026-06-10T03:00:00Z',
          next_real_estate_status: {id: 5, title: 'Bán'},
          status: 1,
          is_internal: false,
          real_estate_type: 1,
          price: 5000,
        },
        {
          real_estate_id: 1,
          created_at: '2026-06-15T03:00:00Z',
          next_real_estate_status: null, // không match (null next)
          status: 1,
          is_internal: false,
          real_estate_type: 1,
          price: 6000,
        },
      ]);
    });

    it('group by year/month/status_id, count đúng', async () => {
      const r = await repo.reportChartData({real_estate_type: 1});
      // Filter ra rows có next NOT NULL: 5 rows
      // Main: 2026-05 [id5 x3, id9 x1], 2026-06 [id5 x1]
      const sorted = r
        .filter((x) => x.id !== undefined)
        .sort((a, b) => a.month.localeCompare(b.month) || a.id - b.id);
      expect(sorted).toEqual([
        {month: '05-2026', value: 3, id: 5},
        {month: '05-2026', value: 1, id: 9},
        {month: '06-2026', value: 1, id: 5},
      ]);
      // Internal: 2026-05 [1 row]
      const internal = r.filter((x) => x.title === 'Nội bộ Bán/Thuê');
      expect(internal).toEqual([{month: '05-2026', value: 1, title: 'Nội bộ Bán/Thuê'}]);
    });

    it('lọc theo price range', async () => {
      const r = await repo.reportChartData({price_from: 2500, price_to: 4500});
      const main = r.filter((x) => x.id !== undefined);
      // price 3000 (id 9, 05), 4000 (id 5, 05 internal). is_internal undefined → cả internal lọt
      expect(main.length).toBeGreaterThan(0);
      const tot = main.reduce((a, b) => a + b.value, 0);
      expect(tot).toBe(2);
    });
  });

  describe('reportList (thay aggregate :2182 — $facet → CTE)', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 10; i++) {
        await repo.insertHistory({
          real_estate_id: 1,
          created_at: `2026-05-${10 + i}T03:00:00Z`,
          next_real_estate_status: {id: 5},
          status: 1,
          real_estate_type: 1,
          price: i * 1000,
          category_title: `Cat ${i}`,
          full_address: `Addr ${i}`,
          is_internal: i % 2 === 0,
        });
      }
    });

    it('default sort created_at DESC, pagination', async () => {
      const r = await repo.reportList({}, {offset: 0, limit: 3});
      expect(r.count).toBe(10);
      expect(r.data_list.length).toBe(3);
      expect(r.data_list[0].category_title).toBe('Cat 10');
      expect(r.data_list[2].category_title).toBe('Cat 8');
    });

    it('custom sort price ascend', async () => {
      const r = await repo.reportList(
        {},
        {sorter: {price: 'ascend'}, offset: 0, limit: 2},
      );
      expect(r.data_list.length).toBe(2);
      expect(Number(r.data_list[0].price)).toBe(1000);
      expect(Number(r.data_list[1].price)).toBe(2000);
    });

    it('filter is_internal', async () => {
      const r = await repo.reportList({is_internal: true}, {offset: 0, limit: 99});
      expect(r.count).toBe(5);
      expect(r.data_list.every((d) => d.is_internal === true)).toBe(true);
    });
  });
});
