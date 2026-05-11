/**
 * PG repository cho bảng `real_estate_history` (partitioned by month).
 * Thay thế `mongodbConnect.getDb().collection('real_estate_history').{op}`
 * trong realEstateService.js.
 *
 * Schema:
 *  - id BIGSERIAL (PK composite với created_at để partition)
 *  - real_estate_id, created_at — index chính
 *  - previous_real_estate_status JSONB, next_real_estate_status JSONB
 *  - creator_full_name, note_change, is_internal, category_title, full_address
 *  - real_estate_type, price, status
 *  - metadata JSONB cho field động
 */
const knexPg = require('../../db/connectKnex');
const _ = require('lodash');
const Constants = require('../../common/constants');

const KNOWN_COLUMNS = [
  'real_estate_id',
  'previous_real_estate_status',
  'next_real_estate_status',
  'creator_full_name',
  'note_change',
  'is_internal',
  'category_title',
  'full_address',
  'real_estate_type',
  'price',
  'status',
  'created_at',
];

/**
 * Tách payload thành (known, metadata). created_at được normalize → Date.
 */
function splitPayload(data) {
  const known = _.pick(data, KNOWN_COLUMNS);
  if (known.created_at && typeof known.created_at === 'string') {
    known.created_at = new Date(known.created_at);
  }
  const metadata = _.omit(data, [...KNOWN_COLUMNS, 'id', '_id']);
  return {known, metadata};
}

/**
 * Insert 1 history row, return id.
 */
async function insertHistory(historyData, trx) {
  const {known, metadata} = splitPayload(historyData);
  const [row] = await (trx || knexPg)('real_estate_history')
    .insert({...known, metadata})
    .returning(['id']);
  return row?.id || null;
}

/**
 * BatchInsert nhiều history rows trong 1 transaction.
 */
async function batchInsertHistory(rows, trx) {
  if (!rows || !rows.length) return 0;
  const mapped = rows.map((r) => {
    const {known, metadata} = splitPayload(r);
    return {...known, metadata};
  });
  return (trx || knexPg).batchInsert('real_estate_history', mapped, 500);
}

/**
 * Delete 1 row by id.
 */
async function deleteOneById(id, trx) {
  return (trx || knexPg)('real_estate_history').where('id', id).del();
}

/**
 * Delete nhiều rows theo id list.
 */
async function deleteManyByIds(ids, trx) {
  if (!ids || !ids.length) return 0;
  return (trx || knexPg)('real_estate_history').whereIn('id', ids).del();
}

/**
 * Find by real_estate_id (filter + sort), tương đương Mongo find().toArray().
 */
async function findByRealEstateId(
  realEstateId,
  {sortDesc = true, status} = {},
  trx,
) {
  let q = (trx || knexPg)('real_estate_history').where(
    'real_estate_id',
    realEstateId,
  );
  if (status !== undefined) {
    q = q.where('status', status);
  }
  q = q.orderBy('created_at', sortDesc ? 'desc' : 'asc');
  return q.select('*');
}

/**
 * Find rows nơi previous_real_estate_status NOT NULL và next_real_estate_status NULL.
 * Pattern cho `changeStatusRealEstate` migrate job.
 */
async function findRowsNeedingStatusFix(trx) {
  return (trx || knexPg)('real_estate_history')
    .whereNotNull('previous_real_estate_status')
    .whereNull('next_real_estate_status')
    .select('*');
}

/**
 * Update 1 row by id ($set tương đương).
 */
async function updateById(id, patch, trx) {
  const {known, metadata} = splitPayload(patch);
  const update = {...known};
  if (!_.isEmpty(metadata)) {
    update.metadata = knexPg.raw('metadata || ?::jsonb', [
      JSON.stringify(metadata),
    ]);
  }
  if (_.isEmpty(update)) return 0;
  return (trx || knexPg)('real_estate_history')
    .where('id', id)
    .update(update);
}

// =============================================================
// SQL AGGREGATIONS (thay 4 Mongo pipeline trong realEstateService)
// =============================================================

/**
 * `getHistoryRealEstateStatus(id)` — line 1286 / aggregate :1291
 * Mongo: $match{real_estate_id, status} + $project{drop _id, real_estate_id} + $sort{convertedDate -1}
 */
async function aggregateHistoryByRealEstateId(realEstateId, trx) {
  const rows = await (trx || knexPg)('real_estate_history')
    .where('real_estate_id', realEstateId)
    .where('status', Constants.STATUS_ENUM.ACTIVE)
    .orderBy('created_at', 'desc')
    .select(
      'id',
      'previous_real_estate_status',
      'next_real_estate_status',
      'creator_full_name',
      'note_change',
      'is_internal',
      'category_title',
      'full_address',
      'real_estate_type',
      'price',
      'status',
      'created_at',
      'metadata',
    );
  // Drop real_estate_id, _id (như $project Mongo); spread metadata cho compat.
  return rows.map((r) => {
    const {metadata, ...rest} = r;
    return {...rest, ...(metadata || {})};
  });
}

/**
 * `getChangeStatusRealEstateReportChartData` — aggregate :2042 + :2082
 * Group by (year, month, next_real_estate_status.id) + count.
 * `baseConditions` là object có thể có: { real_estate_type, is_internal,
 *   price_from, price_to, branch_id, start_day, end_day }.
 */
