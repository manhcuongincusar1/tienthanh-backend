// Street CRUD — in-process replacement for admin microservice.
// Street: 3-level location filter (ward_id, district_id, province_city_id).
const knex = require('../db/connectKnex');
const Constants = require('../common/constants');
const slugify = require('slugify');

const ACTIVE_STATUSES = [Constants.STATUS_ENUM.ACTIVE, Constants.STATUS_ENUM.PENDING];

class BizError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const makeAlias = (title) => slugify(String(title || ''), {lower: true, strict: true});

// Accept both snake_case (street.js BE input) and camelCase (admin service legacy update payload)
const pickLocation = (payload) => ({
  ward_id: payload.ward_id ?? payload.wardId,
  district_id: payload.district_id ?? payload.districts_id ?? payload.districtId,
  province_city_id: payload.province_city_id ?? payload.provinceCityId,
});

const getList = async (query = {}) => {
  const {limit = 10, offset = 0, keyword, status, code, ward_id, district_id, province_city_id} = query;

  let q = knex('streets').whereIn('status', ACTIVE_STATUSES);
  if (keyword) {
    q = q.where(function () {
      this.whereILike('title', `%${keyword}%`).orWhereILike('code', `%${keyword}%`);
    });
  }
  if (code) q = q.where('code', code);
  if (ward_id) q = q.where('ward_id', Number(ward_id));
  if (district_id) q = q.where('district_id', Number(district_id));
  if (province_city_id) q = q.where('province_city_id', Number(province_city_id));
  if (Array.isArray(status)) {
    const vals = status.map(Number).filter(Number.isFinite);
    if (vals.length) q = q.whereIn('status', vals);
  } else if (status !== undefined && status !== '' && status !== null) {
    q = q.where('status', Number(status));
  }

  const [rows, countRow] = await Promise.all([
    q
      .clone()
      .select(
        'id',
        'code',
        'ward_id',
        'district_id',
        'province_city_id',
        'title',
        'alias',
        'status',
        'created_at',
        'modification_at',
      )
      .orderBy('id', 'asc')
      .limit(Number(limit))
      .offset(Number(offset)),
    q.clone().count({c: '*'}).first(),
  ]);

  return {data: rows, total: Number(countRow.c)};
};

const getDetail = async (id) => {
  const row = await knex('streets').where({id}).first();
  return row || null;
};

const codeExists = async (code) => {
  const row = await knex('streets').where('code', code).whereIn('status', ACTIVE_STATUSES).first('id');
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
  const existing = await getDetail(id);
  if (!existing) throw new BizError(404, 'Đường không tồn tại');
  const {title, status, code} = payload;
  const loc = pickLocation(payload);
  if (code && code !== existing.code && (await codeExists(code))) {
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
  const existing = await getDetail(id);
  if (!existing) throw new BizError(404, 'Đường không tồn tại');
  const [row] = await knex('streets')
    .where({id})
    .update({status: Number(status), modification_at: knex.fn.now()})
    .returning('*');
  return row;
};

const remove = async (id) => {
  const existing = await getDetail(id);
  if (!existing) throw new BizError(404, 'Đường không tồn tại');
  await knex('streets').where({id}).update({status: -1, modification_at: knex.fn.now()});
  return true;
};

module.exports = {BizError, getList, getDetail, codeExists, create, update, setActive, remove};
