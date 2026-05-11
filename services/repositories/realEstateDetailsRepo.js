/**
 * PG repository cho bảng `real_estate_details`.
 * Thay thế các call `mongodbConnect.getDb().collection('real_estate').{op}`
 * trong realEstateService.js.
 *
 * Schema (DECISIONS B1): 11 cột "thật" + metadata JSONB.
 * Cột thật: area, recognized_area, horizontal, long, bedroom, wc, book_status,
 *           structure, direction, note, status.
 * Bất kỳ field nào ngoài 11 cột này + real_estate_id → đẩy vào metadata.
 */
const knexPg = require('../../db/connectKnex');
const _ = require('lodash');

const KNOWN_COLUMNS = [
  'area',
  'recognized_area',
  'horizontal',
  'long',
  'bedroom',
  'wc',
  'book_status',
  'structure',
  'direction',
  'note',
  'status',
];

/**
 * Tách payload thành (knownFields, metadata).
 */
function splitPayload(data) {
  const known = _.pick(data, KNOWN_COLUMNS);
  const metadata = _.omit(data, [...KNOWN_COLUMNS, 'real_estate_id', '_id']);
  return {known, metadata};
}

/**
 * Convert PG row → shape backward-compat (flat object như Mongo doc).
 * Spread cột thật + metadata vào 1 object phẳng.
 */
function rowToDoc(row) {
  if (!row) return null;
  const {real_estate_id, metadata, ...rest} = row;
  return {
    real_estate_id,
    ...rest,
    ...(metadata || {}),
  };
}

/**
 * findOne({real_estate_id}) tương đương Mongo.
 */
async function findByRealEstateId(realEstateId, trx) {
  const q = (trx || knexPg)('real_estate_details').where(
    'real_estate_id',
    realEstateId,
  );
  const row = await q.first();
  return rowToDoc(row);
}

/**
 * insertOne tương đương Mongo. Trả về real_estate_id (analog với insertedId).
 * Idempotent qua onConflict.merge (BĐS có thể có detail rồi từ migrate cũ).
 */
async function insertDetail(data, trx) {
  const {real_estate_id} = data;
  const {known, metadata} = splitPayload(data);
  const [row] = await (trx || knexPg)('real_estate_details')
    .insert({
      real_estate_id,
      ...known,
      metadata,
    })
    .onConflict('real_estate_id')
    .merge({
      ...known,
      metadata: knexPg.raw('real_estate_details.metadata || EXCLUDED.metadata'),
    })
    .returning('real_estate_id');
  return row?.real_estate_id || null;
}

/**
 * updateOne({real_estate_id}, {$set: data}) tương đương Mongo.
 */
async function updateByRealEstateId(realEstateId, data, trx) {
  const {known, metadata} = splitPayload(data);
  const patch = {...known};
  if (!_.isEmpty(metadata)) {
    patch.metadata = knexPg.raw('metadata || ?::jsonb', [
      JSON.stringify(metadata),
    ]);
  }
  if (_.isEmpty(patch)) {
    return 0;
  }
  return (trx || knexPg)('real_estate_details')
    .where('real_estate_id', realEstateId)
    .update(patch);
}

/**
 * deleteOne({real_estate_id}) — không cần khi BĐS chính bị xoá vì FK CASCADE.
 * Vẫn expose cho callsite cũ; sau cutover có thể bỏ.
 */
async function deleteByRealEstateId(realEstateId, trx) {
  return (trx || knexPg)('real_estate_details')
    .where('real_estate_id', realEstateId)
    .del();
}

/**
 * find().toArray() với điều kiện (vd `location IS NOT NULL`).
 * Hỗ trợ pagination cho backupLocation flow.
 */
async function findManyWithLocation({skip = 0, limit = 1000} = {}, trx) {
  const rows = await (trx || knexPg)('real_estate_details')
    .whereRaw("(metadata->>'location') IS NOT NULL")
    .orderBy('real_estate_id', 'asc')
    .offset(skip)
    .limit(limit)
    .select('real_estate_id', 'metadata');
  return rows.map((r) => ({
    real_estate_id: r.real_estate_id,
    location: r.metadata?.location,
  }));
}

module.exports = {
  KNOWN_COLUMNS,
  findByRealEstateId,
  insertDetail,
  updateByRealEstateId,
  deleteByRealEstateId,
  findManyWithLocation,
  // Helpers cho test
  _rowToDoc: rowToDoc,
  _splitPayload: splitPayload,
};
