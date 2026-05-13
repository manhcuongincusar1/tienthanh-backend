// 1 doc Mongo `settings` → PG `settings` (key='setting', value JSONB).
const run = require('./lib/runScript');
const db = require('./lib/db');

const SETTING_KEY = 'setting';

run(__filename, async () => {
  const mongo = await db.mongo();
  const doc = await mongo.collection('settings').findOne({key: SETTING_KEY});
  if (!doc) return {skipped: true};

  const {_id, key, ...rest} = doc;
  await db.target()('settings')
    .insert({key: SETTING_KEY, value: rest, updated_at: db.target().fn.now()})
    .onConflict('key')
    .merge({value: rest, updated_at: db.target().fn.now()});

  return {keys: Object.keys(rest).length};
});
