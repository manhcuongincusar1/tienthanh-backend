// Media repo — PG-backed (DECISIONS A9). Schema mới per task 07 D5 KISS (no status track).

const knexPg = require('../../db/connectKnex');

const TABLE = 'media';

// Legacy insert (giữ cho routes/api/upload.js + routes/api/common.js dùng uploadFileS3).
exports.insertLegacy = async ({path, extension, title, cdn_path}, trx) => {
  const rows = await (trx || knexPg)(TABLE)
    .insert({path, extension, title, cdn_path, status: 1})
    .returning(['id', 'path', 'cdn_path']);
  return rows[0] || false;
};

exports.insertManyLegacy = async (items, trx) => {
  if (!items || items.length === 0) return [];
  const payload = items.map((value) => ({
    path: value.path,
    extension: value.extension,
    title: value.title,
    status: 1,
  }));
  const rows = await (trx || knexPg)(TABLE)
    .insert(payload)
    .returning(['id', 'path']);
  return rows;
};

// New schema insert — dùng cho presigned URL flow (task 05).
// `s3_key` không bao gồm extension hay prefix; FE construct URL.
exports.insertV2 = async (
  {s3_key, mime, original_size, width, height, visibility, creator_id, metadata},
  trx,
) => {
  const rows = await (trx || knexPg)(TABLE)
    .insert({
      s3_key,
      mime,
      original_size,
      width,
      height,
      visibility: visibility || 'public',
      creator_id,
      metadata: metadata || {},
    })
    .returning(['id', 's3_key', 'visibility', 'mime', 'creator_id', 'created_at']);
  return rows[0] || false;
};

exports.findById = async (id, trx) =>
  (trx || knexPg)(TABLE).where('id', id).first();

exports.findByS3Key = async (s3_key, trx) =>
  (trx || knexPg)(TABLE).where('s3_key', s3_key).first();
