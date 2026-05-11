const express = require('express');
const _ = require('lodash');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const auth = require('../../middlewares/auth');
const realEstateCategoryService = require('../../services/realEstateCategoryService');
const {Validator} = require('jsonschema');
const {realEstateCategorySchema} = require('../../validation');
const Common = require('../../common/common');
const Constants = require('../../common/constants');
const permission = require('../../middlewares/permission');
const checkInvalidBranch = require('../../middlewares/checkInvalidBranch');

/**
 *
 * @param req
 * @param res
 */
const getListRealEstateCategory = async (req, res) => {
  let {
    auth,
    query: {limit, offset, status, keyword},
  } = req;

  const result = await realEstateCategoryService.getList({
    limit: limit || 10,
    offset,
    status,
    keyword,
  });

  if (!result) {
    return RestAPI.serverError(res, 'Internal server error');
  }

  const {realEstateCategoryList, count} = result;
  return RestAPI.success(res, realEstateCategoryList, {
    total: count,
  });
};

const insertRealEstateCategory = async (req, res) => {
  let {auth} = req;
  let {title, status} = req.body;
  const validator = new Validator();
  const resultValid = validator.validate(
    {
      title,
      status,
    },
    realEstateCategorySchema.realEstateCategorySchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.badRequest(res, errors);
  }
  const result = await realEstateCategoryService.insertOne({
    title,
    status,
  });
  if (!result) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  return RestAPI.success(res, result);
};

const detailRealEstateCategory = async (req, res) => {
  let {auth} = req;
  let {id} = req.params;
  const result = await realEstateCategoryService.detailOne(id);
  if (!result) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  return RestAPI.success(res, result);
};

const updateRealEstateCategory = async (req, res) => {
  let {auth} = req;
  let {id} = req.params;
  let {title, status} = req.body;
  const validator = new Validator();
  const resultValid = validator.validate(
    {
      title,
      status,
    },
    realEstateCategorySchema.realEstateCategorySchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.badRequest(res, errors);
  }

  const isDetail = await realEstateCategoryService.detailOne(id);
  if (!isDetail) {
    return RestAPI.badRequest(res, `Real Estate Category: id ${id} not found`);
  }

  const {status: statusResult, result} =
    await realEstateCategoryService.updateOne(id, {
      title,
      status,
    });
  if (!statusResult) {
    return RestAPI.serverError(res, result);
  }
  return RestAPI.success(res, result);
};

const deleteRealEstateCategory = async (req, res) => {
  let {auth} = req;
  let {id} = req.params;
  const isDetail = await realEstateCategoryService.detailOne(id);
  if (!isDetail) {
    return RestAPI.badRequest(res, `Real Estate Category: id ${id} not found`);
  }

  if (isDetail.is_default) {
    return RestAPI.badRequest(
      res,
      `Real Estate Category: id ${id} is default. Couldn't delete`,
    );
  }
  const result = await realEstateCategoryService.deleteOne(id);
  if (!result) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  return RestAPI.success(res, {});
};

const updateActiveDeActiveRealEstateCategory = async (req, res) => {
  let {auth} = req;
  let {id} = req.params;
  let {status} = req.body;
  const validator = new Validator();
  const resultValid = validator.validate(
    {
      status,
    },
    realEstateCategorySchema.activeDeActiveRealEstateCategorySchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.badRequest(res, errors);
  }

  const detail = await realEstateCategoryService.detailOne(id);
  if (!detail) {
    return RestAPI.badRequest(res, `Real Estate Category: id ${id} not found`);
  }

  const {status: statusResult, result} =
    await realEstateCategoryService.updateOne(id, {
      status: status
        ? Constants.STATUS_ENUM.ACTIVE
        : Constants.STATUS_ENUM.PENDING,
    });
  if (!statusResult) {
    return RestAPI.serverError(res, result);
  }
  return RestAPI.success(res, result);
};
const checkDuplicateRealEstateCategory = async (req, res) => {
  const {title, current_category_id} = req.body;
  const validator = new Validator();
  const resultValid = validator.validate(
    {
      title,
      current_category_id,
    },
    realEstateCategorySchema.checkDuplicateRealEstateCategorySchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.badRequest(res, errors);
  }
  try {
    const response =
      await realEstateCategoryService.checkDuplicateRealEstateCategory(
        title,
        current_category_id,
      );
    if (!response) {
      return RestAPI.notFound(res, response);
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, error);
  }
};

router.get('/list', auth.authenticateToken, getListRealEstateCategory);
router.get(
  '/get-list',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateCategoryCreate'),
  getListRealEstateCategory,
);
router.post(
  '/create',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateCategoryCreate'),
  insertRealEstateCategory,
);
router.post(
  '/check-duplicate',
  auth.authenticateToken,
  checkDuplicateRealEstateCategory,
);
router.get(
  '/detail/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateCategoryEdit'),
  detailRealEstateCategory,
);
router.post(
  '/edit/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateCategoryEdit'),
  updateRealEstateCategory,
);
router.delete('/delete/:id', auth.authenticateToken, deleteRealEstateCategory);
router.post(
  '/active-deactive/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateCategoryEdit'),
  updateActiveDeActiveRealEstateCategory,
);
module.exports = router;
