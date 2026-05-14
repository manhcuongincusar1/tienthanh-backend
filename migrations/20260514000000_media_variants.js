// Sprint 3 task 07 media variants — bổ sung cột cho presigned URL flow (DECISIONS D1, D3, D5).
//
// Media table cũ chỉ có {id, legacy_uuid, path, title, extension, cdn_path, status, ...}.
// Presigned flow cần thêm: s3_key, mime, original_size, width, height, visibility, creator_id, metadata.
//
// Idempotent (IF NOT EXISTS). Không drop column cũ — legacy 13K row có cdn_path trỏ
// cdn.logintienthanh.com vẫn dùng song song với upload mới (S3 task 07 + S6 STATUS).

exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE media
      ADD COLUMN IF NOT EXISTS s3_key        TEXT,
      ADD COLUMN IF NOT EXISTS mime          VARCHAR(100),
      ADD COLUMN IF NOT EXISTS original_size BIGINT,
      ADD COLUMN IF NOT EXISTS width         INTEGER,
      ADD COLUMN IF NOT EXISTS height        INTEGER,
      ADD COLUMN IF NOT EXISTS visibility    VARCHAR(10) DEFAULT 'public',
      ADD COLUMN IF NOT EXISTS creator_id    INTEGER,
      ADD COLUMN IF NOT EXISTS metadata      JSONB DEFAULT '{}'::jsonb;

    -- Unique index trên s3_key cho findByS3Key + tránh dup row khi presign retry.
    -- Partial index — null không tính (legacy 13K row có s3_key NULL).
    CREATE UNIQUE INDEX IF NOT EXISTS uq_media_s3_key
      ON media(s3_key) WHERE s3_key IS NOT NULL;

    -- Visibility-based queries (FE list ảnh public của user, etc.)
    CREATE INDEX IF NOT EXISTS idx_media_visibility_creator
      ON media(visibility, creator_id) WHERE creator_id IS NOT NULL;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    DROP INDEX IF EXISTS uq_media_s3_key;
    DROP INDEX IF EXISTS idx_media_visibility_creator;
    ALTER TABLE media
      DROP COLUMN IF EXISTS s3_key,
      DROP COLUMN IF EXISTS mime,
      DROP COLUMN IF EXISTS original_size,
      DROP COLUMN IF EXISTS width,
      DROP COLUMN IF EXISTS height,
      DROP COLUMN IF EXISTS visibility,
      DROP COLUMN IF EXISTS creator_id,
      DROP COLUMN IF EXISTS metadata;
  `);
};
