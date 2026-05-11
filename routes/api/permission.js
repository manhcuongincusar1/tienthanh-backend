const express = require('express');
const _ = require('lodash');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const Constants = require('../../common/constants');
const auth = require('../../middlewares/auth');
const permissionServices = require('../../services/permissionServices');
const {permissionSchema} = require('../../validation');
const Common = require('../../common/common');
const Validator = require('jsonschema').Validator;

router.post('/insert', auth.authenticateToken, insertPermission);
router.post('/update/:id', auth.authenticateToken, updatePermission);
router.get('/get', auth.authenticateToken, getPermissionsList);
router.get('/role', auth.authenticateToken, getPermissionsByRole);
router.get('/get/:id', auth.authenticateToken, getPermissionById);

async function getPermissionsByRole(req, res) {
  const {role} = req.auth;
  try {
    const response = await permissionServices.getPermissions(role);
    if (!response) {
      return RestAPI.notFound(res, 'Get list permission failed');
    }

    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function getPermissionsList(req, res) {
  try {
    const response = await permissionServices.getPermissionsList();
    if (!response) {
      return RestAPI.notFound(res, 'Get list permission failed');
    }

    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}
async function getPermissionById(req, res) {
  const {id} = req.params;
  const validator = new Validator();

  const resultValid = validator.validate(
    {id},
    permissionSchema.getPermissionByIdSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await permissionServices.getPermissionById(id);

    if (!response) {
      return RestAPI.notFound(res, 'Get permission is not found');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}
async function insertPermission(req, res) {
  try {
    const response = await permissionServices.insertPermission();

    if (!response) {
      return RestAPI.notFound(res, 'Permission is exist');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}
async function updatePermission(req, res) {
  const {permission_data, title} = req.body;
  const {id} = req.params;
  const validator = new Validator();

  const resultValid = validator.validate(
    {id, title},
    permissionSchema.updatePermissionByIdSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await permissionServices.updatePermission(
      {id: id, title: title},
      permission_data,
    );
    if (!response) {
      return RestAPI.notFound(res, 'Update permission failed');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

module.exports = router;
