var jwt = require('jsonwebtoken');
var config = require('../config/setting')();
var Constants = require('../common/constants');
var Common = require('../common/common');
var RestApi = require('./rest_api');
const saleService = require('../services/saleService');
const userService = require('../services/userService');

class Auth {
  static authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null)
      return RestApi.unauthorized(res, Constants.MSG.INVALID_TOKEN_ERR);
    jwt.verify(token, config.token.secret, async (err, user) => {
      if (err)
        return RestApi.unauthorized(res, Constants.MSG.INVALID_TOKEN_ERR);
      const userIsActive =
        user?.id && (await userService.checkUserIsActive(user.id));

      if (!userIsActive) {
        return RestApi.unauthorized(res, 'user_not_active');
      }
      const permissionInfo = await saleService.getSaleInfo(user?.id);

      req.auth = {...user, permissionInfo};

      return next();
    });
  }
  static generateAccessToken(params) {
    return {
      token: jwt.sign(params, config.token.secret),
    };
  }

  static generateAccessTokenExpiresTime(params) {
    return {
      token: jwt.sign(params, config.token.secret, {
        expiresIn: config.token.expiresIn + 's',
      }),
      expiresIn: new Date().getTime() + config.token.expiresIn * 1000,
    };
  }

  static getToken(req) {
    var headers = req.headers;
    var authorization = 'authorization';
    var bearerToken =
      headers[
        Object.keys(headers).find(
          (key) => key.toLowerCase() === authorization.toLowerCase(),
        )
      ];
    if (!Common.isEmpty(bearerToken)) {
      bearerToken = bearerToken.split(' ')[1];
      bearerToken = bearerToken ? bearerToken.trim() : '';
    } else {
      bearerToken = '';
    }
    return bearerToken;
  }

  // static async getUserByUid (uid) {
  //     return await admin
  //         .auth()
  //         .getUser(uid);
  // }

  static checkTokenApi(req, res, next) {
    var token = Auth.getToken(req);
    if (Common.isEmpty(token)) {
      RestApi.unauthorized(res, Constants.MSG.INVALID_TOKEN_ERR);
    }
    Auth.authenticateToken(req, res, next);
  }

  // static async createCustomToken(userId, additionalClaims) {
  //     return await admin
  //         .auth()
  //         .createCustomToken(userId, additionalClaims);
  // }
}

module.exports = Auth;
