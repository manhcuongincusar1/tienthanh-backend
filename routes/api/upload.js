const express = require('express');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const auth = require('../../middlewares/auth');
const Common = require('../../common/common');
const Upload = require('../../common/uploadMiddleware');
const _ = require('lodash');
const Constants = require('../../common/constants');
const mediaService = require('../../services/mediaService');
const s3Service = require('../../services/s3Service');
const cfSigner = require('../../services/cloudfrontSigner');

const PRESIGN_TTL_SEC = 300;
const PRIVATE_VIEW_TTL_SEC = 300;

// ---------- LEGACY upload (multer S3) — giữ backward-compat ----------

router.post(
  '/upload',
  [auth.authenticateToken, Upload.uploadFileS3()],
  uploadFile,
);

async function uploadFile(req, res) {
  try {
    if (_.isEmpty(req.fileNameUpload)) {
      return RestAPI.badRequest(res, Constants.MSG.FILE_EMPTY_ERR);
    } else {
      const {file, fileNameUpload, filePath, nameWithoutExt, extension} = req;

      const response = await mediaService.insertMedia({
        cdn_path: file.location,
        extension: extension,
        title: fileNameUpload,
      });

      if (!response) {
        return RestAPI.notFound(res, 'Upload error ');
      }
      RestAPI.success(res, response);
    }
  } catch (error) {
    return RestAPI.serverError(res, Constants.MSG.SERVER_ERR, error);
  }
}

// ---------- NEW: presigned URL flow (DECISIONS D1, D3, D4, D5) ----------

function isAllowedMime(mime) {
  if (!mime) return false;
  return (
    Constants.MIMETYPE_IMAGE.includes(mime) ||
    Constants.MIMETYPE_DOC.includes(mime)
  );
}

router.post('/presign', auth.authenticateToken, async (req, res) => {
  try {
    const {filename, mime, size, visibility, isConfidential} = req.body || {};
    if (!filename || !mime) {
      return RestAPI.badRequest(res, 'filename_and_mime_required');
    }
    if (!isAllowedMime(mime)) {
      return RestAPI.badRequest(res, 'mime_not_allowed');
    }
    if (size && size > Constants.LIMIT_IMPORT) {
      return RestAPI.badRequest(res, 'file_too_large');
    }

    const finalVisibility =
      visibility === 'private' || isConfidential === true ? 'private' : 'public';

    const dot = filename.lastIndexOf('.');
    const extension = dot >= 0 ? filename.slice(dot + 1) : '';

    const s3_key = s3Service.buildS3Key({visibility: finalVisibility, extension});

    const url = await s3Service.presignPut({
      s3_key,
      mime,
      expiresSec: PRESIGN_TTL_SEC,
    });

    const row = await mediaService.insertV2({
      s3_key,
      mime,
      original_size: size || null,
      visibility: finalVisibility,
      creator_id: req.auth?.user_id,
    });

    RestAPI.success(res, {
      media_id: row ? Number(row.id) : null,
      s3_key,
      upload_url: url,
      method: 'PUT',
      expires_in: PRESIGN_TTL_SEC,
      visibility: finalVisibility,
      mime,
    });
  } catch (err) {
    console.error('presign_error', err);
    return RestAPI.serverError(res, Constants.MSG.SERVER_ERR, err);
  }
});

// GET /_api/file/view/:id — serve media (redirect to CDN or signed URL).
// Path `/view/:id` thay vì `/:id` để tránh conflict với `/upload`, `/presign`.
router.get('/view/:id', auth.authenticateToken, async (req, res) => {
  try {
    const row = await mediaService.findById(req.params.id);
    if (!row) {
      return RestAPI.notFound(res, 'media_not_found');
    }

    if (row.visibility === 'public') {
      const url = row.s3_key
        ? mediaService.cdnUrl(row.s3_key, req.query.size || 'large')
        : row.cdn_path;
      if (!url) return RestAPI.notFound(res, 'no_url');
      return res.redirect(url);
    }

    // Private: permission rule scope tối thiểu (owner OR super_admin).
    const userId = req.auth?.user_id;
    const roleId = req.auth?.role_id;
    const isOwner = Number(row.creator_id) === Number(userId);
    const isAdmin = roleId === 1;
    if (!isOwner && !isAdmin) {
      return RestAPI.forbidden(res, 'forbidden');
    }

    if (cfSigner.isConfigured()) {
      const size = req.query.size || 'large';
      const signed = await cfSigner.signUrl({
        path: `/${size}/${row.s3_key}`,
        expiresInSec: PRIVATE_VIEW_TTL_SEC,
      });
      return res.redirect(signed);
    }

    const fallback = await s3Service.presignGet({
      s3_key: row.s3_key,
      expiresSec: PRIVATE_VIEW_TTL_SEC,
    });
    return res.redirect(fallback);
  } catch (err) {
    console.error('serve_file_error', err);
    return RestAPI.serverError(res, Constants.MSG.SERVER_ERR, err);
  }
});

module.exports = router;
