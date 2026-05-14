// One-off backfill — sửa hậu quả của bug 23_real_estate.js:
// Column `real_estate.creator_sale_id` thực ra trỏ vào users.id (NOT sales.id) — tên column gây hiểu nhầm.
// Pipeline ban đầu lookup qua id_map['sales'] → 0/8203 match → toàn bộ NULL.
//
// Bản chất:
//   legacy.real_estate.creator_sale_id (UUID) ↔ legacy.users.id
//   → cần remap qua id_map['users'] để ra users.id INT trong target.
//
// Idempotent: chỉ update row có creator_sale_id IS NULL.
// Có thể chạy lại an toàn — sau pass đầu, NULL count = 0 → next runs noop.

const run = require('./lib/runScript');
const db = require('./lib/db');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  await idMap.warmup('real_estate');
  await idMap.warmup('users');

  const targetNullRows = await db.target()('real_estate')
    .whereNull('creator_sale_id')
    .whereNotNull('legacy_uuid')
    .select('id', 'legacy_uuid');

  if (targetNullRows.length === 0) {
    return {updated: 0, skipped: 'no rows with NULL creator_sale_id'};
  }

  const legacyUuids = targetNullRows.map((r) => r.legacy_uuid);
  const legacyRows = await db.legacy()('real_estate')
    .whereIn('id', legacyUuids)
    .select('id', 'creator_sale_id');

  const legacyByUuid = new Map();
  for (const r of legacyRows) {
    if (r.creator_sale_id) legacyByUuid.set(r.id, r.creator_sale_id);
  }

  let updated = 0;
  let userOrphan = 0;
  let noLegacyCreator = 0;
  const trx = await db.target().transaction();
  try {
    for (const t of targetNullRows) {
      const userUuid = legacyByUuid.get(t.legacy_uuid);
      if (!userUuid) {
        noLegacyCreator++;
        continue;
      }
      const newUserId = await idMap.get('users', userUuid);
      if (!newUserId) {
        userOrphan++;
        continue;
      }
      await trx('real_estate').where({id: t.id}).update({creator_sale_id: newUserId});
      updated++;
    }
    await trx.commit();
  } catch (err) {
    await trx.rollback();
    throw err;
  }

  return {target_null_rows: targetNullRows.length, updated, user_orphan: userOrphan, no_legacy_creator: noLegacyCreator};
});
