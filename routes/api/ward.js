// Ward CRUD route — in-process implementation (no HTTP proxy to admin service).
const express = require('express');
const _ = require('lodash');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const Constants = require('../../common/constants');
const Authentication = require('../../middlewares/auth');
const permission = require('../../middlewares/permission');
const checkInvalidBranch = require('../../middlewares/checkInvalidBranch');
const wardService = require('../../services/wardService');

const handleBizError = (res, err) => {
  if (err && err.status) return RestAPI.badRequest(res, err.message);
  console.log(err);
  return RestAPI.serverError(res, 'Internal server error');
};

const decorateDisplay = (row) => ({
  ...row,
  display_status: row.status == Constants.STATUS_ENUM.ACTIVE,
});

const getWardList = async (req, res) => {
  try {
    const {data, total} = await wardService.getList(req.query);
    return RestAPI.success(res, data.map(decorateDisplay), {total});
  } catch (err) {
    return handleBizError(res, err);
  }
};

const detailWard = async (req, res) => {
  try {
    const row = await wardService.getDetail(req.params.id);
    if (!row) return RestAPI.notFound(res, 'Ward not found');
    return RestAPI.success(res, row);
  } catch (err) {
    return handleBizError(res, err);
  }
};

const createWard = async (req, res) => {
  try {
    const row = await wardService.create(req.body);
    return RestAPI.success(res, row);
  } catch (err) {
    return handleBizError(res, err);
  }
};

const updateWard = async (req, res) => {
  try {
    const row = await wardService.update(req.params.id, req.body);
    return RestAPI.success(res, row);
  } catch (err) {
    return handleBizError(res, err);
  }
};

const updateActiveDeActiveWard = async (req, res) => {
  try {
    const row = await wardService.setActive(req.params.id, req.body.status);
    return RestAPI.success(res, row);
  } catch (err) {
    return handleBizError(res, err);
  }
};

const deleteWard = async (req, res) => {
  try {
    await wardService.remove(req.params.id);
    return RestAPI.success(res, 'Deleted');
  } catch (err) {
    return handleBizError(res, err);
  }
};

const checkCodeExistWard = async (req, res) => {
  try {
    const exists = await wardService.codeExists(req.params.code);
    return RestAPI.success(res, exists);
  } catch (err) {
    return handleBizError(res, err);
  }
};

router.get('/list', Authentication.authenticateToken, getWardList);
router.get(
  '/get-list',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('wardList'),
  getWardList,
);
router.post(
  '/create',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('wardCreate'),
  createWard,
);
router.post(
  '/active-deactive/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('wardEdit'),
  updateActiveDeActiveWard,
);
router.get(
  '/detail/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('wardEdit'),
  detailWard,
);
router.post(
  '/update/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('wardEdit'),
  updateWard,
);
router.post(
  '/delete/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('wardDelete'),
  deleteWard,
);
router.get(
  '/code-exist/:code',
  Authentication.authenticateToken,
  checkCodeExistWard,
);
module.exports = router;
