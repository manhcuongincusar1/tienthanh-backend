/**
 * Jest globalTeardown — destroy knex pool 1 lần sau toàn bộ test.
 * Lý do: db/connectKnex.js là singleton; nếu mỗi file test gọi destroy()
 * trong afterAll, file kế sẽ dùng connection đã đóng.
 */
const knex = require('../db/connectKnex');

module.exports = async () => {
  await knex.destroy();
};
