// Province CRUD — in-process replacement for admin microservice.
// Mirrors legacy `administrative-unit-node-api` /province contract:
//   - GET list: ?search, ?ids[]=, ?status[]=, ?orderBy=(id|code|title), ?sortBy=(asc|desc),
//                ?districts=true (eager-load children + display_title via translation JOIN).
//   - display_title fallback: translation.title nếu có, else entity.title.

const knex = require('../db/connectKnex');
const Constants = require('../common/constants');
const slugify = require('slugify');

const ACTIVE_STATUSES = [Constants.STATUS_ENUM.ACTIVE, Constants.STATUS_ENUM.PENDING];
const ALLOWED_SORT = new Set(['id', 'code', 'title']);

class BizError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const makeAlias = (title) => slugify(String(title || ''), {lower: true, strict: true});

const truthy = (v) => v === true || v === 'true' || v === 1 || v === '1';

const parseIds = (ids) => {
  if (ids === undefined || ids === null) return null;
  const arr = Array.isArray(ids) ? ids : [ids];
  const nums = arr.map(Number).filter(Number.isFinite);
  return nums.length ? nums : null;
};

const parseStatus = (status) => {
  if (Array.isArray(status)) {
    const vals = status.map(Number).filter(Number.isFinite);
    return vals.length ? vals : null;
  }
  if (status === undefined || status === '' || status === null) return null;
  const n = Number(status);
  return Number.isFinite(n) ? [n] : null;
};

const pickSort = (orderBy, sortBy) => ({
  col: ALLOWED_SORT.has(orderBy) ? orderBy : 'title',
  dir: String(sortBy || '').toLowerCase() === 'desc' ? 'desc' : 'asc',
});

const getList = async (query = {}) => {
  const {
    limit = 10,
    offset = 0,
    keyword,
    search,
    status,
    code,
    ids,
    orderBy,
    sortBy,
    districts,
    languageCode = 'vi',
  } = query;
  const kw = search || keyword;
  const idsList = parseIds(ids);
  const statusList = parseStatus(status) || ACTIVE_STATUSES;
  const sort = pickSort(orderBy, sortBy);
  const includeDistrict = truthy(districts);

  let q = knex('province_city as pc')
    .whereIn('pc.status', statusList)
    .leftJoin('province_city_translation as pct', function () {
      this.on('pct.province_city_id', '=', 'pc.id')
        .andOn('pct.language_code', '=', knex.raw('?', [languageCode]))
        .andOn('pct.status', '=', knex.raw('?', [Constants.STATUS_ENUM.ACTIVE]));
    });

  if (kw) {
    q = q.where(function () {
      this.whereILike('pc.title', `%${kw}%`).orWhereILike('pc.code', `%${kw}%`);
    });
  }
  if (code) q = q.where('pc.code', code);
  if (idsList) q = q.whereIn('pc.id', idsList);

  const selectCols = [
    'pc.id',
    'pc.code',
    'pc.title',
    'pc.alias',
    'pc.status',
    'pc.created_at',
    'pc.modification_at',
    knex.raw('COALESCE(pct.title, pc.title) AS display_title'),
  ];

  if (includeDistrict) {
    selectCols.push(
      knex.raw(`(
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', d.id,
          'code', d.code,
          'title', d.title,
          'alias', d.alias,
          'display_title', COALESCE(dt.title, d.title)
        ) ORDER BY d.title), '[]'::jsonb)
        FROM districts d
        LEFT JOIN districts_translation dt
          ON dt.district_id = d.id AND dt.language_code = ? AND dt.status = ?
        WHERE d.province_city_id = pc.id AND d.status = ANY(?)
      ) AS districts`, [languageCode, Constants.STATUS_ENUM.ACTIVE, ACTIVE_STATUSES]),
    );
  }

  const [rows, countRow] = await Promise.all([
    q
      .clone()
      .select(selectCols)
      .orderBy(`pc.${sort.col}`, sort.dir)
      .limit(Number(limit))
      .offset(Number(offset)),
    q.clone().count({c: 'pc.id'}).first(),
  ]);

  return {data: rows, total: Number(countRow.c)};
};

