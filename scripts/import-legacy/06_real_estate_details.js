// 8,248 docs Mongo `real_estate` (detail overlay) → PG `real_estate_details`.
// real_estate_id UUID → INT via id_map['real_estate'].
//
// real_estate_details schema (S1):
//   real_estate_id BIGINT PK
//   area, recognized_area, horizontal, long: numeric
//   bedroom, wc: int
//   book_status: bool, structure: text, direction: text, note: text, status: smallint
//   metadata JSONB (remainder, incl. listPath ảnh)
const run = require('./lib/runScript');
const db = require('./lib/db');
const idMap = require('./lib/idMap');

// Fields that map vào cột chính. Rest đẩy vào metadata JSONB.
const FIRST_CLASS = new Set([
  'area', 'recognized_area', 'horizontal', 'long',
  'bedroom', 'wc', 'book_status', 'structure', 'direction', 'note', 'status',
]);

const NUMERIC_COLS = new Set(['area', 'recognized_area', 'horizontal', 'long']);
const INT_COLS = new Set(['bedroom', 'wc', 'status']);

function coerce(col, v) {
  if (v === '' || v === undefined) return null;
  if (NUMERIC_COLS.has(col)) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (INT_COLS.has(col)) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return v;
}

run(__filename, async () => {
  await idMap.warmup('real_estate');
  const mongo = await db.mongo();
  const cursor = mongo.collection('real_estate').find({});

  let inserted = 0, skipped = 0, orphans = 0;
  let batch = [];
  const FLUSH = 500;

  const flush = async () => {
    if (batch.length === 0) return;
    await db.target()('real_estate_details')
      .insert(batch)
      .onConflict('real_estate_id')
      .merge();
    inserted += batch.length;
    batch = [];
  };

  while (await cursor.hasNext()) {
    const d = await cursor.next();
    if (!d.real_estate_id) { orphans++; continue; }
    const re_id = await idMap.get('real_estate', d.real_estate_id);
    if (!re_id) { orphans++; continue; }

    const first = {};
    const metadata = {};
    for (const [k, v] of Object.entries(d)) {
      if (k === '_id' || k === 'real_estate_id') continue;
      if (FIRST_CLASS.has(k)) first[k] = coerce(k, v);
      else metadata[k] = v;
    }

    batch.push({
      real_estate_id: re_id,
      ...first,
      metadata,
    });

    if (batch.length >= FLUSH) await flush();
  }
  await flush();

  return {inserted, skipped, orphans};
});
