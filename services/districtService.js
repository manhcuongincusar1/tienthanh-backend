// District CRUD — in-process replacement for admin microservice.
// Mirrors legacy `administrative-unit-node-api` /district contract:
//   - GET list: ?search, ?ids[]=, ?status[]=, ?orderBy=(id|code|title), ?sortBy,
//                ?wards=true (eager-load), ?province_id|?province_city_id alias.
//   - display_title via translation JOIN.

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
    wards,
    province_city_id,
    province_id,
    languageCode = 'vi',
  } = query;
  const kw = search || keyword;
  const provinceId = province_city_id || province_id;
  const idsList = parseIds(ids);
  const statusList = parseStatus(status) || ACTIVE_STATUSES;
  const sort = pickSort(orderBy, sortBy);
  const includeWard = truthy(wards);

  let q = knex('districts as d')
    .whereIn('d.status', statusList)
    .leftJoin('districts_translation as dt', function () {
      this.on('dt.district_id', '=', 'd.id')
        .andOn('dt.language_code', '=', knex.raw('?', [languageCode]))
        .andOn('dt.status', '=', knex.raw('?', [Constants.STATUS_ENUM.ACTIVE]));
    })
    .leftJoin('province_city as pc', 'pc.id', 'd.province_city_id')
    .leftJoin('province_city_translation as pct', function () {
      this.on('pct.province_city_id', '=', 'pc.id')
        .andOn('pct.language_code', '=', knex.raw('?', [languageCode]))
        .andOn('pct.status', '=', knex.raw('?', [Constants.STATUS_ENUM.ACTIVE]));
    });

  if (kw) {
    q = q.where(function () {
      this.whereILike('d.title', `%${kw}%`).orWhereILike('d.code', `%${kw}%`);
    });
  }
  if (code) q = q.where('d.code', code);
  if (provinceId) q = q.where('d.province_city_id', Number(provinceId));
  if (idsList) q = q.whereIn('d.id', idsList);

  const selectCols = [
    'd.id',
    'd.code',
    'd.province_city_id',
    'd.title',
    'd.alias',
    'd.status',
    'd.created_at',
    'd.modification_at',
    knex.raw('COALESCE(dt.title, d.title) AS display_title'),
    knex.raw(`jsonb_build_object(
      'id', pc.id,
      'code', pc.code,
      'title', pc.title,
      'display_title', COALESCE(pct.title, pc.title)
    ) AS province_city`),
  ];

  if (includeWard) {
    selectCols.push(
      knex.raw(`(
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', w.id,
          'code', w.code,
          'title', w.title,
          'alias', w.alias,
          'display_title', COALESCE(wt.title, w.title)
        ) ORDER BY w.title), '[]'::jsonb)
        FROM wards w
        LEFT JOIN wards_translation wt
          ON wt.ward_id = w.id AND wt.language_code = ? AND wt.status = ?
        WHERE w.district_id = d.id AND w.status = ANY(?)
      ) AS wards`, [languageCode, Constants.STATUS_ENUM.ACTIVE, ACTIVE_STATUSES]),
    );
  }

  const [rows, countRow] = await Promise.all([
    q
      .clone()
      .select(selectCols)
      .orderBy(`d.${sort.col}`, sort.dir)
      .limit(Number(limit))
      .offset(Number(offset)),
    q.clone().count({c: 'd.id'}).first(),
  ]);

  return {data: rows, total: Number(countRow.c)};
};

