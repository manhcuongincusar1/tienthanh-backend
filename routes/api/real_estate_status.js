const express = require('express');
const _ = require('lodash');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const auth = require('../../middlewares/auth');
const realEstateStatusService = require('../../services/realEstateStatusService');
const {Validator} = require('jsonschema');
const {realEstateStatusSchema} = require('../../validation');
const Common = require('../../common/common');
const permission = require('../../middlewares/permission');
const checkInvalidBranch = require('../../middlewares/checkInvalidBranch');

const Constants = require('../../common/constants');

/**
 *
 * @param req
 * @param res
 */
const getListRealEstateStatus = async (req, res) => {
  let {
    auth,
    query: {limit, offset, status, type, isEditableRe, isDefault, keyword},
  } = req;

  const result = await realEstateStatusService.getList({
    limit: limit || 10,
    offset,
    type,
    status,
    isEditableRe,
    isDefault,
    keyword,
  });
  if (!result) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  const {realEstateStatusList, count} = result;
  return RestAPI.success(res, realEstateStatusList, {
    total: count,
  });
};

const insertRealEstateStatus = async (req, res) => {
  let {auth} = req;
  let {
    title,
    type,
    isEditableRe,
    isDefault,
    isShowInternal,
    isAllowDuplicate,
    color,
  } = req.body;
  const validator = new Validator();
  const resultValid = validator.validate(
    {
      title,
      type,
      isEditableRe,
      isDefault,
      isShowInternal,
      isAllowDuplicate,
      color,
    },
    realEstateStatusSchema.realEstateStatusSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.badRequest(res, errors);
  }
  const result = await realEstateStatusService.insertOne({
    title,
    type,
    isEditableRe,
    isDefault,
    isShowInternal,
    isAllowDuplicate,
    color,
  });
  if (!result) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  return RestAPI.success(res, result);
};

const detailRealEstateStatus = async (req, res) => {
  let {auth} = req;
  let {id} = req.params;
  const result = await realEstateStatusService.detailOne(id);
  if (!result) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  return RestAPI.success(res, result);
};

const updateRealEstateStatus = async (req, res) => {
  let {auth} = req;
  let {id} = req.params;
  let {
    title,
    type,
    isEditableRe,
    isDefault,
    isShowInternal,
    isAllowDuplicate,
    status,
    color,
  } = req.body;
  const validator = new Validator();
  const resultValid = validator.validate(
    {
      title,
      type,
      isEditableRe,
      isDefault,
      isAllowDuplicate,
      isShowInternal,
      status: status,
      color,
    },
    realEstateStatusSchema.realEstateStatusSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.badRequest(res, errors);
  }

  const isDetail = await realEstateStatusService.detailOne(id);
  if (!isDetail) {
    return RestAPI.badRequest(res, `Real Estate Status: id ${id} not found`);
  }

  const {status: statusResult, result} =
    await realEstateStatusService.updateOne(id, {
      title,
      type,
      isEditableRe,
      isDefault,
      isAllowDuplicate,
      isShowInternal,
      status,
      color,
    });
  if (!statusResult) {
    return RestAPI.serverError(res, result);
  }
  return RestAPI.success(res, result);
};

const deleteRealEstateStatus = async (req, res) => {
  let {auth} = req;
  let {id} = req.params;
  const isDetail = await realEstateStatusService.detailOne(id);
  if (!isDetail) {
    return RestAPI.badRequest(res, `Real Estate Status: id ${id} not found`);
  }

  if (isDetail.is_default) {
    return RestAPI.badRequest(
      res,
      `Real Estate Status: id ${id} is default. Couldn't delete`,
    );
  }
  const result = await realEstateStatusService.deleteOne(id);
  if (!result) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  return RestAPI.success(res, {});
};

