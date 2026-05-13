// Helper xử batch transform UUID→INT cho table có single UUID PK + legacy_uuid.
//
// Idempotent: bỏ qua row đã có trong id_map.
// Transaction per batch: rollback batch nếu fail.
// Orphan FK: mapRow trả về null → skip row.

const db = require('./db');
const idMap = require('./idMap');

exports.transform = async function transform({
  legacyTable,
  targetTable,
  mapRow,                  // async (legacyRow) => targetRow | null. legacy_uuid sẽ tự gán.
  batchSize = 500,
  orderBy = null,          // mặc định = idColumn (stable cho pagination)
  idColumn = 'id',         // legacy UUID PK column
  idMapTable = null,       // mặc định = targetTable
}) {
  if (!orderBy) orderBy = idColumn;
  const mapKey = idMapTable || targetTable;
  await idMap.warmup(mapKey);

  let offset = 0;
  let inserted = 0;
  let skipped = 0;
  let orphans = 0;

  while (true) {
    let q = db.legacy()(legacyTable).select('*').limit(batchSize).offset(offset);
    if (orderBy) q = q.orderBy(orderBy);
    const rows = await q;
    if (rows.length === 0) break;

    const uuids = rows.map((r) => r[idColumn]);
    const existing = await idMap.getMany(mapKey, uuids);

    const toInsert = [];
    for (const r of rows) {
      if (existing[r[idColumn]] != null) {
        skipped++;
        continue;
      }
      const mapped = await mapRow(r);
      if (mapped == null) {
        orphans++;
        continue;
      }
      toInsert.push({...mapped, legacy_uuid: r[idColumn]});
    }

    if (toInsert.length > 0) {
      await db.target().transaction(async (trx) => {
        const ret = await trx(targetTable)
          .insert(toInsert)
          .returning(['id', 'legacy_uuid']);
        const pairs = ret.map((x) => [x.legacy_uuid, Number(x.id)]);
        await idMap.putMany(mapKey, pairs, trx);
      });
      inserted += toInsert.length;
    }

    offset += batchSize;
  }

  console.log(`  [${targetTable}] inserted=${inserted} skipped=${skipped} orphans=${orphans}`);
  return {inserted, skipped, orphans};
};

// Helper cho junction table (không có legacy_uuid PK, không lưu id_map).
// Idempotent qua check-then-insert (NOT EXISTS), không cần UNIQUE constraint.
// Đọc toàn bộ legacy 1 lần (table <10K rows) để tránh pagination instability.
exports.junction = async function junction({
  legacyTable,
  targetTable,
  mapRow,                  // async (legacyRow) => targetRow | null
  conflictCols,            // mảng cột làm key
}) {
  const existingRows = await db.target()(targetTable).select(conflictCols);
  const keyOf = (r) => conflictCols.map((c) => r[c]).join('|');
  const existingSet = new Set(existingRows.map(keyOf));

  const rows = await db.legacy()(legacyTable).select('*');
  let inserted = 0, skipped = 0, orphans = 0;
  const toInsert = [];
  for (const r of rows) {
    const mapped = await mapRow(r);
    if (mapped == null) { orphans++; continue; }
    const k = keyOf(mapped);
    if (existingSet.has(k)) { skipped++; continue; }
    existingSet.add(k);
    toInsert.push(mapped);
  }
  if (toInsert.length > 0) {
    await db.target().batchInsert(targetTable, toInsert, 500);
    inserted = toInsert.length;
  }
  console.log(`  [${targetTable}] inserted=${inserted} skipped=${skipped} orphans=${orphans} total_read=${rows.length}`);
  return {inserted, skipped, orphans};
};
