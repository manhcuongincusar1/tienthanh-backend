// District CRUD — in-process replacement for admin microservice.
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

const getList = async (query = {}) => {
  const {limit = 10, offset = 0, keyword, status, code, province_city_id, province_id} = query;
  const provinceId = province_city_id || province_id;

  let q = knex('districts').whereIn('status', ACTIVE_STATUSES);
  if (keyword) {
    q = q.where(function () {
      this.whereILike('title', `%${keyword}%`).orWhereILike('code', `%${keyword}%`);
    });
  }
  if (code) q = q.where('code', code);
  if (provinceId) q = q.where('province_city_id', Number(provinceId));
  if (Array.isArray(status)) {
    const vals = status.map(Number).filter(Number.isFinite);
    if (vals.length) q = q.whereIn('status', vals);
  } else if (status !== undefined && status !== '' && status !== null) {
    q = q.where('status', Number(status));
  }

  const [rows, countRow] = await Promise.all([
    q
      .clone()
      .select('id', 'code', 'province_city_id', 'title', 'alias', 'status', 'created_at', 'modification_at')
      .orderBy('id', 'asc')
      .limit(Number(limit))
      .offset(Number(offset)),
    q.clone().count({c: '*'}).first(),
  ]);

  return {data: rows, total: Number(countRow.c)};
};

const getDetail = async (id) => {
  const row = await knex('districts').where({id}).first();
  return row || null;
};

const codeExists = async (code) => {
  const row = await knex('districts').where('code', code).whereIn('status', ACTIVE_STATUSES).first('id');
  return !!row;
};

const create = async (payload) => {
  const {code, title, province_city_id, status = Constants.STATUS_ENUM.ACTIVE} = payload;
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
  const existing = await getDetail(id);
  if (!existing) throw new BizError(404, 'Quận/huyện không tồn tại');
  const {code, title, status, province_city_id} = payload;
  if (code && code !== existing.code && (await codeExists(code))) {
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
  const existing = await getDetail(id);
  if (!existing) throw new BizError(404, 'Quận/huyện không tồn tại');
  const [row] = await knex('districts')
    .where({id})
    .update({status: Number(status), modification_at: knex.fn.now()})
    .returning('*');
  return row;
};

const remove = async (id) => {
  const existing = await getDetail(id);
  if (!existing) throw new BizError(404, 'Quận/huyện không tồn tại');
  await knex('districts').where({id}).update({status: -1, modification_at: knex.fn.now()});
  return true;
};

module.exports = {BizError, getList, getDetail, codeExists, create, update, setActive, remove};
