const crypto = require('crypto');
const config = require('../config/setting')();

const Constants = require('./constants');
const Common = require('./common');
const RestAPI = require('./rest_api');
const Captchapng = require('captchapng');
var moment = require('moment');

class Security {
  static hashSHA256(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  static hashPassword(password) {
    var text = password + config.pwd_extension;
    return Security.hashSHA256(text);
  }

  static generateCaptchaImage(req) {
    var random_num = parseInt(Math.random() * 9000 + 1000); //always 4 digits
    var p = new Captchapng(80, 30, random_num); // width,height,numeric captcha
    p.color(115, 95, 197, 100); // First color: background (red, green, blue, alpha)
    p.color(30, 104, 21, 255); // Second color: paint (red, green, blue, alpha)
    var img = p.getBase64(); //png
    //must save to session
    req.session[Constants.SESSION.KEY_CAPTCHA] = random_num + '';
    req.session[Constants.SESSION.SET_TIME_START_CAPTCHA] = new Date();
    req.session.save(); //clear after registration successfully
    return img;
  }

  static verifyCaptcha(req, res, next) {
    const captcha = req.body.captcha;

    const checkVerifyParam = Common.checkVerifyParams([captcha]);

    if (!checkVerifyParam) {
      return RestAPI.badRequest(res, Constants.MSG.MISMATCH_PARAMS_ERR);
    }

    if (captcha !== req.session[Constants.SESSION.KEY_CAPTCHA]) {
      return RestAPI.badRequest(res, Constants.MSG.WRONG_CAPTCHA);
    }
    var now = new Date().getTime();
    var createdCaptcha = Common.isEmpty(
      req.session[Constants.SESSION.SET_TIME_START_CAPTCHA],
    )
      ? new Date().getTime()
      : new Date(
          req.session[Constants.SESSION.SET_TIME_START_CAPTCHA],
        ).getTime();

    if (now - createdCaptcha > config.captchaExpiresIn * 1000) {
      return RestAPI.badRequest(res, Constants.MSG.CAPTCHA_IS_EXPIRED);
    }

    next();
  }

  static hexPassWordZip(dateTime) {
    var datePass = moment(dateTime).format('YY-MM-DD-HH-mm-ss');
    var arrPass = datePass.toString().split('-');
    var txtPass = '';
    for (var i = 0; i < arrPass.length; i++) {
      txtPass += Common.getCharacter(parseInt(arrPass[i]));
    }
    return txtPass;
  }
}

module.exports = Security;
