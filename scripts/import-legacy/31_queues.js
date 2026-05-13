// 5 queue tables.
//  mail_queue (241): UUID id, no FK
//  import_queue (68): UUID id, FK user_id/branch_id
//  export_queue (55): UUID id, FK user_id/branch_id
//  notification_queue (6878): UUID id, FK real_estate_id
//  export_customer_queue (5): INT id (target), FK user_id/branch_id
const run = require('./lib/runScript');
const db = require('./lib/db');
const idMap = require('./lib/idMap');
const {transform} = require('./lib/batch');

async function copyUuidQueue(name, mapper, batch = 1000) {
  let offset = 0, inserted = 0, skipped = 0, orphans = 0;
  while (true) {
    const rows = await db.legacy()(name).select('*').limit(batch).offset(offset);
    if (rows.length === 0) break;

    const ids = rows.map((r) => r.id);
    const existing = await db.target()(name).select('id').whereIn('id', ids);
    const existingSet = new Set(existing.map((x) => x.id));

    const toInsert = [];
    for (const r of rows) {
      if (existingSet.has(r.id)) { skipped++; continue; }
      const mapped = await mapper(r);
      if (mapped == null) { orphans++; continue; }
      toInsert.push({...mapped, id: r.id});
    }

    if (toInsert.length > 0) {
      await db.target()(name)
        .insert(toInsert)
        .onConflict('id')
        .ignore();
      inserted += toInsert.length;
    }
    offset += batch;
  }
  console.log(`  [${name}] inserted=${inserted} skipped=${skipped} orphans=${orphans}`);
  return {inserted, skipped, orphans};
}

run(__filename, async () => {
  await idMap.warmup('users');
  await idMap.warmup('branches');
  await idMap.warmup('real_estate');

  const stats = {};

  stats.mail_queue = await copyUuidQueue('mail_queue', async (r) => ({
    to_mail: r.to_mail,
    subject: r.subject,
    content: r.content,
    created_date: r.created_date,
    status: r.status,
    process_status: r.process_status,
    modification_date: r.modification_date,
  }));

  stats.import_queue = await copyUuidQueue('import_queue', async (r) => {
    const user_id = r.user_id ? await idMap.get('users', r.user_id) : null;
    const branch_id = r.branch_id ? await idMap.get('branches', r.branch_id) : null;
    return {
      file_path: r.file_path,
      user_id,
      errors: r.errors,
      status: r.status,
      info: r.info,
      file_name: r.file_name,
      type: r.type,
      error_file_path: r.error_file_path,
      error_file_name: r.error_file_name,
      note: r.note,
      branch_id,
      created_at: r.created_at,
      modification_date: r.modification_date,
    };
  });

  stats.export_queue = await copyUuidQueue('export_queue', async (r) => {
    const user_id = r.user_id ? await idMap.get('users', r.user_id) : null;
    const branch_id = r.branch_id ? await idMap.get('branches', r.branch_id) : null;
    return {
      file_path: r.file_path,
      user_id,
      meta_data: r.meta_data,
      status: r.status,
      file_name: r.file_name,
      type: r.type,
      branch_id,
      file_size: r.file_size,
      created_at: r.created_at,
      modification_date: r.modification_date,
    };
  });

  stats.notification_queue = await copyUuidQueue('notification_queue', async (r) => {
    const real_estate_id = r.real_estate_id ? await idMap.get('real_estate', r.real_estate_id) : null;
    if (r.real_estate_id && !real_estate_id) return null;
    return {
      real_estate_id,
      status: r.status,
      infodata: r.infodata,
      created_at: r.created_at,
      modification_at: r.modification_at,
    };
  }, 2000);

  // export_customer_queue uses INT id + legacy_uuid (different schema)
  stats.export_customer_queue = await transform({
    legacyTable: 'export_customer_queue',
    targetTable: 'export_customer_queue',
    batchSize: 1000,
    mapRow: async (r) => {
      const user_id = r.user_id ? await idMap.get('users', r.user_id) : null;
      const branch_id = r.branch_id ? await idMap.get('branches', r.branch_id) : null;
      return {
        file_path: r.file_path,
        user_id,
        meta_data: r.meta_data,
        status: r.status,
        file_name: r.file_name,
        type: r.type,
        branch_id,
        file_size: r.file_size,
        created_at: r.created_at,
        modification_date: r.modification_date,
      };
    },
  });

  return stats;
});
