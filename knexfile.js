// Knex CLI config — `npm run migrate` reads this file.
// Single env block — connection picks up POSTGRES_URL/DATABASE_URL from env (dotenv loaded by bin/www).
// For `tita_test` runs locally: `POSTGRES_URL=postgresql://tita:123qwe@localhost:5432/tita_test npm run migrate`

require('dotenv').config();

const connection =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  'postgresql://tita:123qwe@localhost:5432/tita';

module.exports = {
  client: 'pg',
  connection,
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
    loadExtensions: ['.js'],
  },
  seeds: {
    directory: './seeds',
    loadExtensions: ['.js'],
  },
};
