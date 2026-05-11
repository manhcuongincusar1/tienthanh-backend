const knexPg = require('../../db/connectKnex');
const settingService = require('../../services/settingServices');

describe('SettingService (PG-backed)', () => {
  beforeAll(async () => {
    await knexPg.schema.dropTableIfExists('settings');
    await knexPg.schema.createTable('settings', (t) => {
      t.text('key').primary();
      t.jsonb('value').notNullable().defaultTo('{}');
      t.timestamp('updated_at', {useTz: true})
        .notNullable()
        .defaultTo(knexPg.fn.now());
    });
  });

  afterAll(async () => {
    await knexPg.schema.dropTableIfExists('settings');
  });

  beforeEach(async () => {
    await knexPg('settings').del();
  });

  it('insertSetting tạo row mới', async () => {
    const res = await settingService.insertSetting({siteName: 'TienThanh'});
    expect(res).toBeTruthy();
    expect(res.key).toBe('setting');

    const row = await knexPg('settings').where('key', 'setting').first();
    expect(row.value.siteName).toBe('TienThanh');
  });

  it('insertSetting trả false nếu đã tồn tại', async () => {
    await settingService.insertSetting({siteName: 'A'});
    const res = await settingService.insertSetting({siteName: 'B'});
    expect(res).toBe(false);
  });

  it('updateSetting merge JSONB (giữ key cũ, override key mới)', async () => {
    await settingService.insertSetting({siteName: 'A', maxUploadMB: 25});
    const updated = await settingService.updateSetting({maxUploadMB: 50});
    expect(updated.value.siteName).toBe('A');
    expect(updated.value.maxUploadMB).toBe(50);
  });

  it('updateSetting tạo mới nếu chưa có (upsert)', async () => {
    const row = await settingService.updateSetting({siteName: 'X'});
    expect(row.value.siteName).toBe('X');
  });

  it('getSetting() trả flat shape (backward-compat)', async () => {
    await settingService.insertSetting({siteName: 'A', maxUploadMB: 25});
    const res = await settingService.getSetting();
    expect(res).toEqual({key: 'setting', siteName: 'A', maxUploadMB: 25});
  });

  it('getSetting(key) trả value của key', async () => {
    await settingService.insertSetting({siteName: 'A', maxUploadMB: 25});
    expect(await settingService.getSetting('siteName')).toBe('A');
    expect(await settingService.getSetting('maxUploadMB')).toBe(25);
  });

  it('getSetting() trả false khi chưa có row', async () => {
    expect(await settingService.getSetting()).toBe(false);
  });
});
