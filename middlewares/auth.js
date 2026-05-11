var RestApi = require('../common/rest_api');
var Constants = require('../common/constants');
var Common = require('../common/common');
const AuthCommon = require('../common/auth');

class Auth {
  static authenticateToken(req, res, next) {
    return AuthCommon.checkTokenApi(req, res, next);
  }
}

module.exports = Auth;
