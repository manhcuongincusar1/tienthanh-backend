-- =============================================================
-- Sprint 1 — DB unification: 6 bảng PG thay thế 6 collection Mongo
-- DECISIONS B1 (JSONB-first), B2 (partition history), B5 (best practice), B6 (snake_case)
-- Idempotent: dùng IF NOT EXISTS toàn bộ.
-- =============================================================

-- =============================================================
-- 1. settings — Mongo: 1 doc {key:'setting', ...config}
-- DECISIONS B1: toàn bộ config nhét vào JSONB, không tách cột.
-- =============================================================
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- 2. import_errors — append-only log
-- =============================================================
CREATE TABLE IF NOT EXISTS import_errors (
  id         BIGSERIAL PRIMARY KEY,
  import_id  BIGINT,
  error_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_errors_import_id
  ON import_errors (import_id);
CREATE INDEX IF NOT EXISTS idx_import_errors_created_at
  ON import_errors (created_at DESC);

-- =============================================================
-- 3. subscriptions — Web Push (info JSONB chứa endpoint+keys)
-- =============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  auth       TEXT   NOT NULL UNIQUE,
  info       JSONB  NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON subscriptions (user_id);

-- =============================================================
-- 4. role_permissions — 1 row / role
-- Lưu ý: bảng "permissions" cũ đã tồn tại (component/action) cho purpose khác.
-- Đặt tên mới `role_permissions` để không conflict.
-- =============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id         BIGINT PRIMARY KEY REFERENCES roles(id) ON DELETE CASCADE,
  title           TEXT,
  permission_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- 5. real_estate_details — 1-1 với real_estate(id)
-- 11 cột "thật" (field xuất hiện trong WHERE/ORDER BY hoặc list view) +
-- metadata JSONB cho field động còn lại.
-- =============================================================
CREATE TABLE IF NOT EXISTS real_estate_details (
  real_estate_id  BIGINT PRIMARY KEY REFERENCES real_estate(id) ON DELETE CASCADE,
  area            NUMERIC,
  recognized_area NUMERIC,
  horizontal      NUMERIC,
  long            NUMERIC,
  bedroom         INT,
  wc              INT,
  book_status     BOOLEAN,
  structure       TEXT,
  direction       TEXT,
  note            TEXT,
  status          SMALLINT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_real_estate_details_metadata_gin
  ON real_estate_details USING GIN (metadata);

-- =============================================================
-- 6. real_estate_history — partitioned monthly by created_at
-- DECISIONS B2: partition theo tháng, giữ 12 tháng, drop sau 12 tháng (S4 cron)
-- =============================================================
-- Field names khớp shape Mongo cũ để giảm mapping ở service layer.
-- `previous_real_estate_status` / `next_real_estate_status` là JSONB chứa
-- {id, title, type, ...} — không truy cập field con qua WHERE nên giữ JSONB.
CREATE TABLE IF NOT EXISTS real_estate_history (
  id                          BIGSERIAL,
  real_estate_id              BIGINT NOT NULL REFERENCES real_estate(id) ON DELETE CASCADE,
  previous_real_estate_status JSONB,
  next_real_estate_status     JSONB,
  creator_full_name           TEXT,
  note_change                 TEXT,
  is_internal                 BOOLEAN DEFAULT false,
  category_title              TEXT,
  full_address                TEXT,
  real_estate_type            SMALLINT,
  price                       NUMERIC,
  status                      SMALLINT,
  metadata                    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- VACUUM tuning per DECISIONS B5.6 — apply per partition (parent partitioned table
-- không nhận `autovacuum_*` params; phải set trên từng partition con).

-- Indexes — PG14+ tự inherit cho từng partition mới tạo
CREATE INDEX IF NOT EXISTS idx_reh_realestate_created
  ON real_estate_history (real_estate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reh_created_brin
  ON real_estate_history USING BRIN (created_at);

-- =============================================================
-- Partition management functions (DECISIONS B2)
-- =============================================================

-- Tạo partition cho 1 tháng cụ thể
CREATE OR REPLACE FUNCTION create_history_partition(p_year INT, p_month INT)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  start_date DATE := make_date(p_year, p_month, 1);
  end_date   DATE := (start_date + INTERVAL '1 month')::date;
  part_name  TEXT := format(
    'real_estate_history_%s_%s',
    p_year,
    lpad(p_month::text, 2, '0')
  );
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF real_estate_history
     FOR VALUES FROM (%L) TO (%L)',
    part_name, start_date, end_date
  );
  -- VACUUM tuning per partition (DECISIONS B5.6).
  EXECUTE format(
    'ALTER TABLE %I SET (
       autovacuum_vacuum_scale_factor  = 0.05,
       autovacuum_analyze_scale_factor = 0.02
     )',
    part_name
  );
END;
$$;

-- Tạo trước N partition tương lai (gọi từ cron hàng tháng)
CREATE OR REPLACE FUNCTION ensure_future_history_partitions(p_months_ahead INT DEFAULT 3)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  i INT;
  d DATE;
BEGIN
  FOR i IN 0..p_months_ahead LOOP
    d := (date_trunc('month', now()) + (i || ' months')::interval)::date;
    PERFORM create_history_partition(
      EXTRACT(YEAR  FROM d)::int,
      EXTRACT(MONTH FROM d)::int
    );
  END LOOP;
END;
$$;

-- Drop partition cũ hơn N tháng (DECISIONS B2 — pre-req: dump S3 trước, làm ở S4 task 08)
CREATE OR REPLACE FUNCTION drop_old_history_partitions(p_months_old INT DEFAULT 12)
RETURNS TABLE(dropped TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  cutoff_date DATE := (date_trunc('month', now()) - (p_months_old || ' months')::interval)::date;
  rec         RECORD;
BEGIN
  FOR rec IN
    SELECT
      child.relname AS partition_name,
      pg_get_expr(child.relpartbound, child.oid) AS bound
    FROM pg_inherits
    JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
    JOIN pg_class child  ON pg_inherits.inhrelid  = child.oid
    WHERE parent.relname = 'real_estate_history'
  LOOP
    -- Bound dạng: FOR VALUES FROM ('2025-01-01 ...') TO ('2025-02-01 ...')
    IF rec.bound ~ ('FROM \(''(\d{4}-\d{2}-\d{2})')
       AND substring(rec.bound from '\(''(\d{4}-\d{2}-\d{2})')::date < cutoff_date THEN
      EXECUTE format('DROP TABLE IF EXISTS %I', rec.partition_name);
      dropped := rec.partition_name;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- Seed: tạo trước partition cho tháng hiện tại + 2 tháng tới
SELECT ensure_future_history_partitions(2);

-- TODO S4 task 02 (sau khi pg_cron extension cài đặt):
--   SELECT cron.schedule('create-future-partitions', '0 0 1 * *',
--     $$SELECT ensure_future_history_partitions(3)$$);
--   SELECT cron.schedule('drop-old-partitions',     '0 1 1 * *',
--     $$SELECT drop_old_history_partitions(12)$$);
