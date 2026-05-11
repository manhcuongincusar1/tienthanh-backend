const cron = require('node-cron');
let isEnable = process.env.ENABLE_CRON || true;
const {sendMailQueue} = require('./mail');
const {executeQueue} = require('./export');
// const {executeImportQueue} = require('./import');
const {executeImportQueue} = require('./importExcel');
const {prepareData} = require('./prepareMasterData');
const {sendNotificationQueue} = require('./notification');

function setSchedule(expression = '0 * * * *', func) {
  if ('0') {
    cron.schedule(expression, func, {
      scheduled: true,
      timezone: 'Asia/Ho_Chi_Minh',
    });
  }
}

setSchedule('*/10 * * * * *', sendMailQueue);
setSchedule('*/10 * * * * *', executeQueue);
setSchedule('*/10 * * * * *', executeImportQueue);
setSchedule('*/10 * * * * *', sendNotificationQueue);
setSchedule('59 59 23 * * 6', prepareData);
