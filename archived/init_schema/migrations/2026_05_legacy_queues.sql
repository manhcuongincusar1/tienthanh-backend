-- =============================================================
-- Legacy queue tables consolidation
-- Sources:
--   • schema/sql/1.import-export.sql       (import_queue, export_queue)
--   • schema/sql/2.import-export.sql       (ALTER cols)
--   • schema/sql/10.*.sql                  (notification_queue)
--   • schema/sql/12.*.sql, 20.*.sql, 23.*.sql (ALTER queue cols)
--   • schema/uat/tita-uat.0.0.1.sql.gz     (mail_queue UAT prod snapshot)
--
-- 4 bảng này KHÔNG ở Mongo, vốn legacy PG. `init_schema/TITA.sql` setup
-- thiếu DDL nên local dev `tita` DB không có → cron spam relation does not exist.
--
-- Adjustments vs legacy:
--   • user_id INTEGER thay UUID — match current users.id INTEGER reality
--     (legacy có thể users.id từng là UUID, hiện tại không).
--   • Idempotent: CREATE TABLE IF NOT EXISTS, ALTER IF NOT EXISTS.
--   • Không thêm FK strict → tránh data legacy mồ côi block migration.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- 1. mail_queue — outbound email queue (cron 30s pull WAITING → SMTP)
-- =============================================================
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

-- =============================================================
-- 2. import_queue — import CSV/Excel BĐS queue (cron 60s parse + insert)
-- =============================================================
CREATE TABLE IF NOT EXISTS import_queue (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_path         TEXT,
  user_id           INTEGER,
  errors            JSONB,
  status            SMALLINT DEFAULT 1,
  created_at        TIMESTAMPTZ DEFAULT now(),
  modification_date TIMESTAMPTZ DEFAULT now()
);

-- ALTER per schema/sql/2.import-export.sql
ALTER TABLE import_queue ADD COLUMN IF NOT EXISTS info             VARCHAR(255);
ALTER TABLE import_queue ADD COLUMN IF NOT EXISTS file_name        VARCHAR(255);
ALTER TABLE import_queue ADD COLUMN IF NOT EXISTS type             INTEGER NOT NULL DEFAULT 1;
ALTER TABLE import_queue ADD COLUMN IF NOT EXISTS error_file_path  TEXT;
-- ALTER per schema/sql/12 (add note)
ALTER TABLE import_queue ADD COLUMN IF NOT EXISTS note             TEXT;
-- ALTER per schema/sql/20 (add branch_id)
ALTER TABLE import_queue ADD COLUMN IF NOT EXISTS branch_id        INTEGER;

CREATE INDEX IF NOT EXISTS idx_import_queue_status      ON import_queue (status);
CREATE INDEX IF NOT EXISTS idx_import_queue_user_id     ON import_queue (user_id);
CREATE INDEX IF NOT EXISTS idx_import_queue_created_at  ON import_queue (created_at DESC);

-- =============================================================
-- 3. export_queue — export BĐS ra Excel queue
-- =============================================================
CREATE TABLE IF NOT EXISTS export_queue (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_path         TEXT,
  user_id           INTEGER,
  meta_data         JSONB,
  status            SMALLINT DEFAULT 1,
  created_at        TIMESTAMPTZ DEFAULT now(),
  modification_date TIMESTAMPTZ DEFAULT now()
);

-- ALTER per schema/sql/2.import-export.sql
ALTER TABLE export_queue ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
ALTER TABLE export_queue ADD COLUMN IF NOT EXISTS type      INTEGER NOT NULL DEFAULT 1;
-- ALTER per schema/sql/23 (add branch_id)
ALTER TABLE export_queue ADD COLUMN IF NOT EXISTS branch_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_export_queue_status     ON export_queue (status);
CREATE INDEX IF NOT EXISTS idx_export_queue_user_id    ON export_queue (user_id);
CREATE INDEX IF NOT EXISTS idx_export_queue_created_at ON export_queue (created_at DESC);

-- =============================================================
-- 4. notification_queue — in-app push notification queue
-- =============================================================
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

-- =============================================================
-- 5. domain_setting — cùng nhóm schema/sql/10, mailService legacy có thể cần
-- =============================================================
CREATE TABLE IF NOT EXISTS domain_setting (
  domain_title VARCHAR(250),
  branches     JSONB
);

-- =============================================================
-- 6. users — fill legacy column gaps that init_schema/TITA.sql thiếu
--    (userService + accountService query các cột này)
-- =============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS update_password  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login       TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS raw_phone_number VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar           VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email            VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone            VARCHAR;

-- roles.role — text discriminator dùng cho permission check (e.g. 'super_admin')
ALTER TABLE roles ADD COLUMN IF NOT EXISTS role VARCHAR;

-- =============================================================
-- 7. sales — price + type columns (per legacy UAT dump + schema/sql/14+26+27)
--    init_schema/TITA.sql tạo skeleton (id,user_id,timestamps,status) thiếu price cols.
--    UAT dump: sell/rent_price_from/to INTEGER; ALTER 27 → NUMERIC(8,2). Apply final type luôn.
-- =============================================================
ALTER TABLE sales ADD COLUMN IF NOT EXISTS sell_price_from NUMERIC(8,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS sell_price_to   NUMERIC(8,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS rent_price_from NUMERIC(8,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS rent_price_to   NUMERIC(8,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS type            VARCHAR(50);
