const configSetting = require('../config/setting')();
const config = {
  client: 'pg',
  connection: configSetting.databases.postgres,
};
const knex = require('knex')(config);

module.exports = knex;