const getDetail = async (id, opts = {}) => {
  const {languageCode = 'vi', includeDistrict = false} = opts;
  const row = await knex('province_city as pc')
    .leftJoin('province_city_translation as pct', function () {
      this.on('pct.province_city_id', '=', 'pc.id')
        .andOn('pct.language_code', '=', knex.raw('?', [languageCode]))
        .andOn('pct.status', '=', knex.raw('?', [Constants.STATUS_ENUM.ACTIVE]));
    })
    .where('pc.id', id)
    .first(
      'pc.*',
      knex.raw('COALESCE(pct.title, pc.title) AS display_title'),
    );
  if (!row) return null;
  if (truthy(includeDistrict)) {
    row.districts = await knex('districts as d')
      .leftJoin('districts_translation as dt', function () {
        this.on('dt.district_id', '=', 'd.id')
          .andOn('dt.language_code', '=', knex.raw('?', [languageCode]))
          .andOn('dt.status', '=', knex.raw('?', [Constants.STATUS_ENUM.ACTIVE]));
      })
      .where('d.province_city_id', id)
      .whereIn('d.status', ACTIVE_STATUSES)
      .orderBy('d.title', 'asc')
      .select(
        'd.id',
        'd.code',
        'd.title',
        'd.alias',
        'd.status',
        knex.raw('COALESCE(dt.title, d.title) AS display_title'),
      );
  }
  return row;
};

const codeExists = async (code, excludeIds = []) => {
  let q = knex('province_city').where('code', code).whereIn('status', ACTIVE_STATUSES);
  if (Array.isArray(excludeIds) && excludeIds.length) q = q.whereNotIn('id', excludeIds);
  const row = await q.first('id');
  return !!row;
};

const create = async (payload) => {
  const {code, title, status = Constants.STATUS_ENUM.ACTIVE} = payload;
  if (!code) throw new BizError(400, 'Mã tỉnh/thành là bắt buộc');
  if (!title) throw new BizError(400, 'Tên tỉnh/thành là bắt buộc');
  if (await codeExists(code)) throw new BizError(400, 'Mã tỉnh/thành đã tồn tại');

  const [row] = await knex('province_city')
    .insert({code, title, alias: makeAlias(title), status})
    .returning('*');
  return row;
};

const update = async (id, payload) => {
  const existing = await knex('province_city').where({id}).first();
  if (!existing) throw new BizError(404, 'Tỉnh/thành không tồn tại');
  const {code, title, status} = payload;
  if (code && code !== existing.code && (await codeExists(code, [Number(id)]))) {
    throw new BizError(400, 'Mã tỉnh/thành đã tồn tại');
  }
  const updateData = {modification_at: knex.fn.now()};
  if (code !== undefined) updateData.code = code;
  if (title !== undefined) {
    updateData.title = title;
    updateData.alias = makeAlias(title);
  }
  if (status !== undefined) updateData.status = Number(status);

  const [row] = await knex('province_city').where({id}).update(updateData).returning('*');
  return row;
};

const setActive = async (id, status) => {
  const existing = await knex('province_city').where({id}).first();
  if (!existing) throw new BizError(404, 'Tỉnh/thành không tồn tại');
  const [row] = await knex('province_city')
    .where({id})
    .update({status: Number(status), modification_at: knex.fn.now()})
    .returning('*');
  return row;
};

const remove = async (id) => {
  const existing = await knex('province_city').where({id}).first();
  if (!existing) throw new BizError(404, 'Tỉnh/thành không tồn tại');
  const childCount = await knex('districts')
    .where('province_city_id', id)
    .whereIn('status', ACTIVE_STATUSES)
    .count({c: '*'})
    .first();
  if (Number(childCount.c) > 0) {
    throw new BizError(400, 'Tỉnh/thành còn quận/huyện, không thể xoá');
  }
  await knex('province_city').where({id}).update({status: -1, modification_at: knex.fn.now()});
  return true;
};

module.exports = {
  BizError,
  getList,
  getDetail,
  codeExists,
  create,
  update,
  setActive,
  remove,
};
