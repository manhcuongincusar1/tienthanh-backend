const knexPg = require('../../db/connectKnex');
const repo = require('../../services/repositories/realEstateDetailsRepo');

describe('realEstateDetailsRepo (PG)', () => {
  beforeAll(async () => {
    await knexPg.raw('DROP TABLE IF EXISTS real_estate_history CASCADE');
    await knexPg.raw('DROP TABLE IF EXISTS real_estate_details CASCADE');
    await knexPg.raw('DROP TABLE IF EXISTS real_estate CASCADE');
    await knexPg.schema.createTable('real_estate', (t) => {
      t.bigIncrements('id').primary();
      t.text('title');
    });
    await knexPg.schema.createTable('real_estate_details', (t) => {
      t.bigInteger('real_estate_id')
        .primary()
        .references('id')
        .inTable('real_estate')
        .onDelete('CASCADE');
      t.decimal('area');
      t.decimal('recognized_area');
      t.decimal('horizontal');
      t.decimal('long');
      t.integer('bedroom');
      t.integer('wc');
      t.boolean('book_status');
      t.text('structure');
      t.text('direction');
      t.text('note');
      t.smallint('status');
      t.jsonb('metadata').notNullable().defaultTo('{}');
    });
    await knexPg('real_estate').insert([
      {id: 1, title: 'BĐS 1'},
      {id: 2, title: 'BĐS 2'},
      {id: 3, title: 'BĐS 3'},
    ]);
  });

  afterAll(async () => {
    await knexPg.raw('DROP TABLE IF EXISTS real_estate_details CASCADE');
    await knexPg.raw('DROP TABLE IF EXISTS real_estate CASCADE');
  });

  beforeEach(async () => {
    await knexPg('real_estate_details').del();
  });

  it('insertDetail: tách known cols + metadata', async () => {
    const id = await repo.insertDetail({
      real_estate_id: 1,
      area: 80,
      bedroom: 3,
      direction: 'Đông Nam',
      // dynamic field — vào metadata
      view: 'sông',
      floor: 5,
    });
    expect(Number(id)).toBe(1);

    const row = await knexPg('real_estate_details').first();
    expect(Number(row.area)).toBe(80);
    expect(row.bedroom).toBe(3);
    expect(row.direction).toBe('Đông Nam');
    expect(row.metadata).toEqual({view: 'sông', floor: 5});
  });

  it('insertDetail idempotent (onConflict.merge)', async () => {
    await repo.insertDetail({real_estate_id: 1, area: 80, view: 'A'});
    await repo.insertDetail({real_estate_id: 1, area: 90, view: 'B', noise: 'low'});

    const rows = await knexPg('real_estate_details');
    expect(rows.length).toBe(1);
    expect(Number(rows[0].area)).toBe(90);
    // metadata merge: view bị override, noise mới được thêm
    expect(rows[0].metadata).toEqual({view: 'B', noise: 'low'});
  });

  it('findByRealEstateId trả backward-compat flat shape', async () => {
    await repo.insertDetail({
      real_estate_id: 1,
      area: 80,
      direction: 'Đông',
      view: 'sông',
    });
    const doc = await repo.findByRealEstateId(1);
    expect(Number(doc.real_estate_id)).toBe(1);
    expect(Number(doc.area)).toBe(80);
    expect(doc.direction).toBe('Đông');
    expect(doc.view).toBe('sông'); // metadata được flatten
  });

  it('findByRealEstateId trả null khi không tìm thấy', async () => {
    expect(await repo.findByRealEstateId(999)).toBeNull();
  });

  it('updateByRealEstateId update cột thật', async () => {
    await repo.insertDetail({real_estate_id: 1, area: 80});
    const n = await repo.updateByRealEstateId(1, {area: 100, bedroom: 4});
    expect(n).toBe(1);
    const doc = await repo.findByRealEstateId(1);
    expect(Number(doc.area)).toBe(100);
    expect(doc.bedroom).toBe(4);
  });

  it('updateByRealEstateId merge metadata (giữ key cũ)', async () => {
    await repo.insertDetail({
      real_estate_id: 1,
      area: 80,
      view: 'sông',
      floor: 5,
    });
    await repo.updateByRealEstateId(1, {floor: 10, noise: 'high'});
    const doc = await repo.findByRealEstateId(1);
    expect(doc.view).toBe('sông');
    expect(doc.floor).toBe(10);
    expect(doc.noise).toBe('high');
  });

  it('deleteByRealEstateId CASCADE từ real_estate', async () => {
    // Dùng id riêng để không phá shared seed (id 1-3).
    await knexPg('real_estate').insert({id: 99, title: 'temp'});
    try {
      await repo.insertDetail({real_estate_id: 99, area: 80});
      await knexPg('real_estate').where('id', 99).del();
      expect(await repo.findByRealEstateId(99)).toBeNull();
    } finally {
      // Cleanup: row real_estate đã CASCADE xoá kèm. Không cần làm gì.
    }
  });

  it('findManyWithLocation: pagination + filter', async () => {
    await repo.insertDetail({
      real_estate_id: 1,
      area: 80,
      location: '12345',
    });
    await repo.insertDetail({
      real_estate_id: 2,
      area: 90,
      location: '67890',
    });
    await repo.insertDetail({real_estate_id: 3, area: 100}); // no location

    const list = await repo.findManyWithLocation({skip: 0, limit: 10});
    expect(list.length).toBe(2);
    expect(list.map((r) => r.location).sort()).toEqual(['12345', '67890']);
  });

  it('transaction support: rollback giữ data nguyên', async () => {
    await repo.insertDetail({real_estate_id: 1, area: 80});

    await knexPg
      .transaction(async (trx) => {
        await repo.updateByRealEstateId(1, {area: 999}, trx);
        throw new Error('rollback');
      })
      .catch(() => {});

    const doc = await repo.findByRealEstateId(1);
    expect(Number(doc.area)).toBe(80); // rollback giữ giá trị cũ
  });
});
