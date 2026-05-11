const {workerData, parentPort} = require('worker_threads');
const _ = require('lodash');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);
const {
  importService,
  IMPORT_STATUS_ENUM,
} = require('../services/importService');

const {} = workerData;

(async () => {
  const listExecQueue = await importService.getListExecImportQueue();
  if (!_.isEmpty(listExecQueue)) {
    const listId = _.values(
      _.mapValues(listExecQueue, (importData) => {
        return importData.id;
      }),
    );

    await importService.importUpdate(
      {listId},
      {
        status: IMPORT_STATUS_ENUM.FAIL,
        modification_date: dayjs().utc(),
      },
    );
  }
})();
parentPort.postMessage({
  message: 'OK',
});
