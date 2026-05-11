// Legacy queue tables + cột users/roles/sales gaps mà init_schema/TITA.sql thiếu.
// Sources: schema/sql/{1,2,10,12,14,20,23,26}*.sql + UAT prod snapshot.
// 4 bảng queue vốn ở PG legacy (KHÔNG trong Mongo). Setup `init_schema/TITA.sql` skeleton
// thiếu DDL → cron spam relation does not exist. Sales bảng cũng skeleton thiếu price cols.
//
// Adjustments vs legacy:
//   • user_id INTEGER thay UUID — match current users.id INTEGER reality.
//   • Không thêm FK strict → tránh data legacy mồ côi block migration.

exports.up = async (knex) => {
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await knex.raw(`
    -- 1. mail_queue — outbound email queue (cron 30s pull WAITING → SMTP)
    CREATE TABLE IF NOT EXISTS mail_queue (
      id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      to_mail           VARCHAR,
      subject           VARCHAR,
      content           TEXT,
      created_date      TIMESTAMPTZ DEFAULT now(),
      status            SMALLINT DEFAULT 1,
      process_status    SMALLINT,
      modification_date TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_mail_queue_process_status ON mail_queue (process_status);

    -- 2. import_queue — import CSV/Excel BĐS queue (cron 60s parse + insert)
    CREATE TABLE IF NOT EXISTS import_queue (
      id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      file_path         TEXT,
      user_id           INTEGER,
      errors            JSONB,
      status            SMALLINT DEFAULT 1,
      created_at        TIMESTAMPTZ DEFAULT now(),
      modification_date TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE import_queue ADD COLUMN IF NOT EXISTS info             VARCHAR(255);
    ALTER TABLE import_queue ADD COLUMN IF NOT EXISTS file_name        VARCHAR(255);
    ALTER TABLE import_queue ADD COLUMN IF NOT EXISTS type             INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE import_queue ADD COLUMN IF NOT EXISTS error_file_path  TEXT;
    ALTER TABLE import_queue ADD COLUMN IF NOT EXISTS note             TEXT;
    ALTER TABLE import_queue ADD COLUMN IF NOT EXISTS branch_id        INTEGER;
    CREATE INDEX IF NOT EXISTS idx_import_queue_status      ON import_queue (status);
    CREATE INDEX IF NOT EXISTS idx_import_queue_user_id     ON import_queue (user_id);
    CREATE INDEX IF NOT EXISTS idx_import_queue_created_at  ON import_queue (created_at DESC);

    -- 3. export_queue — export BĐS ra Excel queue
    CREATE TABLE IF NOT EXISTS export_queue (
      id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      file_path         TEXT,
      user_id           INTEGER,
      meta_data         JSONB,
      status            SMALLINT DEFAULT 1,
      created_at        TIMESTAMPTZ DEFAULT now(),
      modification_date TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE export_queue ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
    ALTER TABLE export_queue ADD COLUMN IF NOT EXISTS type      INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE export_queue ADD COLUMN IF NOT EXISTS branch_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_export_queue_status     ON export_queue (status);
    CREATE INDEX IF NOT EXISTS idx_export_queue_user_id    ON export_queue (user_id);
    CREATE INDEX IF NOT EXISTS idx_export_queue_created_at ON export_queue (created_at DESC);

    -- 4. notification_queue — in-app push notification queue
    CREATE TABLE IF NOT EXISTS notification_queue (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      real_estate_id  BIGINT,
      status          SMALLINT,
      infodata        JSONB,
      created_at      TIMESTAMPTZ DEFAULT now(),
      modification_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue (status);
    CREATE INDEX IF NOT EXISTS idx_notification_queue_re_id  ON notification_queue (real_estate_id);

    -- 5. domain_setting — cùng nhóm schema/sql/10, mailService legacy có thể cần
    CREATE TABLE IF NOT EXISTS domain_setting (
      domain_title VARCHAR(250),
      branches     JSONB
    );

    -- 6. users column gaps (userService + accountService query các cột này)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS update_password  TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login       TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS raw_phone_number VARCHAR;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar           VARCHAR;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email            VARCHAR;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone            VARCHAR;

    -- roles.role — text discriminator dùng cho permission check (e.g. 'super_admin')
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS role VARCHAR;

    -- 7. sales — price + type columns
    -- init_schema/TITA.sql tạo skeleton (id,user_id,timestamps,status). UAT dump có 4 cột price
    -- INTEGER; ALTER 27 → NUMERIC(8,2) — apply final type luôn.
    ALTER TABLE sales ADD COLUMN IF NOT EXISTS sell_price_from NUMERIC(8,2);
    ALTER TABLE sales ADD COLUMN IF NOT EXISTS sell_price_to   NUMERIC(8,2);
    ALTER TABLE sales ADD COLUMN IF NOT EXISTS rent_price_from NUMERIC(8,2);
    ALTER TABLE sales ADD COLUMN IF NOT EXISTS rent_price_to   NUMERIC(8,2);
    ALTER TABLE sales ADD COLUMN IF NOT EXISTS type            VARCHAR(50);
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE sales DROP COLUMN IF EXISTS type;
    ALTER TABLE sales DROP COLUMN IF EXISTS rent_price_to;
    ALTER TABLE sales DROP COLUMN IF EXISTS rent_price_from;
    ALTER TABLE sales DROP COLUMN IF EXISTS sell_price_to;
    ALTER TABLE sales DROP COLUMN IF EXISTS sell_price_from;

    ALTER TABLE roles DROP COLUMN IF EXISTS role;

    ALTER TABLE users DROP COLUMN IF EXISTS phone;
    ALTER TABLE users DROP COLUMN IF EXISTS email;
    ALTER TABLE users DROP COLUMN IF EXISTS avatar;
    ALTER TABLE users DROP COLUMN IF EXISTS raw_phone_number;
    ALTER TABLE users DROP COLUMN IF EXISTS last_login;
    ALTER TABLE users DROP COLUMN IF EXISTS update_password;

    DROP TABLE IF EXISTS domain_setting CASCADE;
    DROP TABLE IF EXISTS notification_queue CASCADE;
    DROP TABLE IF EXISTS export_queue CASCADE;
    DROP TABLE IF EXISTS import_queue CASCADE;
    DROP TABLE IF EXISTS mail_queue CASCADE;
  `);
};
