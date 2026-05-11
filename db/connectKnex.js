const configSetting = require('../config/setting')();

// bigint (OID 20) — coerce sang Number ở mọi pg driver (pg.Pool + knex dùng chung).
// Idempotent — đã set ở db/postgresql.js nhưng knex có thể load độc lập trong test.
require('pg').types.setTypeParser(20, (val) => (val === null ? null : Number(val)));

const config = {
  client: 'pg',
  connection: configSetting.databases.postgres,
  pool: {
    min: Number(process.env.KNEX_POOL_MIN) || 2,
    max: Number(process.env.KNEX_POOL_MAX) || 10,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 5000,
  },
  acquireConnectionTimeout: 5000,
};

const knex = require('knex')(config);

module.exports = knex;
