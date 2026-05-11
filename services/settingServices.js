const BaseService = require('./baseService');
const _ = require('lodash');
const knexPg = require('../db/connectKnex');
const Constants = require('../common/constants');

const SETTING_KEY = 'setting';

class SettingService extends BaseService {
  /**
   * Atomic insert: nếu đã tồn tại key='setting' → trả về false (giữ behavior cũ).
   * Dùng onConflict.ignore.returning('*') — nếu conflict, returning trả [].
   */
  insertSetting = async (data) => {
    const rows = await knexPg('settings')
      .insert({
        key: SETTING_KEY,
        value: data,
        updated_at: knexPg.fn.now(),
      })
      .onConflict('key')
      .ignore()
      .returning('*');
    return rows[0] || false;
  };

  /**
   * Upsert + JSONB shallow merge (settings.value || EXCLUDED.value).
   * 1 query atomic, không race; trả về row sau update.
   */
  updateSetting = async (data) => {
    const rows = await knexPg('settings')
      .insert({
        key: SETTING_KEY,
        value: data,
        updated_at: knexPg.fn.now(),
      })
      .onConflict('key')
      .merge({
        value: knexPg.raw('settings.value || EXCLUDED.value'),
        updated_at: knexPg.fn.now(),
      })
      .returning('*');
    return rows[0] || false;
  };

  getSetting = async (key) => {
    const row = await knexPg('settings').where('key', SETTING_KEY).first();
    if (!row) {
      return false;
    }
    // Backward-compat: shape cũ `{key, ...rest}` (Mongo trả flat doc).
    const flat = {key: row.key, ...(row.value || {})};
    if (key) {
      return flat[key];
    }
    return flat;
  };
}

module.exports = new SettingService();
