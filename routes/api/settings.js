const express = require('express');
const _ = require('lodash');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const Constants = require('../../common/constants');
const auth = require('../../middlewares/auth');
const settingServices = require('../../services/settingServices');
const permission = require('../../middlewares/permission');
const checkInvalidBranch = require('../../middlewares/checkInvalidBranch');

router.post(
  '/insert',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('settingEdit'),
  insertSetting,
);
router.post(
  '/update',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('settingEdit'),
  updateSetting,
);
router.get('/get', auth.authenticateToken, checkInvalidBranch(), getSetting);

async function getSetting(req, res) {
  const {key} = req.params;
  try {
    const response = await settingServices.getSetting(key);
    if (!response) {
      return RestAPI.notFound(res, 'Insert setting failed');
    }
    RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function insertSetting(req, res) {
  try {
    const data = req.body;
    const response = await settingServices.insertSetting(data);
    if (!response) {
      return RestAPI.notFound(res, 'Insert setting failed');
    }
    RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}
async function updateSetting(req, res) {
  const {data} = req.body;
  try {
    const response = await settingServices.updateSetting(data);
    if (!response) {
      return RestAPI.notFound(res, 'Insert setting failed');
    }
    RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

module.exports = router;