const getDetail = async (id, opts = {}) => {
  const {languageCode = 'vi', includeWard = false} = opts;
  const row = await knex('districts as d')
    .leftJoin('districts_translation as dt', function () {
      this.on('dt.district_id', '=', 'd.id')
        .andOn('dt.language_code', '=', knex.raw('?', [languageCode]))
        .andOn('dt.status', '=', knex.raw('?', [Constants.STATUS_ENUM.ACTIVE]));
    })
    .leftJoin('province_city as pc', 'pc.id', 'd.province_city_id')
    .leftJoin('province_city_translation as pct', function () {
      this.on('pct.province_city_id', '=', 'pc.id')
        .andOn('pct.language_code', '=', knex.raw('?', [languageCode]))
        .andOn('pct.status', '=', knex.raw('?', [Constants.STATUS_ENUM.ACTIVE]));
    })
    .where('d.id', id)
    .first(
      'd.*',
      knex.raw('COALESCE(dt.title, d.title) AS display_title'),
      knex.raw(`jsonb_build_object(
        'id', pc.id,
        'code', pc.code,
        'title', pc.title,
        'display_title', COALESCE(pct.title, pc.title)
      ) AS province_city`),
    );
  if (!row) return null;
  if (truthy(includeWard)) {
    row.wards = await knex('wards as w')
      .leftJoin('wards_translation as wt', function () {
        this.on('wt.ward_id', '=', 'w.id')
          .andOn('wt.language_code', '=', knex.raw('?', [languageCode]))
          .andOn('wt.status', '=', knex.raw('?', [Constants.STATUS_ENUM.ACTIVE]));
      })
      .where('w.district_id', id)
      .whereIn('w.status', ACTIVE_STATUSES)
      .orderBy('w.title', 'asc')
      .select(
        'w.id',
        'w.code',
        'w.title',
        'w.alias',
        'w.status',
        knex.raw('COALESCE(wt.title, w.title) AS display_title'),
      );
  }
  return row;
};

const codeExists = async (code, excludeIds = []) => {
  let q = knex('districts').where('code', code).whereIn('status', ACTIVE_STATUSES);
  if (Array.isArray(excludeIds) && excludeIds.length) q = q.whereNotIn('id', excludeIds);
  const row = await q.first('id');
  return !!row;
};

const create = async (payload) => {
  const {code, title, status = Constants.STATUS_ENUM.ACTIVE} = payload;
  const province_city_id = payload.province_city_id ?? payload.provinceCityId;
  if (!code) throw new BizError(400, 'Mã quận/huyện là bắt buộc');
  if (!title) throw new BizError(400, 'Tên quận/huyện là bắt buộc');
  if (!province_city_id) throw new BizError(400, 'Tỉnh/thành là bắt buộc');
  if (await codeExists(code)) throw new BizError(400, 'Mã quận/huyện đã tồn tại');

  const [row] = await knex('districts')
    .insert({code, title, alias: makeAlias(title), province_city_id: Number(province_city_id), status})
    .returning('*');
  return row;
};

const update = async (id, payload) => {
  const existing = await knex('districts').where({id}).first();
  if (!existing) throw new BizError(404, 'Quận/huyện không tồn tại');
  const {code, title, status} = payload;
  const province_city_id = payload.province_city_id ?? payload.provinceCityId;
  if (code && code !== existing.code && (await codeExists(code, [Number(id)]))) {
    throw new BizError(400, 'Mã quận/huyện đã tồn tại');
  }
  const updateData = {modification_at: knex.fn.now()};
  if (code !== undefined) updateData.code = code;
  if (title !== undefined) {
    updateData.title = title;
    updateData.alias = makeAlias(title);
  }
  if (status !== undefined) updateData.status = Number(status);
  if (province_city_id !== undefined) updateData.province_city_id = Number(province_city_id);

  const [row] = await knex('districts').where({id}).update(updateData).returning('*');
  return row;
};

const setActive = async (id, status) => {
  const existing = await knex('districts').where({id}).first();
  if (!existing) throw new BizError(404, 'Quận/huyện không tồn tại');
  const [row] = await knex('districts')
    .where({id})
    .update({status: Number(status), modification_at: knex.fn.now()})
    .returning('*');
  return row;
};

const remove = async (id) => {
  const existing = await knex('districts').where({id}).first();
  if (!existing) throw new BizError(404, 'Quận/huyện không tồn tại');
  const childCount = await knex('wards')
    .where('district_id', id)
    .whereIn('status', ACTIVE_STATUSES)
    .count({c: '*'})
    .first();
  if (Number(childCount.c) > 0) {
    throw new BizError(400, 'Quận/huyện còn phường/xã, không thể xoá');
  }
  await knex('districts').where({id}).update({status: -1, modification_at: knex.fn.now()});
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
