var express = require('express');
var router = express.Router();
const RestAPI = require('../../common/rest_api');
const Constants = require('../../common/constants');
var p = require('path');
const Auth = require('../../common/auth');
const Common = require('../../common/common');
const userService = require('../../services/userService');
const _ = require('lodash');
const Validator = require('jsonschema').Validator;
const {authSchema} = require('../../validation');
const Security = require('../../common/security');
const accountService = require('../../services/accountService');
const permissionService = require('../../services/permissionServices');
const domainServices = require('../../services/domainServices');

const authenticateUser = async (req, res, next) => {
  const validator = new Validator();
  console.log(req.body);
  try {
    let {username, password} = req.body;

    const passwordRaw = Common.decryptPassword(password);
    const passwordHash = Security.hashPassword(passwordRaw);

    const resultValid = validator.validate(
      {
        username,
        password: passwordHash,
      },
      authSchema.LoginSchema,
    );
    if (!resultValid.valid) {
      return res.json({
        errors_message: resultValid.errors[0].message,
        success: false,
      });
    }
    const data = await userService.loginUser({
      username,
      password: passwordHash,
    });

    if (!_.isUndefined(data) && data.active === true) {
      let token = Auth.generateAccessTokenExpiresTime(data.data);
      await accountService.updateLastLogin({username});

      return RestAPI.success(res, {
        token: token.token,
        expiresIn: token.expiresIn,
        active: true,
        update_password: data?.data?.update_password,
      });
    } else if (!_.isUndefined(data) && data.active === false) {
      return RestAPI.partialContent(res, {active: false});
    }
    return RestAPI.forbidden(
      res,
      Constants.MSG.INVALID_USERNAME_OR_PASSWORD_ERR,
    );
  } catch (error) {
    return RestAPI.serverError(res, Constants.MSG.SERVER_ERR, error);
  }
};

const infoUser = async (req, res, next) => {
  try {
    const {auth} = req;
    const {role} = auth;
    if (!auth.role_id) {
      return RestAPI.notFound(res, 'User not found');
    }

    const domainSetting = await domainServices.getDomainInfo(
      Constants.DOMAIN_INFO,
    );

    const data = await userService.getUserInfo(auth);
    let branches = _.intersectionWith(
      domainSetting.branches,
      data.branch_id,
      _.isEqual,
    );
    if (role === 'super_admin') {
      branches = domainSetting.branches;
    }
    const permission_data = await permissionService.getPermissions(auth.role);

    RestAPI.success(res, {
      ...data,
      branch_id: branches,
      permission_data: permission_data?.permission_data,
    });
  } catch (error) {
    console.log(error);
    return RestAPI.serverError(res, Constants.MSG.SERVER_ERR, error);
  }
};

router.post('/generate', authenticateUser);
router.get('/get-login-info', Auth.checkTokenApi, infoUser);

router.post('/update-token', async function (req, res) {
  try {
    var params = req.body;
    var userID = params.user_id !== undefined ? params.user_id : '';
    const checkVerifyParam = Common.checkVerifyParams([userID]);
    if (!checkVerifyParam) {
      RestAPI.badRequest(res, Constants.MSG.MISMATCH_PARAMS_ERR);
      return;
    }

    var variables = {
      where_key: {
        key: {_eq: 'TOKEN_EXPIRED_TIME_DAYS'},
      },
    };
    var objData = await Common.getSettings(variables);
    objData = objData ? objData[0] : null;
    if (objData != undefined && objData != null) {
      var date = new Date();
      var expired_time = parseInt(objData.value); // đơn vị là ngày
      var end_time = new Date(
        date.getTime() + expired_time * 24 * 60 * 60 * 1000,
      );
      var userToken = Auth.generateAccessToken({
        user_id: userID,
        expired_time: end_time.toUTCString(),
      });
      var variablesToken = {
        objects: {
          user_id: userID,
          token: userToken.token,
          expired_time: end_time,
          created_date: date.toUTCString(),
          modified_date: date.toUTCString(),
          status: 1,
        },
      };
      var payloadToken = {
        query:
          'mutation MyMutation($objects: [core_user_token_insert_input!]!) { insert_core_user_token(objects: $objects) { affected_rows } }',
        variables: JSON.stringify(variablesToken),
      };
      await Hasura.execute(payloadToken);
    }
    RestAPI.success(res, 'OK');
  } catch (error) {
    return RestAPI.serverError(res, Constants.MSG.SERVER_ERR, error);
  }
});

router.post('/permission-update', async function (req, res) {
  try {
    var params = req.body;
    var id = params.id !== undefined ? params.id : 0;
    var type = params.type !== undefined ? params.type : 'web';
    var config = params.config !== undefined ? params.config : '';
    if (id == 0 || config == '') {
      RestAPI.badRequest(res, Constants.MSG.MISMATCH_PARAMS_ERR);
      return;
    }
    var variables = {
      where_key: {
        id: {_eq: id},
        type: {_eq: type},
      },
      data_update: {
        config: config,
      },
    };
    var payload = {
      query:
        'mutation MyMutation($where_key: core_permission_bool_exp!, $data_update: core_permission_set_input) { update_core_permission(where: $where_key, _set: $data_update) { affected_rows } }',
      variables: JSON.stringify(variables),
    };

    var results = await Hasura.execute(payload);
    RestAPI.success(res, results);
  } catch (error) {
    return RestAPI.serverError(res, Constants.MSG.SERVER_ERR, error);
  }
});

module.exports = router;
