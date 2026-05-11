const express = require('express');
const _ = require('lodash');
const generator = require('generate-password');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const accountService = require('../../services/accountService');
const {mailService} = require('../../services/mailService');
const permission = require('../../middlewares/permission');
const Authentication = require('../../middlewares/auth');
const Common = require('../../common/common');
const {accountSchema} = require('../../validation');
const {Validator} = require('jsonschema');
const Constants = require('../../common/constants');
const {createAccountTemplate} = require('../../common/templates/email');
const checkInvalidBranch = require('../../middlewares/checkInvalidBranch');

router.post(
  '/list',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  getListAccount,
);
router.post(
  '/get-list',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('accountList'),
  getListAccountManagement,
);
router.get(
  '/get/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('accountEdit'),
  getAccountById,
);
router.post(
  '/insert',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('accountCreate'),
  insertAccount,
);
router.post(
  '/update',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('accountEdit'),
  updateAccount,
);
router.get('/roles', Authentication.authenticateToken, getListRoles);
router.get(
  '/check-exist',
  Authentication.authenticateToken,
  checkUserNameExistByEmail,
);
router.get('/branches', Authentication.authenticateToken, getListBranches);
router.put(
  '/update-status/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('accountEdit'),
  updateStatusById,
);
router.put(
  '/update-password/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('accountChangePassword'),
  updatePasswordById,
);

async function getListAccount(req, res, next) {
  let {auth} = req;
  const {id, role} = auth;
  let {keyword, limit, offset, raw_phone_number, branch_id} = req.body;

  try {
    const {result, count} = await accountService.getAccounts({
      keyword,
      limit,
      offset,
      raw_phone_number,
      branch_id,
    });

    return RestAPI.success(res, result, {total: Number(count)});
  } catch (error) {
    return RestAPI.serverError(res);
  }
}

async function getListAccountManagement(req, res, next) {
  let {auth} = req;
  const {id, role} = auth;
  let {
    f_branches,
    f_province_cities,
    f_districts,
    f_roles,
    f_status,
    f_sell_price_from,
    f_sell_price_to,
    f_rent_price_from,
    f_rent_price_to,
    keyword,
    limit,
    offset,
    email,
    raw_phone_number,
    branch_id,
  } = req.body;

  try {
    const {result, count} = await accountService.getAccountsManagement(
      {
        f_branches,
        f_province_cities,
        f_districts,
        f_roles,
        f_status,
        f_sell_price_from,
        f_sell_price_to,
        f_rent_price_from,
        f_rent_price_to,
        keyword,
        limit,
        offset,
        email,
        raw_phone_number,
        branch_id,
      },
      {user_id: id, user_role: role},
    );

    return RestAPI.success(res, result, {total: Number(count)});
  } catch (error) {
    console.log(error);
    return RestAPI.serverError(res, error);
  }
}

async function getAccountById(req, res, next) {
  let {id: user_id, role} = req.auth;
  let {id} = req.params;

  const validator = new Validator();
  const resultValid = validator.validate(
    {id},
    accountSchema.getAccountByIdSchema,
  );

  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }

  try {
    if (role === 'sale') {
      return RestAPI.forbidden(res, 'forbidden');
    }
    const result = await accountService.getAccountById(id, {user_id, role});

    if (result === 'forbidden') {
      return RestAPI.forbidden(res, 'forbidden');
    }
    return RestAPI.success(res, result);
  } catch (error) {
    return RestAPI.serverError(res);
  }
}

async function checkUserNameExistByEmail(req, res) {
  const {user_id, raw_phone_number, email} = req.query;

  try {
    const response = await accountService.checkUserNameExistByEmail({
      user_id,
      raw_phone_number,
      email,
    });
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res);
  }
}

async function getListRoles(req, res, next) {
  let {auth} = req;
  const {getAll} = req.query;

  try {
    const result = await accountService.getListRoles(auth?.role, getAll);
    return RestAPI.success(res, result);
  } catch (error) {
    return RestAPI.serverError(res);
  }
}

async function getListBranches(req, res, next) {
  let {auth} = req;
  try {
    const result = await accountService.getListBranches();
    return RestAPI.success(res, result);
  } catch (error) {
    return RestAPI.serverError(res);
  }
}

async function insertAccount(req, res, next) {
  let {auth} = req;
  const {role: user_role, role_id, id: user_id} = auth;
  let {
    branch_id,
    districts,
    email,
    full_name,
    raw_phone_number,
    role,
    sell_price_range,
    rent_price_range,
  } = req.body;

  try {
    if (user_role === 'sale' || role_id === role) {
      return RestAPI.forbidden(res, 'forbidden');
    }
    const password = generator.generate({
      length: 6,
      numbers: true,
    });

    const result = await accountService.insertAccount(
      {
        branch_id,
        districts,
        email,
        full_name,
        raw_phone_number,
        role,
        sell_price_range,
        rent_price_range,
      },
      user_id,
    );
    if (result) {
      const response = await mailService.createMail({
        toMail: email,
        subject: 'Chào mừng tới hệ thống Tiến Thành',
        content: createAccountTemplate({full_name, email}),
      });
      return RestAPI.success(res);
    } else {
      return RestAPI.serverError(res);
    }
  } catch (error) {
    return RestAPI.serverError(res);
  }
}

async function updateAccount(req, res) {
  const validator = new Validator();
  const resultValid = validator.validate(
    req.body,
    accountSchema.updateAccountSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }

  try {
    const response = await accountService.updateAccount(req.body);
    if (!response) {
      return RestAPI.notFound(res, 'Not found');
    }
    RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function updateStatusById(req, res) {
  const {id} = req.params;
  const {status} = req.body;
  const {role} = req.auth;
  const validator = new Validator();
  const resultValid = validator.validate(
    req.body,
    accountSchema.updateStatusById,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await accountService.updateStatusById({id, status}, role);
    if (response === 'forbidden') {
      return RestAPI.forbidden(res, 'forbidden');
    }

    if (!response) {
      return RestAPI.badRequest();
    }
    RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function updatePasswordById(req, res) {
  const {id} = req.params;
  const {password} = req.body;
  const {role} = req.auth;
  const validator = new Validator();
  const resultValid = validator.validate(
    req.body,
    accountSchema.updatePasswordById,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await accountService.updatePasswordById(
      {id, password},
      role,
    );
    if (response === 'forbidden') {
      return RestAPI.forbidden(res, 'forbidden');
    }

    if (!response) {
      return RestAPI.badRequest();
    }
    RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

module.exports = router;
