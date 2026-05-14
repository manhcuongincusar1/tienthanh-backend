// Street CRUD — in-process replacement for admin microservice.
// Mirrors legacy /street contract:
//   - GET list: ?search, ?ids[]=, ?status[]=, ?orderBy, ?sortBy,
//                ?ward_id, ?district_id, ?province_city_id (3-level filter).
//   - display_title via translation JOIN. Nested `districts` + `wards` for FE.

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

// Accept both snake_case (BE input) and camelCase (admin service legacy update payload).
const pickLocation = (payload) => ({
  ward_id: payload.ward_id ?? payload.wardId,
  district_id: payload.district_id ?? payload.districts_id ?? payload.districtId,
  province_city_id: payload.province_city_id ?? payload.provinceCityId,
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
    ward_id,
    district_id,
    province_city_id,
    languageCode = 'vi',
  } = query;
  const kw = search || keyword;
  const idsList = parseIds(ids);
  const statusList = parseStatus(status) || ACTIVE_STATUSES;
  const sort = pickSort(orderBy, sortBy);

  let q = knex('streets as s')
    .whereIn('s.status', statusList)
    .leftJoin('streets_translation as st', function () {
      this.on('st.street_id', '=', 's.id')
        .andOn('st.language_code', '=', knex.raw('?', [languageCode]))
        .andOn('st.status', '=', knex.raw('?', [Constants.STATUS_ENUM.ACTIVE]));
    })
    .leftJoin('wards as w', 'w.id', 's.ward_id')
    .leftJoin('wards_translation as wt', function () {
      this.on('wt.ward_id', '=', 'w.id')
        .andOn('wt.language_code', '=', knex.raw('?', [languageCode]))
        .andOn('wt.status', '=', knex.raw('?', [Constants.STATUS_ENUM.ACTIVE]));
    })
    .leftJoin('districts as d', 'd.id', 's.district_id')
    .leftJoin('districts_translation as dt', function () {
      this.on('dt.district_id', '=', 'd.id')
        .andOn('dt.language_code', '=', knex.raw('?', [languageCode]))
        .andOn('dt.status', '=', knex.raw('?', [Constants.STATUS_ENUM.ACTIVE]));
    });

  if (kw) {
    q = q.where(function () {
      this.whereILike('s.title', `%${kw}%`).orWhereILike('s.code', `%${kw}%`);
    });
  }
  if (code) q = q.where('s.code', code);
  if (ward_id) q = q.where('s.ward_id', Number(ward_id));
  if (district_id) q = q.where('s.district_id', Number(district_id));
  if (province_city_id) q = q.where('s.province_city_id', Number(province_city_id));
  if (idsList) q = q.whereIn('s.id', idsList);

  const selectCols = [
    's.id',
    's.code',
    's.ward_id',
    's.district_id',
    's.province_city_id',
    's.title',
    's.alias',
    's.status',
    's.created_at',
    's.modification_at',
    knex.raw('COALESCE(st.title, s.title) AS display_title'),
    knex.raw(`jsonb_build_object(
      'id', w.id,
      'code', w.code,
      'title', w.title,
      'display_title', COALESCE(wt.title, w.title)
    ) AS wards`),
    knex.raw(`jsonb_build_object(
      'id', d.id,
      'code', d.code,
      'title', d.title,
      'display_title', COALESCE(dt.title, d.title)
    ) AS districts`),
  ];

  const [rows, countRow] = await Promise.all([
    q
      .clone()
      .select(selectCols)
      .orderBy(`s.${sort.col}`, sort.dir)
      .limit(Number(limit))
      .offset(Number(offset)),
    q.clone().count({c: 's.id'}).first(),
  ]);

  return {data: rows, total: Number(countRow.c)};
};

