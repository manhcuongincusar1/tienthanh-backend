const express = require('express');
const router = express.Router();
const branchesService = require('../../services/branchesService');
const domainServices = require('../../services/domainServices');
const RestAPI = require('../../common/rest_api');
const auth = require('../../middlewares/auth');
const Common = require('../../common/common');
const {branchesSchema} = require('../../validation');
const Validator = require('jsonschema').Validator;
const permission = require('../../middlewares/permission');
const Constants = require('../../common/constants');
const _ = require('lodash');
router.get(
  '/get-list',
  auth.authenticateToken,
  permission('branchList'),
  getBranchesList,
);
router.post(
  '/create',
  auth.authenticateToken,
  permission('branchCreate'),
  createBranch,
);
router.put(
  '/delete/:id',
  auth.authenticateToken,
  permission('branchDelete'),
  deleteBranchById,
);
router.put(
  '/update/:id',
  auth.authenticateToken,
  permission('branchEdit'),
  updateBranchById,
);
router.put('/update-status/:id', auth.authenticateToken, updateStatusById);
router.post('/check-tax', auth.authenticateToken, checkDuplicateCodeTax);

async function getBranchesList(req, res) {
  const validator = new Validator();
  const {
    offset,
    province_city_id,
    district_id,
    ward_id,
    limit,
    keyword,
    status,
  } = req.query;

  const body = {
    offset: limit && Number(offset),
    province_city_id: province_city_id && Number(province_city_id),
    district_id: district_id && Number(district_id),
    ward_id: ward_id && Number(ward_id),
    limit: limit && Number(limit),
    keyword,
  };

  const resultValid = validator.validate(
    body,
    branchesSchema.getBranchesListSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const data = await branchesService
      .getBranchesList({...body, status})
      .catch((err) => {
        return false;
      });
    if (!data) {
      return RestAPI.notFound(res, 'Branches List Not Found');
    }
    res.json({data: data, status: 200, message: 'Get Branches List Success'});
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function deleteBranchById(req, res) {
  const {id} = req.params;
  const validator = new Validator();
  const resultValid = validator.validate(
    {id: id},
    branchesSchema.deletebranchByIdSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await branchesService.deleteBranchById(id).catch((err) => {
      return false;
    });
    if (!response) {
      return RestAPI.notFound(res, 'Branch notFound');
    }
    RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function updateBranchById(req, res) {
  const validator = new Validator();
  const {id} = req.params;
  const resultValid = validator.validate(
    {id: id, ...req.body},
    branchesSchema.updatebranchByIdSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await branchesService.updateBranchById({
      id: id,
      ...req.body,
    });
    if (!response) {
      return RestAPI.notFound(res, 'Branch not found');
    }
    RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function createBranch(req, res) {
  const validator = new Validator();

  const resultValid = validator.validate(
    {...req.body},
    branchesSchema.createBranchSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await branchesService.createBranch({
      ...req.body,
    });
    if (!response) {
      return RestAPI.notFound(res, 'Create branch failed');
    }
    RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function updateStatusById(req, res) {
  const {id} = req.params;
  const {status} = req.body;
  const validator = new Validator();
  const resultValid = validator.validate(
    req.body,
    branchesSchema.updateStatusById,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await branchesService.updateStatusById(id, status);
    if (!response) {
      return RestAPI.notFound(res, 'Create branch failed');
    }
    RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function checkDuplicateCodeTax(req, res) {
  const validator = new Validator();
  const {tax} = req.body;

  const resultValid = validator.validate({tax}, branchesSchema.checkCodeTax);
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await branchesService.checkDuplicateCodeTax({tax});
    if (response) {
      return res.json({status: 204, message: 'Tax already', data: response.id});
    }
    return RestAPI.success(res, 'Tax not duplicate');
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

/**
 * Get a List of Workspaces for Users to use
 * @param req
 * @param res
 * @returns {Promise<void>}
 */
const getWorkSpaceList = async (req, res) => {
  const {} = req.query;

  const {
    permissionInfo,
    id: user_id,
    branch_id: listWorkSpace,
    role,
  } = req.auth;

  try {
    const domainSetting = await domainServices.getDomainInfo(
      Constants.DOMAIN_INFO,
    );

    let workSpaceByUser = [];
    if (!_.isEmpty(domainSetting)) {
      workSpaceByUser = _.intersectionWith(
        domainSetting.branches,
        listWorkSpace,
        _.isEqual,
      );
      if (role === 'super_admin') {
        workSpaceByUser = domainSetting.branches;
      }
    } else {
      workSpaceByUser = listWorkSpace;
    }

    const data = await branchesService.getBranchesList({
      ids: workSpaceByUser,
    });

    return RestAPI.success(res, data);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
};
router.get('/workspace', auth.authenticateToken, getWorkSpaceList);
module.exports = router;
