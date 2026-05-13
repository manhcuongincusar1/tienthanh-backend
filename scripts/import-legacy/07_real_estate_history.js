// 16,919 docs Mongo `real_estate_history` (audit trail) → PG `real_estate_history` (partitioned).
// FK: real_estate_id UUID → INT via id_map['real_estate'].
const run = require('./lib/runScript');
const db = require('./lib/db');
const idMap = require('./lib/idMap');

const FIRST_CLASS = new Set([
  'real_estate_id', 'previous_real_estate_status', 'next_real_estate_status',
  'creator_full_name', 'note_change', 'is_internal', 'category_title',
  'full_address', 'real_estate_type', 'price', 'status', 'created_at',
]);

run(__filename, async () => {
  await idMap.warmup('real_estate');
  // Track Mongo _id qua id_map['real_estate_history_mongo'] để idempotent.
  await idMap.warmup('real_estate_history_mongo');
  const mongo = await db.mongo();

  // Pre-create partitions cho mọi YYYY-MM xuất hiện trong dữ liệu legacy.
  const dateAgg = await mongo.collection('real_estate_history').aggregate([
    {$group: {
      _id: null,
      min_date: {$min: '$created_at'},
      max_date: {$max: '$created_at'},
    }},
  ]).toArray();
  if (dateAgg[0]) {
    const min = new Date(dateAgg[0].min_date);
    const max = new Date(dateAgg[0].max_date);
    const monthsCreated = [];
    let d = new Date(min.getFullYear(), min.getMonth(), 1);
    const end = new Date(max.getFullYear(), max.getMonth() + 1, 1);
    while (d < end) {
      await db.target().raw('SELECT create_history_partition(?, ?)',
        [d.getFullYear(), d.getMonth() + 1]);
      monthsCreated.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
    console.log(`  pre-created ${monthsCreated.length} partitions: ${monthsCreated[0]}..${monthsCreated[monthsCreated.length - 1]}`);
  }

  const cursor = mongo.collection('real_estate_history').find({});

  let inserted = 0, skipped = 0, orphans = 0;
  let batch = [];      // {row, mongoId}
  const FLUSH = 500;

  const flush = async () => {
    if (batch.length === 0) return;
    await db.target().transaction(async (trx) => {
      const ret = await trx('real_estate_history')
        .insert(batch.map((b) => b.row))
        .returning(['id']);
      const pairs = batch.map((b, i) => [b.mongoId, Number(ret[i].id)]);
      await idMap.putMany('real_estate_history_mongo', pairs, trx);
    });
    inserted += batch.length;
    batch = [];
  };

  while (await cursor.hasNext()) {
    const d = await cursor.next();
    const mongoId = d._id ? d._id.toString() : null;
    if (mongoId && (await idMap.get('real_estate_history_mongo', mongoId))) {
      skipped++;
      continue;
    }
    if (!d.real_estate_id) { orphans++; continue; }
    const re_id = await idMap.get('real_estate', d.real_estate_id);
    if (!re_id) { orphans++; continue; }

    const row = {real_estate_id: re_id};
    const metadata = {};
    for (const [k, v] of Object.entries(d)) {
      if (k === '_id' || k === 'real_estate_id') continue;
      if (FIRST_CLASS.has(k)) row[k] = v;
      else metadata[k] = v;
    }
    row.metadata = Object.keys(metadata).length > 0 ? metadata : {};
    if (row.created_at && typeof row.created_at === 'string') {
      row.created_at = new Date(row.created_at);
    }

    batch.push({row, mongoId});
    if (batch.length >= FLUSH) await flush();
  }
  await flush();

  return {inserted, skipped, orphans};
});