const getDetail = async (id, opts = {}) => {
  const {languageCode = 'vi'} = opts;
  const row = await knex('streets as s')
    .leftJoin('streets_translation as st', function () {
      this.on('st.street_id', '=', 's.id')
        .andOn('st.language_code', '=', knex.raw('?', [languageCode]))
        .andOn('st.status', '=', knex.raw('?', [Constants.STATUS_ENUM.ACTIVE]));
    })
    .leftJoin('wards as w', 'w.id', 's.ward_id')
    .leftJoin('wards_translation as wt', function () {
      this.on('wt.ward_id', '=', 'w.id')
        .andOn('wt.language_code', '=', knex.raw('?', [languageCode]))
        .andOn('wt.status', '=', knex.raw('?', [Constants.STATUS_ENUM.ACTIVE]));
    })
    .leftJoin('districts as d', 'd.id', 's.district_id')
    .leftJoin('districts_translation as dt', function () {
      this.on('dt.district_id', '=', 'd.id')
        .andOn('dt.language_code', '=', knex.raw('?', [languageCode]))
        .andOn('dt.status', '=', knex.raw('?', [Constants.STATUS_ENUM.ACTIVE]));
    })
    .where('s.id', id)
    .first(
      's.*',
      knex.raw('COALESCE(st.title, s.title) AS display_title'),
      knex.raw(`jsonb_build_object(
        'id', w.id,
        'code', w.code,
        'title', w.title,
        'display_title', COALESCE(wt.title, w.title)
      ) AS wards`),
      knex.raw(`jsonb_build_object(
        'id', d.id,
        'code', d.code,
        'title', d.title,
        'display_title', COALESCE(dt.title, d.title)
      ) AS districts`),
    );
  return row || null;
};

const codeExists = async (code, excludeIds = []) => {
  let q = knex('streets').where('code', code).whereIn('status', ACTIVE_STATUSES);
  if (Array.isArray(excludeIds) && excludeIds.length) q = q.whereNotIn('id', excludeIds);
  const row = await q.first('id');
  return !!row;
};

const create = async (payload) => {
  const {title, status = Constants.STATUS_ENUM.ACTIVE, code} = payload;
  const loc = pickLocation(payload);
  if (!title) throw new BizError(400, 'Tên đường là bắt buộc');
  if (code && (await codeExists(code))) throw new BizError(400, 'Mã đường đã tồn tại');

  const [row] = await knex('streets')
    .insert({
      code: code || null,
      title,
      alias: makeAlias(title),
      ward_id: loc.ward_id ? Number(loc.ward_id) : null,
      district_id: loc.district_id ? Number(loc.district_id) : null,
      province_city_id: loc.province_city_id ? Number(loc.province_city_id) : null,
      status,
    })
    .returning('*');
  return row;
};

const update = async (id, payload) => {
  const existing = await knex('streets').where({id}).first();
  if (!existing) throw new BizError(404, 'Đường không tồn tại');
  const {title, status, code} = payload;
  const loc = pickLocation(payload);
  if (code && code !== existing.code && (await codeExists(code, [Number(id)]))) {
    throw new BizError(400, 'Mã đường đã tồn tại');
  }
  const updateData = {modification_at: knex.fn.now()};
  if (code !== undefined) updateData.code = code;
  if (title !== undefined) {
    updateData.title = title;
    updateData.alias = makeAlias(title);
  }
  if (status !== undefined) updateData.status = Number(status);
  if (loc.ward_id !== undefined) updateData.ward_id = loc.ward_id ? Number(loc.ward_id) : null;
  if (loc.district_id !== undefined) updateData.district_id = loc.district_id ? Number(loc.district_id) : null;
  if (loc.province_city_id !== undefined) {
    updateData.province_city_id = loc.province_city_id ? Number(loc.province_city_id) : null;
  }

  const [row] = await knex('streets').where({id}).update(updateData).returning('*');
  return row;
};

const setActive = async (id, status) => {
  const existing = await knex('streets').where({id}).first();
  if (!existing) throw new BizError(404, 'Đường không tồn tại');
  const [row] = await knex('streets')
    .where({id})
    .update({status: Number(status), modification_at: knex.fn.now()})
    .returning('*');
  return row;
};

const remove = async (id) => {
  const existing = await knex('streets').where({id}).first();
  if (!existing) throw new BizError(404, 'Đường không tồn tại');
  await knex('streets').where({id}).update({status: -1, modification_at: knex.fn.now()});
  return true;
};

module.exports = {BizError, getList, getDetail, codeExists, create, update, setActive, remove};
