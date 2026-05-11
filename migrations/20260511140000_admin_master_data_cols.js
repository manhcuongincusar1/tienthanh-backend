// Match prod schema cho master data tables (province_city / districts / wards / streets).
// Source: PG dump tita_28_05_2024.sql.gz từ outsource.
//
// Schema diffs local vs prod:
//   wards   thiếu  is_system BOOLEAN
//   streets thiếu  code, district_id, province_city_id

exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE wards   ADD COLUMN IF NOT EXISTS is_system        BOOLEAN DEFAULT false;
    ALTER TABLE streets ADD COLUMN IF NOT EXISTS code             VARCHAR;
    ALTER TABLE streets ADD COLUMN IF NOT EXISTS district_id      INTEGER;
    ALTER TABLE streets ADD COLUMN IF NOT EXISTS province_city_id INTEGER;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE streets DROP COLUMN IF EXISTS province_city_id;
    ALTER TABLE streets DROP COLUMN IF EXISTS district_id;
    ALTER TABLE streets DROP COLUMN IF EXISTS code;
    ALTER TABLE wards   DROP COLUMN IF EXISTS is_system;
  `);
};
