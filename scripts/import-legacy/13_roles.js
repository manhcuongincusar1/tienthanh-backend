// 3 rows. No FK deps. Manual upsert: nếu role đã tồn tại (vd super_admin từ dev seed),
// update legacy_uuid + map id, KHÔNG tạo bản ghi mới.
const run = require('./lib/runScript');
const db = require('./lib/db');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  await idMap.warmup('roles');
  const rows = await db.legacy()('roles').select('*');

  let inserted = 0, merged = 0, skipped = 0;
  for (const r of rows) {
    if (await idMap.get('roles', r.id)) {
      skipped++;
      continue;
    }
    // Check if role with same `role` key exists
    const existing = await db.target()('roles').where({role: r.role}).first();
    let newId;
    if (existing) {
      await db.target()('roles').where({id: existing.id}).update({
        title: r.title,
        type: r.type,
        status: r.status,
        legacy_uuid: r.id,
      });
      newId = existing.id;
      merged++;
    } else {
      const ret = await db.target()('roles')
        .insert({
          title: r.title,
          role: r.role,
          type: r.type,
          status: r.status,
          created_at: r.created_at,
          modification_at: r.modification_at,
          legacy_uuid: r.id,
        })
        .returning(['id']);
      newId = ret[0].id;
      inserted++;
    }
    await idMap.put('roles', r.id, Number(newId));
  }
  return {inserted, merged, skipped, total: rows.length};
});
