const BaseService = require('./baseService');
const mediaRepo = require('./repositories/mediaRepo');

// CDN domain — DECISIONS D4. Override qua env nếu cần per-env.
const CDN_BASE =
  process.env.CDN_BASE_URL || 'https://tienthanhcdn.datviet.ai';

class MediaService extends BaseService {
  // Legacy insert — backward-compat cho FE đang dùng `/upload` (multer S3).
  insertMedia = async (data) => mediaRepo.insertLegacy(data);

  insertMultipleMedia = async (data) => mediaRepo.insertManyLegacy(data);

  // New schema insert — presigned flow.
  insertV2 = async (data) => mediaRepo.insertV2(data);

  findById = async (id) => mediaRepo.findById(id);

  findByS3Key = async (s3_key) => mediaRepo.findByS3Key(s3_key);

  // FE construct URL trực tiếp từ s3_key — BE chỉ giúp khi response API legacy.
  // Variant per DECISIONS D6: chỉ `thumbnail` + `large`.
  cdnUrl = (s3_key, size = 'large') => `${CDN_BASE}/${size}/${s3_key}`;

  // Public response shape — fill cả URL mới + cdn_path legacy.
  toPublicShape = (row) => {
    if (!row) return null;
    const large = row.s3_key ? this.cdnUrl(row.s3_key, 'large') : null;
    const thumbnail = row.s3_key ? this.cdnUrl(row.s3_key, 'thumbnail') : null;
    return {
      id: Number(row.id),
      s3_key: row.s3_key,
      mime: row.mime,
      visibility: row.visibility,
      thumbnail_url: thumbnail,
      large_url: large,
      cdn_path: row.cdn_path || large, // legacy FE chưa update
    };
  };
}

module.exports = new MediaService();
