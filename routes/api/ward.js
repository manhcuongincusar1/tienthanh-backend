// Ward CRUD route — in-process implementation (no HTTP proxy to admin service).
const express = require('express');
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

const normalizeBodyStatus = (status) => {
  if (status === undefined) return undefined;
  if (typeof status === 'boolean') return status ? Constants.STATUS_ENUM.ACTIVE : Constants.STATUS_ENUM.PENDING;
  return Number(status);
};

const decorateDisplay = (row) => ({
  ...row,
  display_status: Number(row.status) === Constants.STATUS_ENUM.ACTIVE,
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
    const row = await wardService.getDetail(req.params.id, {
      languageCode: req.query.languageCode || 'vi',
      includeStreet: req.query.streets,
    });
    if (!row) return RestAPI.notFound(res, 'Ward not found');
    return RestAPI.success(res, decorateDisplay(row));
  } catch (err) {
    return handleBizError(res, err);
  }
};

const createWard = async (req, res) => {
  try {
    const row = await wardService.create({
      ...req.body,
      status: normalizeBodyStatus(req.body.status),
    });
    return RestAPI.success(res, decorateDisplay(row));
  } catch (err) {
    return handleBizError(res, err);
  }
};

const updateWard = async (req, res) => {
  try {
    const row = await wardService.update(req.params.id, {
      ...req.body,
      status: normalizeBodyStatus(req.body.status),
    });
    return RestAPI.success(res, decorateDisplay(row));
  } catch (err) {
    return handleBizError(res, err);
  }
};

const updateActiveDeActiveWard = async (req, res) => {
  try {
    const row = await wardService.setActive(req.params.id, normalizeBodyStatus(req.body.status));
    return RestAPI.success(res, decorateDisplay(row));
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
    return RestAPI.success(res, {result: exists});
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
router.get('/code-exist/:code', Authentication.authenticateToken, checkCodeExistWard);
module.exports = router;
