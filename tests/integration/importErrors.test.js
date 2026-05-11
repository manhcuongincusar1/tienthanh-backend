const knexPg = require('../../db/connectKnex');
const {importService} = require('../../services/importService');

describe('importService.insertErrorsMessage (PG-backed)', () => {
  beforeAll(async () => {
    await knexPg.schema.dropTableIfExists('import_errors');
    await knexPg.schema.createTable('import_errors', (t) => {
      t.bigIncrements('id').primary();
      t.bigInteger('import_id');
      t.jsonb('error_data').notNullable();
      t.timestamp('created_at', {useTz: true})
        .notNullable()
        .defaultTo(knexPg.fn.now());
    });
  });

  afterAll(async () => {
    await knexPg.schema.dropTableIfExists('import_errors');
  });

  beforeEach(async () => {
    await knexPg('import_errors').del();
  });

  it('insert lỗi với import_id', async () => {
    const res = await importService.insertErrorsMessage({
      import_id: 42,
      row: 17,
      message: 'invalid price',
    });
    expect(res.id).toBeTruthy();

    const row = await knexPg('import_errors').first();
    expect(Number(row.import_id)).toBe(42);
    expect(row.error_data.message).toBe('invalid price');
    expect(row.error_data.row).toBe(17);
  });

  it('insert lỗi không có import_id (null)', async () => {
    await importService.insertErrorsMessage({message: 'orphan error'});
    const row = await knexPg('import_errors').first();
    expect(row.import_id).toBeNull();
    expect(row.error_data.message).toBe('orphan error');
  });

  it('query bằng JSONB operator', async () => {
    await importService.insertErrorsMessage({import_id: 1, severity: 'high'});
    await importService.insertErrorsMessage({import_id: 1, severity: 'low'});

    const rows = await knexPg('import_errors')
      .whereRaw("error_data->>'severity' = ?", ['high']);
    expect(rows.length).toBe(1);
  });
});
