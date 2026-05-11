const cron = require('node-cron');
const {sendMailQueue} = require('./mail');
const {executeQueue} = require('./export');
// const {executeImportQueue} = require('./import');
const {executeImportQueue} = require('./importExcel');
const {prepareData} = require('./prepareMasterData');
const {sendNotificationQueue} = require('./notification');
const {once} = require('./once');

// ENABLE_CRON=false → disable cron (was broken: `let isEnable = ... || true` luôn truthy
// và `if ('0')` luôn truthy → cron luôn schedule. Fix per S2 task 04.)
const isEnable =
  process.env.ENABLE_CRON === undefined ||
  process.env.ENABLE_CRON === 'true' ||
  process.env.ENABLE_CRON === '1';

function setSchedule(expression, func) {
  if (!isEnable) return;
  cron.schedule(expression, func, {
    scheduled: true,
    timezone: 'Asia/Ho_Chi_Minh',
  });
}

// Cron interval (DECISIONS C3) — mail 30s, execute 15s, import 60s, notification 15s.
setSchedule('*/30 * * * * *', once(sendMailQueue, 'mail'));
setSchedule('*/15 * * * * *', once(executeQueue, 'execute'));
setSchedule('*/60 * * * * *', once(executeImportQueue, 'import'));
setSchedule('*/15 * * * * *', once(sendNotificationQueue, 'notification'));
setSchedule('59 59 23 * * 6', once(prepareData, 'prepareMasterData'));
