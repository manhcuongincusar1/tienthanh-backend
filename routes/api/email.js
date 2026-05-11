const express = require('express');
const _ = require('lodash');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const {sendMail} = require('../../utils');
const {mailService} = require('../../services/mailService');
const Constants = require('../../common/constants');
const CryptoJS = require('crypto-js');
const userService = require('../../services/userService');
testMail = async (req, res, next) => {
  let {} = req.body;
  //   const listMailQueue = await mailService.createMail({
  //     toMail: 'tuanle@eossolutions.tech',
  //     subject: 'register success',
  //     content: 'This is content',
  //   });
  //   console.log(listMailQueue);
  return RestAPI.success(res, 'OK');
};
resetPassword = async (req, res) => {
  let {username} = req.body;

  const encrypter = CryptoJS.AES.encrypt(username, Constants.SECRET_KEY_DECRYPT)
    .toString()
    .replace(/\+/g, 'p1L2u3S')
    .replace(/\//g, 's1L2a3S4h')
    .replace(/=/g, 'e1Q2u3A4l');
  const response = await mailService
    .createMail({
      toMail: username,
      subject: 'Thay đổi mật khẩu',
      content: `<div>
        <h3>Xin chào ${username},</h3>
        <div style="font-size:14px">
          <p>Hệ thống nhận được thông báo đổi mật khẩu từ tài khoản này!</p>
          <p>Nếu không phải bạn, vui lòng bỏ qua email này.</p>
          <p style="display: inline">Bạn có thể truy cập vào link sau để đổi mật khẩu:</p>
          <a href="https://tita-qat.eos-solutions.asia/cms/user/reset-password?activation_key=${encrypter}">
            Đổi mật khẩu
          </a>
          <br />
          <p>Trân trọng,</p>
          <p>Tiến Thành system.</p>
        </div>
      </div>`,
    })
    .then(async (res) => {
      if (res.length > 0) {
        const response = await userService.updateActivationKey({
          username,
          activationKey: encrypter,
        });
        if (!response) {
          return false;
        }
        return response;
      }
    })
    .catch((err) => {
      return false;
    });

  if (!response) {
    return false;
  }

  return RestAPI.success(res, encrypter);
};
router.get('/test-mail', testMail);
router.post('/reset-password', resetPassword);
module.exports = router;
