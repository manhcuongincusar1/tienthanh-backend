const BaseService = require('./baseService');
const _ = require('lodash');
const knexPg = require('../db/connectKnex');
const Constants = require('../common/constants');
const redis = require('../db/redis');

const SETTING_KEY = 'setting';
const CACHE_KEY = `setting:${SETTING_KEY}`;

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
    if (rows[0]) await redis.del(CACHE_KEY);
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
    if (rows[0]) await redis.del(CACHE_KEY);
    return rows[0] || false;
  };

  // Cache flat shape 5 phút (DECISIONS C5). Invalidate explicit ở insert/update.
  getSetting = async (key) => {
    const flat = await redis.wrap(CACHE_KEY, redis.TTL.SETTING, async () => {
      const row = await knexPg('settings').where('key', SETTING_KEY).first();
      if (!row) return false;
      return {key: row.key, ...(row.value || {})};
    });

    if (!flat) return false;
    if (key) return flat[key];
    return flat;
  };
}

module.exports = new SettingService();
