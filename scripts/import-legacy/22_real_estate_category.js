// 12 rows. No FK. Unique on `code`.
const run = require('./lib/runScript');
const db = require('./lib/db');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  await idMap.warmup('real_estate_category');
  const rows = await db.legacy()('real_estate_category').select('*');

  let inserted = 0, merged = 0, skipped = 0;
  for (const r of rows) {
    if (await idMap.get('real_estate_category', r.id)) { skipped++; continue; }

    const existing = r.code
      ? await db.target()('real_estate_category').where({code: r.code}).first()
      : null;

    let newId;
    if (existing) {
      await db.target()('real_estate_category').where({id: existing.id}).update({
        title: r.title,
        status: r.status,
        legacy_uuid: r.id,
      });
      newId = existing.id;
      merged++;
    } else {
      const ret = await db.target()('real_estate_category')
        .insert({
          code: r.code,
          title: r.title,
          status: r.status,
          created_at: r.created_at,
          modification_at: r.modification_at,
          legacy_uuid: r.id,
        })
        .returning(['id']);
      newId = ret[0].id;
      inserted++;
    }
    await idMap.put('real_estate_category', r.id, Number(newId));
  }
  return {inserted, merged, skipped, total: rows.length};
});
