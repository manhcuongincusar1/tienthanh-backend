/**
 * One-shot migration: settings (Mongo → PG).
 * Idempotent: dùng onConflict('key').merge.
 *
 * Usage:
 *   NODE_ENV=production node scripts/migrate/01_settings.js
 */
const mongodbConnect = require('../../db/mongodb');
const knexPg = require('../../db/connectKnex');

const SETTING_KEY = 'setting';

(async () => {
  try {
    const db = await mongodbConnect.getDb();
    const doc = await db.collection('settings').findOne({key: SETTING_KEY});

    if (!doc) {
      console.log('[migrate:settings] no Mongo doc — skip');
      process.exit(0);
    }

    const {_id, key, ...rest} = doc;

    await knexPg('settings')
      .insert({
        key: SETTING_KEY,
        value: rest,
        updated_at: knexPg.fn.now(),
      })
      .onConflict('key')
      .merge({
        value: rest,
        updated_at: knexPg.fn.now(),
      });

    console.log('[migrate:settings] done — keys migrated:', Object.keys(rest).length);
    process.exit(0);
  } catch (err) {
    console.error('[migrate:settings] FAIL', err);
    process.exit(1);
  }
})();
