// id_map helper — UUID legacy → INT mới, persisted ở bảng `id_map`.
//
// Pattern:
//   const idMap = require('./lib/idMap');
//   await idMap.put('users', oldUuid, newId);
//   const newId = await idMap.get('users', oldUuid);          // single
//   const dict = await idMap.getMany('users', [u1, u2]);       // batch
//   await idMap.warmup('users');                                // load cache cho table
//
// Cache in-memory per table cho speed (re-fetch khi cache miss).

const db = require('./db');

const cache = new Map(); // key: `${table}:${uuid}` → newId

const cacheKey = (table, uuid) => `${table}:${uuid}`;

exports.put = async (table, legacyUuid, newId, trx) => {
  if (!legacyUuid || newId == null) return;
  const q = (trx || db.target())('id_map')
    .insert({table_name: table, legacy_uuid: legacyUuid, new_id: newId})
    .onConflict(['table_name', 'legacy_uuid'])
    .merge({new_id: newId});
  await q;
  cache.set(cacheKey(table, legacyUuid), newId);
};

exports.putMany = async (table, pairs, trx) => {
  if (!pairs || pairs.length === 0) return;
  const rows = pairs
    .filter(([uuid, id]) => uuid && id != null)
    .map(([uuid, id]) => ({table_name: table, legacy_uuid: uuid, new_id: id}));
  if (rows.length === 0) return;
  await (trx || db.target())('id_map')
    .insert(rows)
    .onConflict(['table_name', 'legacy_uuid'])
    .merge({new_id: db.target().raw('EXCLUDED.new_id')});
  rows.forEach((r) => cache.set(cacheKey(table, r.legacy_uuid), r.new_id));
};

exports.get = async (table, legacyUuid) => {
  if (!legacyUuid) return null;
  const k = cacheKey(table, legacyUuid);
  if (cache.has(k)) return cache.get(k);
  const row = await db.target()('id_map')
    .select('new_id')
    .where({table_name: table, legacy_uuid: legacyUuid})
    .first();
  const newId = row ? Number(row.new_id) : null;
  if (newId != null) cache.set(k, newId);
  return newId;
};

exports.getMany = async (table, uuids) => {
  const result = {};
  const missing = [];
  for (const u of uuids) {
    if (!u) continue;
    const k = cacheKey(table, u);
    if (cache.has(k)) result[u] = cache.get(k);
    else missing.push(u);
  }
  if (missing.length > 0) {
    const rows = await db.target()('id_map')
      .select('legacy_uuid', 'new_id')
      .where({table_name: table})
      .whereIn('legacy_uuid', missing);
    rows.forEach((r) => {
      const id = Number(r.new_id);
      result[r.legacy_uuid] = id;
      cache.set(cacheKey(table, r.legacy_uuid), id);
    });
  }
  return result;
};

exports.warmup = async (table) => {
  const rows = await db.target()('id_map')
    .select('legacy_uuid', 'new_id')
    .where({table_name: table});
  rows.forEach((r) => cache.set(cacheKey(table, r.legacy_uuid), Number(r.new_id)));
  return rows.length;
};

exports.size = () => cache.size;
exports.clear = () => cache.clear();
