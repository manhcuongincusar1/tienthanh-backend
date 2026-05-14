// Ward CRUD — in-process replacement for admin microservice.
// Mirrors legacy /ward contract:
//   - GET list: ?search, ?ids[]=, ?status[]=, ?orderBy, ?sortBy,
//                ?streets=true (eager-load), ?district_id, ?province_city_id (JOIN via district).
//   - display_title via translation JOIN. Nested `districts` + `province_city` for FE.

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
    streets,
    district_id,
    province_city_id,
    languageCode = 'vi',
  } = query;
  const kw = search || keyword;
  const idsList = parseIds(ids);
  const statusList = parseStatus(status) || ACTIVE_STATUSES;
  const sort = pickSort(orderBy, sortBy);
  const includeStreet = truthy(streets);

  let q = knex('wards as w')
    .whereIn('w.status', statusList)
    .leftJoin('wards_translation as wt', function () {
      this.on('wt.ward_id', '=', 'w.id')
        .andOn('wt.language_code', '=', knex.raw('?', [languageCode]))
        .andOn('wt.status', '=', knex.raw('?', [Constants.STATUS_ENUM.ACTIVE]));
    })
    .leftJoin('districts as d', 'd.id', 'w.district_id')
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
      this.whereILike('w.title', `%${kw}%`).orWhereILike('w.code', `%${kw}%`);
    });
  }
  if (code) q = q.where('w.code', code);
  if (district_id) q = q.where('w.district_id', Number(district_id));
  if (province_city_id) q = q.where('d.province_city_id', Number(province_city_id));
  if (idsList) q = q.whereIn('w.id', idsList);

  const selectCols = [
    'w.id',
    'w.code',
    'w.district_id',
    'w.title',
    'w.alias',
    'w.is_system',
    'w.status',
    'w.created_at',
    'w.modification_at',
    knex.raw('COALESCE(wt.title, w.title) AS display_title'),
    knex.raw(`jsonb_build_object(
      'id', d.id,
      'code', d.code,
      'title', d.title,
      'display_title', COALESCE(dt.title, d.title)
    ) AS districts`),
    knex.raw(`jsonb_build_object(
      'id', pc.id,
      'code', pc.code,
      'title', pc.title,
      'display_title', COALESCE(pct.title, pc.title)
    ) AS province_city`),
  ];

  if (includeStreet) {
    selectCols.push(
      knex.raw(`(
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', s.id,
          'code', s.code,
          'title', s.title,
          'alias', s.alias,
          'display_title', COALESCE(st.title, s.title)
        ) ORDER BY s.title), '[]'::jsonb)
        FROM streets s
        LEFT JOIN streets_translation st
          ON st.street_id = s.id AND st.language_code = ? AND st.status = ?
        WHERE s.ward_id = w.id AND s.status = ANY(?)
      ) AS streets`, [languageCode, Constants.STATUS_ENUM.ACTIVE, ACTIVE_STATUSES]),
    );
  }

  const [rows, countRow] = await Promise.all([
    q
      .clone()
      .select(selectCols)
      .orderBy(`w.${sort.col}`, sort.dir)
      .limit(Number(limit))
      .offset(Number(offset)),
    q.clone().count({c: 'w.id'}).first(),
  ]);

  return {data: rows, total: Number(countRow.c)};
};