const checkIsEditableRealEstateStatus = async (req, res) => {
  let {auth} = req;
  let {id} = req.params;
  let {isEditableRe} = req.body;
  const validator = new Validator();
  const resultValid = validator.validate(
    {
      isEditableRe,
    },
    realEstateStatusSchema.isEditableRealEstateStatusSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.badRequest(res, errors);
  }

  const detail = await realEstateStatusService.detailOne(id);
  if (!detail) {
    return RestAPI.badRequest(res, `Real Estate Status: id ${id} not found`);
  }

  const {title, type} = detail;
  const {status: statusResult, result} =
    await realEstateStatusService.updateOne(id, {
      title,
      type,
      isEditableRe,
    });
  if (!statusResult) {
    return RestAPI.serverError(res, result);
  }
  return RestAPI.success(res, result);
};

const checkIsActiveDeActiveRealEstateStatus = async (req, res) => {
  let {auth} = req;
  let {id} = req.params;
  let {status} = req.body;
  const validator = new Validator();
  const resultValid = validator.validate(
    {
      status,
    },
    realEstateStatusSchema.activeDeActiveRealEstateStatusSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.badRequest(res, errors);
  }

  const detail = await realEstateStatusService.detailOne(id);
  if (!detail) {
    return RestAPI.badRequest(res, `Real Estate Status: id ${id} not found`);
  }

  const {type} = detail;
  const {status: statusResult, result} =
    await realEstateStatusService.updateOne(id, {
      type,
      status: status
        ? Constants.STATUS_ENUM.ACTIVE
        : Constants.STATUS_ENUM.PENDING,
    });
  if (!statusResult) {
    return RestAPI.serverError(res, result);
  }
  return RestAPI.success(res, result);
};

const checkIsDefaultRealEstateStatus = async (req, res) => {
  let {auth} = req;
  let {id} = req.params;
  let {isDefault} = req.body;
  const validator = new Validator();
  const resultValid = validator.validate(
    {
      isDefault,
    },
    realEstateStatusSchema.isDefaultRealEstateStatusSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.badRequest(res, errors);
  }

  const detail = await realEstateStatusService.detailOne(id);
  if (!detail) {
    return RestAPI.badRequest(res, `Real Estate Status: id ${id} not found`);
  }

  const {title, type, isEditableRe} = detail;
  const {status: statusResult, result} =
    await realEstateStatusService.updateOne(id, {
      title,
      type,
      isEditableRe,
      isDefault,
    });
  if (!statusResult) {
    return RestAPI.serverError(res, result);
  }
  return RestAPI.success(res, result);
};
const checkExistRealEstateStatus = async (req, res) => {
  const {title, current_status_id} = req.body;
  const validator = new Validator();
  const resultValid = validator.validate(
    {
      title,
      current_status_id,
    },
    realEstateStatusSchema.checkExistRealEstateStatusSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.badRequest(res, errors);
  }
  try {
    const response = await realEstateStatusService.checkExistRealEstateStatus(
      title,
      current_status_id,
    );
    if (!response) {
      return RestAPI.notFound(res, response);
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, error);
  }
};

router.post(
  '/check-duplicate',
  auth.authenticateToken,
  checkExistRealEstateStatus,
);
router.get('/list', auth.authenticateToken, getListRealEstateStatus);
router.get(
  '/get-list',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateStatusList'),
  getListRealEstateStatus,
);
router.post(
  '/create',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateStatusCreate'),
  insertRealEstateStatus,
);
router.get(
  '/detail/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateStatusEdit'),
  detailRealEstateStatus,
);
router.post(
  '/edit/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateStatusEdit'),
  updateRealEstateStatus,
);
router.delete(
  '/delete/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateStatusDelete'),
  deleteRealEstateStatus,
);
router.post(
  '/update-is-editable/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateStatusEdit'),
  checkIsEditableRealEstateStatus,
);
router.post(
  '/update-is-default/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateStatusEdit'),
  checkIsDefaultRealEstateStatus,
);
router.post(
  '/update-is-active-deactive/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateStatusEdit'),
  checkIsActiveDeActiveRealEstateStatus,
);
module.exports = router;
