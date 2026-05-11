// Bootstrap master data hành chính VN (province / district / ward / street + translations).
// Source: scripts/data/master_data.sql.gz — extract từ prod dump tita_28_05_2024.sql.gz.
// 63 tỉnh, 707 huyện, 11313 phường, 8891 đường + 7 file translation.
//
// Idempotent: skip nếu province_city đã có row (tránh ghi đè data prod hoặc CRUD trên dev sau seed).
// Chạy lần đầu deploy. Sau khi seed → admin có thể CRUD thêm/sửa qua /province /district /ward /street.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const GZ_PATH = path.join(__dirname, '..', 'scripts', 'data', 'master_data.sql.gz');

const SEQUENCES = [
  'province_city',
  'districts',
  'wards',
  'streets',
  'province_city_translation',
  'districts_translation',
  'streets_translation',
];

exports.seed = async (knex) => {
  const existing = await knex('province_city').count({c: '*'}).first();
  if (Number(existing.c) > 0) {
    console.log(`  [02_master_data] skip — province_city has ${existing.c} rows already`);
    return;
  }

  if (!fs.existsSync(GZ_PATH)) {
    console.warn(`  [02_master_data] skip — ${GZ_PATH} not found`);
    return;
  }

  console.log(`  [02_master_data] loading ${GZ_PATH}...`);
  const buf = fs.readFileSync(GZ_PATH);
  const sql = zlib.gunzipSync(buf).toString('utf8');
  console.log(`  [02_master_data] decompressed: ${(sql.length / 1024 / 1024).toFixed(1)}MB`);

  console.log('  [02_master_data] applying INSERTs...');
  await knex.raw(sql);

  console.log('  [02_master_data] re-syncing sequences...');
  for (const t of SEQUENCES) {
    await knex.raw(
      `SELECT setval('${t}_id_seq', GREATEST((SELECT MAX(id) FROM ${t}), 1))`,
    );
  }

  const counts = {};
  for (const t of SEQUENCES) {
    const {c} = await knex(t).count({c: '*'}).first();
    counts[t] = Number(c);
  }
  console.log('  [02_master_data] final counts:', counts);
};