const getDetail = async (id, opts = {}) => {
  const {languageCode = 'vi', includeStreet = false} = opts;
  const row = await knex('wards as w')
    .leftJoin('wards_translation as wt', function () {
      this.on('wt.ward_id', '=', 'w.id')
        .andOn('wt.language_code', '=', knex.raw('?', [languageCode]))
        .andOn('wt.status', '=', knex.raw('?', [Constants.STATUS_ENUM.ACTIVE]));
    })
    .leftJoin('districts as d', 'd.id', 'w.district_id')
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
    .where('w.id', id)
    .first(
      'w.*',
      knex.raw('COALESCE(wt.title, w.title) AS display_title'),
      knex.raw(`jsonb_build_object(
        'id', d.id,
        'code', d.code,
        'title', d.title,
        'display_title', COALESCE(dt.title, d.title)
      ) AS districts`),
      knex.raw(`jsonb_build_object(
        'id', pc.id,
        'code', pc.code,
        'title', pc.title,
        'display_title', COALESCE(pct.title, pc.title)
      ) AS province_city`),
    );
  if (!row) return null;
  if (truthy(includeStreet)) {
    row.streets = await knex('streets as s')
      .leftJoin('streets_translation as st', function () {
        this.on('st.street_id', '=', 's.id')
          .andOn('st.language_code', '=', knex.raw('?', [languageCode]))
          .andOn('st.status', '=', knex.raw('?', [Constants.STATUS_ENUM.ACTIVE]));
      })
      .where('s.ward_id', id)
      .whereIn('s.status', ACTIVE_STATUSES)
      .orderBy('s.title', 'asc')
      .select(
        's.id',
        's.code',
        's.title',
        's.alias',
        's.status',
        knex.raw('COALESCE(st.title, s.title) AS display_title'),
      );
  }
  return row;
};

const codeExists = async (code, excludeIds = []) => {
  let q = knex('wards').where('code', code).whereIn('status', ACTIVE_STATUSES);
  if (Array.isArray(excludeIds) && excludeIds.length) q = q.whereNotIn('id', excludeIds);
  const row = await q.first('id');
  return !!row;
};

const create = async (payload) => {
  const {code, title, status = Constants.STATUS_ENUM.ACTIVE} = payload;
  const district_id = payload.district_id ?? payload.districtId;
  if (!code) throw new BizError(400, 'Mã phường/xã là bắt buộc');
  if (!title) throw new BizError(400, 'Tên phường/xã là bắt buộc');
  if (!district_id) throw new BizError(400, 'Quận/huyện là bắt buộc');
  if (await codeExists(code)) throw new BizError(400, 'Mã phường/xã đã tồn tại');

  const [row] = await knex('wards')
    .insert({code, title, alias: makeAlias(title), district_id: Number(district_id), status, is_system: false})
    .returning('*');
  return row;
};

const update = async (id, payload) => {
  const existing = await knex('wards').where({id}).first();
  if (!existing) throw new BizError(404, 'Phường/xã không tồn tại');
  if (existing.is_system) throw new BizError(400, 'Phường/xã hệ thống không thể sửa');
  const {code, title, status} = payload;
  const district_id = payload.district_id ?? payload.districtId;
  if (code && code !== existing.code && (await codeExists(code, [Number(id)]))) {
    throw new BizError(400, 'Mã phường/xã đã tồn tại');
  }
  const updateData = {modification_at: knex.fn.now()};
  if (code !== undefined) updateData.code = code;
  if (title !== undefined) {
    updateData.title = title;
    updateData.alias = makeAlias(title);
  }
  if (status !== undefined) updateData.status = Number(status);
  if (district_id !== undefined) updateData.district_id = Number(district_id);

  const [row] = await knex('wards').where({id}).update(updateData).returning('*');
  return row;
};

const setActive = async (id, status) => {
  const existing = await knex('wards').where({id}).first();
  if (!existing) throw new BizError(404, 'Phường/xã không tồn tại');
  const [row] = await knex('wards')
    .where({id})
    .update({status: Number(status), modification_at: knex.fn.now()})
    .returning('*');
  return row;
};

const remove = async (id) => {
  const existing = await knex('wards').where({id}).first();
  if (!existing) throw new BizError(404, 'Phường/xã không tồn tại');
  if (existing.is_system) throw new BizError(400, 'Phường/xã hệ thống không thể xoá');
  const childCount = await knex('streets')
    .where('ward_id', id)
    .whereIn('status', ACTIVE_STATUSES)
    .count({c: '*'})
    .first();
  if (Number(childCount.c) > 0) {
    throw new BizError(400, 'Phường/xã còn đường, không thể xoá');
  }
  await knex('wards').where({id}).update({status: -1, modification_at: knex.fn.now()});
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
