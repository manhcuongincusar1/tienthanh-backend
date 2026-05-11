// In-process replacement for legacy administrative microservice (port 3011).
// Mirrors HTTP API contract: list trả {data, total}; mutations throw lỗi qua BizError với
// {status, message} để route handler bắt nguyên format như cũ.

const knex = require('../db/connectKnex');
const Constants = require('../common/constants');
const slugify = require('slugify');

// Exclude soft-deleted (-1). STATUS_ENUM = {DELETED:-1, ACTIVE:1, PENDING:2}.
const ACTIVE_STATUSES = [Constants.STATUS_ENUM.ACTIVE, Constants.STATUS_ENUM.PENDING];

class BizError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const makeAlias = (title) => slugify(String(title || ''), {lower: true, strict: true});

const getList = async (query = {}) => {
  const {
    limit = 10,
    offset = 0,
    keyword,
    status,
    code,
  } = query;

  let q = knex('province_city').whereIn('status', ACTIVE_STATUSES);

  if (keyword) {
    q = q.where(function () {
      this.whereILike('title', `%${keyword}%`).orWhereILike('code', `%${keyword}%`);
    });
  }
  if (code) q = q.where('code', code);
  if (status !== undefined && status !== '' && status !== null) {
    q = q.where('status', Number(status));
  }

  const [rows, countRow] = await Promise.all([
    q
      .clone()
      .select('id', 'code', 'title', 'alias', 'status', 'created_at', 'modification_at')
      .orderBy('id', 'asc')
      .limit(Number(limit))
      .offset(Number(offset)),
    q.clone().count({c: '*'}).first(),
  ]);

  return {data: rows, total: Number(countRow.c)};
};

const getDetail = async (id) => {
  const row = await knex('province_city').where({id}).first();
  return row || null;
};

const codeExists = async (code) => {
  const row = await knex('province_city')
    .where('code', code)
    .whereIn('status', ACTIVE_STATUSES)
    .first('id');
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
  const existing = await getDetail(id);
  if (!existing) throw new BizError(404, 'Tỉnh/thành không tồn tại');
  const {code, title, status} = payload;
  if (code && code !== existing.code) {
    if (await codeExists(code)) throw new BizError(400, 'Mã tỉnh/thành đã tồn tại');
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
  const existing = await getDetail(id);
  if (!existing) throw new BizError(404, 'Tỉnh/thành không tồn tại');
  const [row] = await knex('province_city')
    .where({id})
    .update({status: Number(status), modification_at: knex.fn.now()})
    .returning('*');
  return row;
};

const remove = async (id) => {
  const existing = await getDetail(id);
  if (!existing) throw new BizError(404, 'Tỉnh/thành không tồn tại');
  await knex('province_city')
    .where({id})
    .update({status: -1, modification_at: knex.fn.now()});
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
