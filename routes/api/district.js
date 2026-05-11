// District CRUD route — in-process implementation (no HTTP proxy to admin service).
const express = require('express');
const _ = require('lodash');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const Constants = require('../../common/constants');
const Authentication = require('../../middlewares/auth');
const permission = require('../../middlewares/permission');
const checkInvalidBranch = require('../../middlewares/checkInvalidBranch');
const districtService = require('../../services/districtService');

const handleBizError = (res, err) => {
  if (err && err.status) return RestAPI.badRequest(res, err.message);
  console.log(err);
  return RestAPI.serverError(res, 'Internal server error');
};

const decorateDisplay = (row) => ({
  ...row,
  display_status: row.status == Constants.STATUS_ENUM.ACTIVE,
});

const getListDistrict = async (req, res) => {
  try {
    const {data, total} = await districtService.getList(req.query);
    return RestAPI.success(res, data.map(decorateDisplay), {total});
  } catch (err) {
    return handleBizError(res, err);
  }
};

const detailDistrict = async (req, res) => {
  try {
    const row = await districtService.getDetail(req.params.id);
    if (!row) return RestAPI.notFound(res, 'District not found');
    return RestAPI.success(res, row);
  } catch (err) {
    return handleBizError(res, err);
  }
};

const createDistrict = async (req, res) => {
  try {
    const row = await districtService.create(req.body);
    return RestAPI.success(res, row);
  } catch (err) {
    return handleBizError(res, err);
  }
};

const updateDistrict = async (req, res) => {
  try {
    const row = await districtService.update(req.params.id, req.body);
    return RestAPI.success(res, row);
  } catch (err) {
    return handleBizError(res, err);
  }
};

const updateActiveDeActiveDistrict = async (req, res) => {
  try {
    const row = await districtService.setActive(req.params.id, req.body.status);
    return RestAPI.success(res, row);
  } catch (err) {
    return handleBizError(res, err);
  }
};

const deleteDistrict = async (req, res) => {
  try {
    await districtService.remove(req.params.id);
    return RestAPI.success(res, 'Deleted');
  } catch (err) {
    return handleBizError(res, err);
  }
};

const checkCodeExistDistrict = async (req, res) => {
  try {
    const exists = await districtService.codeExists(req.params.code);
    return RestAPI.success(res, exists);
  } catch (err) {
    return handleBizError(res, err);
  }
};

router.get('/list', Authentication.authenticateToken, getListDistrict);
router.get(
  '/get-list',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('districtList'),
  getListDistrict,
);
router.post(
  '/create',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('districtCreate'),
  createDistrict,
);
router.post(
  '/active-deactive/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('districtEdit'),
  updateActiveDeActiveDistrict,
);
router.get(
  '/detail/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('districtEdit'),
  detailDistrict,
);
router.post(
  '/update/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('districtEdit'),
  updateDistrict,
);
router.post(
  '/delete/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('districtDelete'),
  deleteDistrict,
);
router.get(
  '/code-exist/:code',
  Authentication.authenticateToken,
  checkCodeExistDistrict,
);
module.exports = router;
