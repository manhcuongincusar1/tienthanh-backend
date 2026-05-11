const express = require('express');
const _ = require('lodash');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const userService = require('../../services/userService');
const settingService = require('../../services/settingServices');
const {userSchema} = require('../../validation');
const Common = require('../../common/common');
const Security = require('../../common/security');
const Validator = require('jsonschema').Validator;
const auth = require('../../middlewares/auth');

router.post('/check-exist', checkUserExist);

router.post('/check-activation-key', checkTokenResetPassword);

router.post('/reset-password', resetPassword);

router.post('/change-password', auth.authenticateToken, changePassword);
router.post('/change-password-first', changePasswordFirst);

router.get('/personal-info', auth.authenticateToken, getPersonalInfo);

router.post('/check-phone', auth.authenticateToken, checkPhoneExist);

router.put('/update-url-avatar', auth.authenticateToken, updateUrlAvatar);

router.post(
  '/update-personal-info',
  auth.authenticateToken,
  updatePersonalInfo,
);

router.get(
  '/search-info',
  auth.authenticateToken,
  getUserInfoToAssignRealEstate,
);

router.get('/get-role', auth.authenticateToken, getRole);

async function getRole(req, res) {
  try {
    const response = await userService.getRole();
    if (!response) {
      return RestAPI.notFound(res, 'Get role not found');
    }

    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function checkUserExist(req, res) {
  const {username} = req.body;
  const validator = new Validator();
  const resultValid = validator.validate(
    req.body,
    userSchema.checkUserExistSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await userService.checkUserExist({username: username});

    if (!response) {
      return RestAPI.notFound(res, 'User not exist');
    }
    if (response.status === 1) {
      return RestAPI.success(res, {username: response.username, active: true});
    }

    return RestAPI.partialContent(res, {
      username: response.username,
      active: false,
    });
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}
async function checkTokenResetPassword(req, res) {
  const {activation_key} = req.body;
  const validator = new Validator();
  const resultValid = validator.validate(
    {activation_key},
    userSchema.checkTokenResetPasswordSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await userService.checkTokenResetPassword({
      activation_key: activation_key,
    });
    if (!response) {
      return RestAPI.notFound(res, 'Token expire');
    }
    res.json({
      data: 'ok',
      status: 200,
      message: 'Token valid',
    });
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}
async function resetPassword(req, res) {
  const {activation_key, password} = req.body;
  const validator = new Validator();
  const resultValid = validator.validate(
    {activation_key, password},
    userSchema.resetPasswordSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  const passwordRaw = Common.decryptPassword(password);
  const passwordHash = Security.hashPassword(passwordRaw);
  try {
    const response = await userService.resetPassword({
      activation_key: activation_key,
      password: passwordHash,
    });
    if (!response) {
      return RestAPI.notFound(res, 'Token expire');
    }
    res.json({
      data: 'ok',
      status: 200,
      message: 'Token valid',
    });
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}
async function changePassword(req, res) {
  const {password, new_password} = req.body;
  const {username} = req.auth;
  const validator = new Validator();
  const resultValid = validator.validate(
    {new_password, username, password},
    userSchema.changePasswordSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const passwordRaw = Common.decryptPassword(password);
    const passwordHash = Security.hashPassword(passwordRaw);
    const newPasswordRaw = Common.decryptPassword(new_password);
    const newPasswordHash = Security.hashPassword(newPasswordRaw);

    const response = await userService
      .checkPassword({username, password: passwordHash})
      .then(async (res) => {
        if (res) {
          const response = await userService.updatePassword({
            username,
            new_password: newPasswordHash,
          });
          return response;
        }
        return res;
      })
      .catch((err) => {
        return RestAPI.notFound(res, 'Password incorrect');
      });
    if (!response) {
      return RestAPI.notFound(res, 'Password incorrect');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function changePasswordFirst(req, res) {
  const {new_password, username} = req.body;

  const validator = new Validator();

  const resultValid = validator.validate(
    {new_password, username},
    userSchema.changePasswordFirstSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const newPasswordRaw = Common.decryptPassword(new_password);
    const newPasswordHash = Security.hashPassword(newPasswordRaw);

    const response = await userService.updatePassword({
      username,
      new_password: newPasswordHash,
    });

    if (!response) {
      return RestAPI.notFound(res, 'Password incorrect');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}
async function getPersonalInfo(req, res) {
  const {id, username, permissionInfo} = req.auth;
  try {
    const response = await userService.getPersonalInfo({
      id: id,
      username,
      permissionInfo: permissionInfo,
    });

    if (!response) {
      return RestAPI.notFound(res, 'User not found');
    }

    RestAPI.success(res, {
      ...response,
      avatar: response?.avatar,
    });
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}
async function checkPhoneExist(req, res) {
  const {username, raw_phone_number} = req.body;

  const validator = new Validator();
  const resultValid = validator.validate(
    {raw_phone_number, username},
    userSchema.checkPhoneExist,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await userService.checkPhoneExist({
      username,
      raw_phone_number,
    });
    if (!response) {
      return RestAPI.notFound(res, 'Phone already exists');
    }
    RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}
async function updatePersonalInfo(req, res) {
  const {username, raw_phone_number, full_name} = req.body;
  const validator = new Validator();
  const resultValid = validator.validate(
    {raw_phone_number, username, full_name},
    userSchema.updatePersonalInfo,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await userService.updatePersonalInfo({
      username,
      raw_phone_number,
      full_name,
    });
    if (!response) {
      return RestAPI.notFound(res, 'User not found');
    }
    RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}
async function updateUrlAvatar(req, res) {
  const {username} = req.auth;
  const {path} = req.body;

  try {
    const response = await userService
      .updateUrlAvatar({username, path})
      .catch((err) => {
        console.log(err);
      });

    if (!response) {
      return RestAPI.notFound(res, 'User not found');
    }
    RestAPI.success(
      res,
      response.avatar || 'upload/files/default/default_avatar.jpeg',
    );
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function getUserInfoToAssignRealEstate(req, res) {
  try {
    const {keyword, branch_id} = req.query;
    const response = await userService.getUserInfoToAssignRealEstate(
      keyword,
      branch_id,
    );
    if (!response) {
      return RestAPI.notFound(res, 'Not found broker by id');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

module.exports = router;
