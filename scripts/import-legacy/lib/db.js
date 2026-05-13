// 3 connections cho pipeline:
//  - target: PG mới (POSTGRES_URL hoặc PG_TARGET_URL)
//  - legacy: PG dump tita_prod.sql.gz restored (PG_LEGACY_URL)
//  - mongo:  Mongo backup restored (MONGO_URL)

require('pg').types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
const knexLib = require('knex');
const {MongoClient} = require('mongodb');

const TARGET_URL = process.env.PG_TARGET_URL || process.env.POSTGRES_URL
  || 'postgresql://tita:123qwe@localhost:5432/tita';
const LEGACY_URL = process.env.PG_LEGACY_URL
  || 'postgresql://postgres:x@localhost:5435/tita_prod_ref';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'tita';

let _target, _legacy, _mongo, _mongoClient;

exports.target = () => {
  if (!_target) {
    _target = knexLib({
      client: 'pg',
      connection: TARGET_URL,
      pool: {min: 1, max: 4, idleTimeoutMillis: 30000},
    });
  }
  return _target;
};

exports.legacy = () => {
  if (!_legacy) {
    _legacy = knexLib({
      client: 'pg',
      connection: LEGACY_URL,
      pool: {min: 1, max: 4, idleTimeoutMillis: 30000},
    });
  }
  return _legacy;
};

exports.mongo = async () => {
  if (!_mongo) {
    _mongoClient = new MongoClient(MONGO_URL);
    await _mongoClient.connect();
    _mongo = _mongoClient.db(MONGO_DB);
  }
  return _mongo;
};

exports.close = async () => {
  if (_target) await _target.destroy();
  if (_legacy) await _legacy.destroy();
  if (_mongoClient) await _mongoClient.close();
  _target = _legacy = _mongo = _mongoClient = null;
};
