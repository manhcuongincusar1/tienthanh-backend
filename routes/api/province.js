// Province CRUD route — in-process implementation (no HTTP proxy to admin service).
// Service layer: services/provinceService.js. Preserve FE-facing API contract.
const express = require('express');
const _ = require('lodash');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const Constants = require('../../common/constants');
const Authentication = require('../../middlewares/auth');
const permission = require('../../middlewares/permission');
const checkInvalidBranch = require('../../middlewares/checkInvalidBranch');
const provinceService = require('../../services/provinceService');

const handleBizError = (res, err) => {
  if (err && err.status) return RestAPI.badRequest(res, err.message);
  console.log(err);
  return RestAPI.serverError(res, 'Internal server error');
};

const decorateDisplay = (row) => ({
  ...row,
  display_status: row.status == Constants.STATUS_ENUM.ACTIVE,
});

const getListProvince = async (req, res) => {
  try {
    const {data, total} = await provinceService.getList(req.query);
    return RestAPI.success(res, data.map(decorateDisplay), {total});
  } catch (err) {
    return handleBizError(res, err);
  }
};

const detailProvince = async (req, res) => {
  try {
    const row = await provinceService.getDetail(req.params.id);
    if (!row) return RestAPI.notFound(res, 'Province not found');
    return RestAPI.success(res, row);
  } catch (err) {
    return handleBizError(res, err);
  }
};

const createProvince = async (req, res) => {
  try {
    const row = await provinceService.create(req.body);
    return RestAPI.success(res, row);
  } catch (err) {
    return handleBizError(res, err);
  }
};

const updateProvince = async (req, res) => {
  try {
    const row = await provinceService.update(req.params.id, req.body);
    return RestAPI.success(res, row);
  } catch (err) {
    return handleBizError(res, err);
  }
};

const updateActiveDeActiveProvince = async (req, res) => {
  try {
    const row = await provinceService.setActive(req.params.id, req.body.status);
    return RestAPI.success(res, row);
  } catch (err) {
    return handleBizError(res, err);
  }
};

const deleteProvince = async (req, res) => {
  try {
    await provinceService.remove(req.params.id);
    return RestAPI.success(res, 'Deleted');
  } catch (err) {
    return handleBizError(res, err);
  }
};

const checkCodeExistProvince = async (req, res) => {
  try {
    const exists = await provinceService.codeExists(req.params.code);
    return RestAPI.success(res, exists);
  } catch (err) {
    return handleBizError(res, err);
  }
};

router.get('/list', Authentication.authenticateToken, getListProvince);
router.get(
  '/get-list',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('provinceList'),
  getListProvince,
);
router.post(
  '/active-deactive/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('provinceEdit'),
  updateActiveDeActiveProvince,
);
router.post(
  '/create',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('provinceCreate'),
  createProvince,
);
router.get(
  '/detail/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('provinceDelete'),
  detailProvince,
);
router.post(
  '/update/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('provinceEdit'),
  updateProvince,
);
router.post(
  '/delete/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('provinceDelete'),
  deleteProvince,
);
router.get(
  '/code-exist/:code',
  Authentication.authenticateToken,
  checkCodeExistProvince,
);
module.exports = router;
