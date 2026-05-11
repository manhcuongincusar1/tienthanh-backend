// Schema gaps: branches.code + branch_district table.
// Sources:
//   • schema/sql/10.create_table_branch_district_*.sql  → branch_district
//   • schema/uat/tita-uat.0.0.1.sql.gz                  → branches.code VARCHAR
//
// branchService.getListWorkspace() query JOIN cả 2 → cron + login post-flow đều crash.
// branch_id INTEGER thay UUID (legacy) — match branches.id SERIAL reality.

exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE branches ADD COLUMN IF NOT EXISTS code VARCHAR;

    CREATE TABLE IF NOT EXISTS branch_district (
      branch_id   INTEGER,
      province_id INTEGER,
      district_id INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_branch_district_branch_id ON branch_district (branch_id);
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    DROP TABLE IF EXISTS branch_district CASCADE;
    ALTER TABLE branches DROP COLUMN IF EXISTS code;
  `);
};
