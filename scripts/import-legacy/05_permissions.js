// 2 docs Mongo `permissions` → PG `role_permissions`.
// role_id UUID (Mongo doc.role_id) → INT via id_map['roles'].
const run = require('./lib/runScript');
const db = require('./lib/db');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  await idMap.warmup('roles');
  const mongo = await db.mongo();
  const docs = await mongo.collection('permissions').find({}).toArray();

  let inserted = 0, orphans = 0;
  for (const d of docs) {
    if (!d.role_id) { orphans++; continue; }
    const role_id = await idMap.get('roles', d.role_id);
    if (!role_id) { orphans++; continue; }

    await db.target()('role_permissions')
      .insert({
        role_id,
        title: d.title || null,
        permission_data: d.permission_data || {},
        updated_at: db.target().fn.now(),
      })
      .onConflict('role_id')
      .merge({
        title: d.title || null,
        permission_data: d.permission_data || {},
        updated_at: db.target().fn.now(),
      });
    inserted++;
  }
  return {inserted, orphans, total: docs.length};
});
