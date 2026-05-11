const express = require('express');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const auth = require('../../middlewares/auth');
const {exportService} = require('../../services/exportService');
const upload = require('../../common/uploadMiddleware');
const _ = require('lodash');
const Constants = require('../../common/constants');
const {importService} = require('../../services/importService');
const permission = require('../../middlewares/permission');
const checkInvalidBranch = require('../../middlewares/checkInvalidBranch');

const insertExportQueue = async (req, res) => {
  let {
    auth: {permissionInfo, id},
    body,
  } = req;

  const realEstateList = await exportService.insertExportRequest(body, id);
  return RestAPI.success(res, realEstateList);
};

const getExportQueueList = async (req, res) => {
  let {
    auth: {permissionInfo, id},
    query: {
      limit,
      offset,
      status,
      type,
      start_day,
      end_day,
      keyword,
      sort,
      branch_id,
    },
  } = req;

  const exportList = await exportService.getListExportQueue(
    {
      limit,
      offset,
      status,
      type,
      start_day,
      end_day,
      keyword,
      sort: JSON.parse(sort),
      branch_id,
    },
    permissionInfo,
    id,
  );
  return RestAPI.success(res, exportList);
};
const getImportQueueList = async (req, res) => {
  let {
    auth: {permissionInfo, id},
    query: {
      limit,
      offset,
      status,
      type,
      start_day,
      end_day,
      keyword,
      sort,
      branch_id,
    },
  } = req;

  const exportList = await importService.getListImportQueue({
    limit,
    offset,
    status,
    type,
    start_day,
    end_day,
    keyword,
    sort: JSON.parse(sort),
    branch_id,
  });

  return RestAPI.success(res, exportList);
};
const insertImportQueue = async (req, res) => {
  try {
    let {
      auth: {permissionInfo, id},
    } = req;
    if (_.isEmpty(req.file.fileNameUpload)) {
      return RestAPI.badRequest(res, Constants.MSG.FILE_EMPTY_ERR);
    } else {
      const {fileNameUpload, path, nameWithoutExt} = req.file;

      const response = await importService.insertImportRequest(
        nameWithoutExt,
        id,
        path,
      );

      if (!response) {
        return RestAPI.notFound(res, 'Upload error ');
      }
      RestAPI.success(res, response);
    }
  } catch (error) {
    return RestAPI.serverError(res, Constants.MSG.SERVER_ERR, error);
  }
};

router.post('/export/request', auth.authenticateToken, insertExportQueue);
router.get(
  '/export/request',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('importExportExport'),
  getExportQueueList,
);
router.get(
  '/import/request',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('importExportImport'),
  getImportQueueList,
);
router.post(
  '/import/request',
  [auth.authenticateToken, upload.uploadFile()],
  insertImportQueue,
);

module.exports = router;
