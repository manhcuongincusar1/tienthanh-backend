// 6 rows. No FK. Unique on `code`, may pre-exist từ init.
const run = require('./lib/runScript');
const db = require('./lib/db');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  await idMap.warmup('real_estate_status');
  const rows = await db.legacy()('real_estate_status').select('*');

  let inserted = 0, merged = 0, skipped = 0;
  for (const r of rows) {
    if (await idMap.get('real_estate_status', r.id)) { skipped++; continue; }

    const existing = r.code
      ? await db.target()('real_estate_status').where({code: r.code}).first()
      : null;

    let newId;
    if (existing) {
      await db.target()('real_estate_status').where({id: existing.id}).update({
        title: r.title,
        status: r.status,
        is_editable_re: r.is_editable_re,
        is_default: r.is_default,
        type: r.type,
        is_allow_duplicate: r.is_allow_duplicate,
        color: r.color,
        is_show_internal: r.is_show_internal,
        legacy_uuid: r.id,
      });
      newId = existing.id;
      merged++;
    } else {
      const ret = await db.target()('real_estate_status')
        .insert({
          code: r.code,
          title: r.title,
          status: r.status,
          is_editable_re: r.is_editable_re,
          is_default: r.is_default,
          type: r.type,
          is_allow_duplicate: r.is_allow_duplicate,
          color: r.color,
          is_show_internal: r.is_show_internal,
          created_at: r.created_at,
          modification_at: r.modification_at,
          legacy_uuid: r.id,
        })
        .returning(['id']);
      newId = ret[0].id;
      inserted++;
    }
    await idMap.put('real_estate_status', r.id, Number(newId));
  }
  return {inserted, merged, skipped, total: rows.length};
});
