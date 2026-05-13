// 287 docs Mongo `subscriptions` → PG `subscriptions`.
// userId UUID → INT via id_map['users']. auth UNIQUE → onConflict skip duplicate.
const run = require('./lib/runScript');
const db = require('./lib/db');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  await idMap.warmup('users');
  const mongo = await db.mongo();
  const docs = await mongo.collection('subscriptions').find({}).toArray();

  let inserted = 0, orphans = 0, conflicts = 0;
  for (const d of docs) {
    if (!d.userId) { orphans++; continue; }
    const user_id = await idMap.get('users', d.userId);
    if (!user_id) { orphans++; continue; }

    // info can be JSON string or object
    let info = d.info;
    if (typeof info === 'string') {
      try { info = JSON.parse(info); } catch { /* keep as string in jsonb */ }
    }

    try {
      await db.target()('subscriptions')
        .insert({
          user_id,
          auth: d.auth,
          info: info || {},
        })
        .onConflict('auth')
        .ignore();
      inserted++;
    } catch (e) {
      conflicts++;
    }
  }
  return {inserted, orphans, conflicts, total: docs.length};
});