async function reportChartData(baseConditions = {}, trx) {
  const k = trx || knexPg;
  const tz = 'Asia/Ho_Chi_Minh';
  let q = k('real_estate_history')
    .whereNotNull('next_real_estate_status')
    .whereRaw("(next_real_estate_status->>'id') IS NOT NULL");

  q = applyBaseConditions(q, baseConditions);

  const main = await q
    .clone()
    .select(
      k.raw(
        "EXTRACT(YEAR FROM created_at AT TIME ZONE ?)::int AS year, " +
          "EXTRACT(MONTH FROM created_at AT TIME ZONE ?)::int AS month, " +
          "(next_real_estate_status->>'id')::int AS real_estate_status_id",
        [tz, tz],
      ),
      k.raw('COUNT(*)::int AS value'),
    )
    .groupByRaw(
      "1, 2, 3",
    )
    .orderByRaw('1, 2, 3');

  let internal = [];
  if (baseConditions.is_internal === undefined || baseConditions.is_internal === true) {
    internal = await applyBaseConditions(
      k('real_estate_history')
        .whereNotNull('next_real_estate_status')
        .whereRaw("(next_real_estate_status->>'id') IS NOT NULL")
        .where('is_internal', true),
      _.omit(baseConditions, 'is_internal'),
    )
      .select(
        k.raw(
          "EXTRACT(YEAR FROM created_at AT TIME ZONE ?)::int AS year, " +
            "EXTRACT(MONTH FROM created_at AT TIME ZONE ?)::int AS month",
          [tz, tz],
        ),
        k.raw('COUNT(*)::int AS value'),
      )
      .groupByRaw('1, 2')
      .orderByRaw('1, 2');
  }

  // Format giống Mongo output: month "MM-YYYY", value, id (status_id) or title 'Nội bộ Bán/Thuê'
  const reportData = main.map((r) => ({
    month: `${r.month < 10 ? '0' + r.month : r.month}-${r.year}`,
    value: r.value,
    id: r.real_estate_status_id,
  }));
  const reportDataInternal = internal.map((r) => ({
    month: `${r.month < 10 ? '0' + r.month : r.month}-${r.year}`,
    value: r.value,
    title: 'Nội bộ Bán/Thuê',
  }));
  return [...reportData, ...reportDataInternal];
}

/**
 * `getChangeStatusRealEstateReportList` — aggregate :2182 ($facet → data + count).
 * Pagination + sort.
 */
// Whitelist sort columns — chặn user-controlled column name từ vào ORDER BY.
const ALLOWED_SORT_COLUMNS = new Set([
  'created_at',
  'price',
  'real_estate_type',
  'category_title',
  'full_address',
  'is_internal',
]);

async function reportList(baseConditions = {}, {sorter, offset = 0, limit = 50} = {}, trx) {
  const k = trx || knexPg;
  let q = k('real_estate_history')
    .whereNotNull('next_real_estate_status');
  q = applyBaseConditions(q, baseConditions);

  // sort: sorter là object {col: 'ascend'|'descend'} | undefined → default created_at DESC.
  // Whitelist column name (security best practice — không trust client input).
  let sortCol = 'created_at';
  let sortDir = 'desc';
  if (sorter && !_.isEmpty(sorter)) {
    const [k1, v1] = Object.entries(sorter)[0];
    if (ALLOWED_SORT_COLUMNS.has(k1)) {
      sortCol = k1;
    }
    sortDir = v1 === 'ascend' ? 'asc' : 'desc';
  }

  const dataQ = q
    .clone()
    .select(
      'id',
      'category_title',
      'created_at',
      'is_internal',
      'full_address',
      'real_estate_type',
      'price',
      'next_real_estate_status',
    )
    .orderBy(sortCol, sortDir)
    .offset(offset)
    .limit(limit);

  const countQ = q
    .clone()
    .count({count: '*'})
    .first();

  const [data_list, countRow] = await Promise.all([dataQ, countQ]);
  return {
    data_list,
    count: Number(countRow?.count || 0),
  };
}

/**
 * Áp dụng filter chung (price, type, is_internal, branch_id, date range).
 * Conditions chia làm 2 dạng:
 *  1) Mongo-style query (raw): {key: value} hoặc {key: {$ne: ...}} — query dictionary
 *  2) Domain shorthand: {real_estate_type, is_internal, price_from, price_to, start_day, end_day, branch_id}
 */
function applyBaseConditions(query, conditions) {
  if (!conditions) return query;
  const {
    real_estate_type,
    is_internal,
    price_from,
    price_to,
    start_day,
    end_day,
    branch_id,
  } = conditions;
  if (real_estate_type !== undefined) {
    query = query.where('real_estate_type', real_estate_type);
  }
  if (is_internal !== undefined) {
    query = query.where('is_internal', is_internal);
  }
  if (price_from !== undefined) {
    query = query.where('price', '>=', price_from);
  }
  if (price_to !== undefined) {
    query = query.where('price', '<=', price_to);
  }
  if (start_day) {
    query = query.where('created_at', '>=', new Date(start_day));
  }
  if (end_day) {
    query = query.where('created_at', '<=', new Date(end_day));
  }
  if (branch_id) {
    query = query.whereRaw("(metadata->>'branch_id')::int = ?", [branch_id]);
  }
  return query;
}

module.exports = {
  KNOWN_COLUMNS,
  insertHistory,
  batchInsertHistory,
  deleteOneById,
  deleteManyByIds,
  findByRealEstateId,
  findRowsNeedingStatusFix,
  updateById,
  aggregateHistoryByRealEstateId,
  reportChartData,
  reportList,
  // helpers for test
  _splitPayload: splitPayload,
  _applyBaseConditions: applyBaseConditions,
};
