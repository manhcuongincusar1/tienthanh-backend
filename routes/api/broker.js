const express = require('express');
const _ = require('lodash');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const auth = require('../../middlewares/auth');
const brokerService = require('../../services/brokerService');
const permission = require('../../middlewares/permission');
const {customerSchema} = require('../../validation');
const {brokerSchema} = require('../../validation');
const Validator = require('jsonschema').Validator;
const Common = require('../../common/common');
const checkInvalidBranch = require('../../middlewares/checkInvalidBranch');

router.post('/insert', auth.authenticateToken, insertBroker);
router.get(
  '/check-duplicate-phone-number',
  auth.authenticateToken,
  checkDuplicateBrokerPhoneNumber,
);

router.get(
  '/check-phone-number-match-full-name',
  auth.authenticateToken,
  checkBrokerPhoneNumberMatchFullName,
);

router.get(
  '/phone-number-list',
  auth.authenticateToken,
  getListPhoneNumberByCreatorId,
);

router.get(
  '/list',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('brokerList'),
  getBrokerList,
);

router.get(
  '/item/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('brokerEdit'),
  getBrokerById,
);

router.put(
  '/update/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('brokerEdit'),
  updateBrokerById,
);

router.get(
  '/check-phone-number',
  auth.authenticateToken,
  checkExistPhoneNumber,
);

async function insertBroker(req, res) {
  try {
    const dataInsert = req.body;
    const {id} = req?.auth;
    const response = await brokerService.insertBroker({
      ...dataInsert,
      creator_id: id,
    });
    if (!response) {
      return RestAPI.notFound(res, 'Insert broker failed');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    console.log(error);
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function checkBrokerPhoneNumberMatchFullName(req, res) {
  try {
    const dataCheck = req.body;
    const {id} = req?.auth;
    const response = await brokerService.checkBrokerPhoneNumberMatchFullName({
      ...dataCheck,
      creator_id: id,
    });

    if (!response) {
      return RestAPI.notFound(
        res,
        'Check broker phone number match full name duplicate failed',
      );
    }
    return RestAPI.success(res, response);
  } catch (error) {
    console.log(error);
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function checkDuplicateBrokerPhoneNumber(req, res) {
  try {
    const dataCheck = req.body;
    const {id} = req?.auth;
    const response = await brokerService.checkDuplicateBrokerPhoneNumber({
      ...dataCheck,
      creator_id: id,
    });

    if (!response) {
      return RestAPI.notFound(
        res,
        'Check duplicate broker phone number failed',
      );
    }
    return RestAPI.success(res, response);
  } catch (error) {
    console.log(error);
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function getListPhoneNumberByCreatorId(req, res) {
  try {
    const {id} = req.auth;
    const {keyword, branch_id} = req.query;

    const response = await brokerService.getListPhoneNumberByCreatorId(
      id,
      keyword,
      branch_id,
    );
    if (!response) {
      return RestAPI.notFound(res, 'Not found list phone broker by creator id');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    console.log(error);
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function getBrokerList(req, res) {
  try {
    const {params} = req.query;
    const {permissionInfo, id} = req.auth;
    const newParams = params && JSON.parse(params);
    const response = await brokerService.getBrokerList(newParams, {
      ...permissionInfo,
      user_id: id,
    });
    if (!response) {
      return RestAPI.notFound(res, 'Not found broker list');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    console.log(error);
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function getBrokerById(req, res) {
  const {id} = req.params;
  const {id: user_id, permissionInfo} = req.auth;
  const validator = new Validator();
  const resultValid = validator.validate({id}, brokerSchema.getBrokerById);
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await brokerService.getBrokerById(id, {
      user_id,
      permissionInfo,
    });
    if (!response) {
      return RestAPI.notFound(res, 'Not found broker by id');
    }
    if (response === 'forbidden') {
      return RestAPI.forbidden(res, 'forbidden');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    console.log(error);
    RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function checkExistPhoneNumber(req, res) {
  try {
    const {broker_id, phone_number} = req.query;
    const {id} = req.auth;

    const response = await brokerService.checkExistPhoneNumber(
      {
        broker_id,
        phone_number,
      },
      id,
    );

    if (!response) {
      return RestAPI.notFound(res, 'Not found broker by id');
    }

    return RestAPI.success(res, response);
  } catch (error) {
    console.log(error);
    RestAPI.serverError(res, 'Internal server error', error);
  }
}

const getTransactionHistory = async (req, res) => {
  const validator = new Validator();
  const {broker_id, offset, limit, sorter} = req.query;
  const {id, role} = req.auth;
  const body = {
    broker_id: broker_id,
    offset: Number(offset),
    limit: Number(limit),
    sorter: JSON.parse(sorter),
  };

  const resultValid = validator.validate(
    body,
    customerSchema.getTransactionHistorySchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await brokerService.getTransactionHistory({
      role,
      creator_sale_id: id,
      ...body,
    });

    if (!response) {
      return RestAPI.notFound(res, 'Get transaction history not found');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
};

async function updateBrokerById(req, res) {
  try {
    const {full_name, phone_number, phone_number_sub_list} = req.body;
    const {id} = req.params;

    const response = await brokerService.updateBrokerById(
      {
        full_name: full_name,
        phone_number: phone_number,
        phone_number_sub_list: phone_number_sub_list,
      },
      id,
    );
    if (!response) {
      return RestAPI.notFound(res, 'Not found broker by id');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    console.log(error);
    RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function getSaleListCreatBroker(req, res) {
  try {
    const {permissionInfo} = req.auth;
    let response;
    if (!permissionInfo?.is_sale) {
      response = await brokerService.getSaleListCreatBroker();
    }

    if (!response) {
      return RestAPI.notFound(res, 'Not found broker by id');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    console.log(error);
    RestAPI.serverError(res, 'Internal server error', error);
  }
}

router.get('/sale-list', auth.authenticateToken, getSaleListCreatBroker);

router.get(
  '/get-transaction-history',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('brokerEdit'),
  getTransactionHistory,
);

module.exports = router;
