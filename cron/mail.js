const {mailService, MAIL_STATUS_ENUM} = require('../services/mailService');
const _ = require('lodash');
const dayjs = require('dayjs');
const nodemailer = require('nodemailer');
const {MAIL_CONSTANT} = require('../common/constants');

async function sendMailQueue() {
  const listMailQueue = await mailService.getListWaitingMailQueue({});
  const listSendingMailToCheck = await mailService.getListSendingMailToCheck(
    {},
  );
  if (!_.isEmpty(listSendingMailToCheck)) {
    const listId = _.values(
      _.mapValues(listSendingMailToCheck, (mailData) => {
        return mailData.id;
      }),
    );
    await mailService.updateMail(
      {listId: listId},
      {
        process_status: MAIL_STATUS_ENUM.FAIL,
        modification_date: dayjs().utc(),
      },
    );
  }
  let transporter = nodemailer.createTransport({
    host: MAIL_CONSTANT.host,
    port: MAIL_CONSTANT.port,
    secure: MAIL_CONSTANT.secure, // true for 465, false for other ports
    auth: {
      user: MAIL_CONSTANT.auth.user, // generated ethereal user
      pass: MAIL_CONSTANT.auth.pass, // generated ethereal password
    },
  });
  if (!_.isEmpty(listMailQueue)) {
    const listId = _.values(
      _.mapValues(listMailQueue, (mailData) => {
        return mailData.id;
      }),
    );
    await mailService.updateMail(
      {listId},
      {
        process_status: MAIL_STATUS_ENUM.SENDING,
        modification_date: dayjs().utc(),
      },
    );
    _.each(listMailQueue, async (mailData) => {
      const {id} = mailData;
      transporter
        .sendMail({
          to: mailData.to_mail,
          subject: mailData.subject,
          html: mailData.content,
        })
        .then(async (res) => {
          const {accepted} = res;
          if (!_.isEmpty(accepted)) {
            await mailService.updateMail(
              {listId: [id]},
              {
                process_status: MAIL_STATUS_ENUM.SUCCESS,
                modification_date: dayjs().utc(),
              },
            );
          }
        });
    });
  }
}

module.exports = {sendMailQueue};
