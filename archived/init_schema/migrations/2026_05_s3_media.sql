-- Sprint 3 task 07 — bảng `media`.
-- KISS schema per DECISIONS D5: KHÔNG bắt buộc cột `status` cho file flow mới.
-- Giữ cột cũ (path/extension/title/cdn_path/status) cho backward-compat legacy
-- insertMedia callsite (routes/api/upload.js, routes/api/common.js).
-- Thêm cột mới (s3_key/mime/visibility/...) cho presigned URL flow (D1).
-- Idempotent.

CREATE TABLE IF NOT EXISTS media (
  id              BIGSERIAL PRIMARY KEY,
  -- Legacy columns (giữ backward-compat):
  path            TEXT,
  extension       TEXT,
  title           TEXT,
  cdn_path        TEXT,
  status          SMALLINT DEFAULT 1,
  -- New schema (D1/D3/D5):
  s3_key          TEXT,
  mime            TEXT,
  original_size   BIGINT,
  width           INT,
  height          INT,
  visibility      TEXT NOT NULL DEFAULT 'public'
                    CHECK (visibility IN ('public','private')),
  creator_id      BIGINT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent ALTER cho trường hợp bảng đã tồn tại với schema cũ:
ALTER TABLE media ADD COLUMN IF NOT EXISTS s3_key TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS mime TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS original_size BIGINT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS width INT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS height INT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';
ALTER TABLE media ADD COLUMN IF NOT EXISTS creator_id BIGINT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE media ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE media ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name='media' AND constraint_name='media_visibility_check'
  ) THEN
    ALTER TABLE media ADD CONSTRAINT media_visibility_check
      CHECK (visibility IN ('public','private'));
  END IF;
END $$;

-- Unique partial — chỉ enforce uniqueness cho s3_key not-null (legacy row có thể có s3_key NULL).
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_s3_key
  ON media (s3_key) WHERE s3_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_creator_id ON media (creator_id);
CREATE INDEX IF NOT EXISTS idx_media_visibility ON media (visibility);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media (created_at DESC);
