// Ward CRUD — in-process replacement for admin microservice.
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
  const {limit = 10, offset = 0, keyword, status, code, district_id} = query;

  let q = knex('wards').whereIn('status', ACTIVE_STATUSES);
  if (keyword) {
    q = q.where(function () {
      this.whereILike('title', `%${keyword}%`).orWhereILike('code', `%${keyword}%`);
    });
  }
  if (code) q = q.where('code', code);
  if (district_id) q = q.where('district_id', Number(district_id));
  if (Array.isArray(status)) {
    const vals = status.map(Number).filter(Number.isFinite);
    if (vals.length) q = q.whereIn('status', vals);
  } else if (status !== undefined && status !== '' && status !== null) {
    q = q.where('status', Number(status));
  }

  const [rows, countRow] = await Promise.all([
    q
      .clone()
      .select('id', 'code', 'district_id', 'title', 'alias', 'is_system', 'status', 'created_at', 'modification_at')
      .orderBy('id', 'asc')
      .limit(Number(limit))
      .offset(Number(offset)),
    q.clone().count({c: '*'}).first(),
  ]);

  return {data: rows, total: Number(countRow.c)};
};

const getDetail = async (id) => {
  const row = await knex('wards').where({id}).first();
  return row || null;
};

const codeExists = async (code) => {
  const row = await knex('wards').where('code', code).whereIn('status', ACTIVE_STATUSES).first('id');
  return !!row;
};

const create = async (payload) => {
  const {code, title, district_id, status = Constants.STATUS_ENUM.ACTIVE} = payload;
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
  const existing = await getDetail(id);
  if (!existing) throw new BizError(404, 'Phường/xã không tồn tại');
  if (existing.is_system) throw new BizError(400, 'Phường/xã hệ thống không thể sửa');
  const {code, title, status, district_id} = payload;
  if (code && code !== existing.code && (await codeExists(code))) {
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
  const existing = await getDetail(id);
  if (!existing) throw new BizError(404, 'Phường/xã không tồn tại');
  const [row] = await knex('wards')
    .where({id})
    .update({status: Number(status), modification_at: knex.fn.now()})
    .returning('*');
  return row;
};

const remove = async (id) => {
  const existing = await getDetail(id);
  if (!existing) throw new BizError(404, 'Phường/xã không tồn tại');
  if (existing.is_system) throw new BizError(400, 'Phường/xã hệ thống không thể xoá');
  await knex('wards').where({id}).update({status: -1, modification_at: knex.fn.now()});
  return true;
};

module.exports = {BizError, getList, getDetail, codeExists, create, update, setActive, remove};
