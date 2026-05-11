const express = require('express');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const auth = require('../../middlewares/auth');
const Validator = require('jsonschema').Validator;
const Common = require('../../common/common');
const Upload = require('../../common/uploadMiddleware');
const _ = require('lodash');
const Constants = require('../../common/constants');
const mediaService = require('../../services/mediaService');

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

module.exports = router;
