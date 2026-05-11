const express = require('express');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const auth = require('../../middlewares/auth');
const realEstateService = require('../../services/realEstateService');
const {exportService} = require('../../services/exportService');
const {Validator} = require('jsonschema');
const {realEstateSchema} = require('../../validation');
const generateResponseApi = require('../../common/generateResponseApi');
const upload = require('../../common/uploadMiddleware');
const _ = require('lodash');
const Common = require('../../common/common');
const {importService} = require('../../services/importService');
const {Worker} = require('worker_threads');
const permissionServices = require('../../services/permissionServices');
const Constants = require('../../common/constants');
const permission = require('../../middlewares/permission');
const checkInvalidBranch = require('../../middlewares/checkInvalidBranch');
const {notificationService} = require('../../services/notificationService');

const getListRealEstate = async (req, res) => {
  const {permissionInfo, id, role_id} = req.auth;

  let {
    auth,
    query: {
      sort,
      limit,
      offset,
      status,
      keyword,
      realEstateStatus,
      categoryId,
      from_price,
      to_price,
      creator,
      province,
      district,
      type,
      ward,
      street,
      myRecord,
      mySubscribe,
      location,
      branch_id,
      direction,
    },
  } = req;
  const validator = new Validator();
  const resultValid = validator.validate(
    {
      status,
    },
    realEstateSchema.realEstateFilterSchema,
  );

  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.badRequest(res, errors);
  }

  if (myRecord === 'true') {
    if (_.isArray(creator)) {
      creator.push(auth.id);
    } else {
      creator = [auth.id];
    }
  }

  const {realEstateList, count} = await realEstateService.getList(
    {
      limit,
      offset,
      status,
      keyword,
      realEstateStatus,
      categoryId,
      from_price,
      to_price,
      creatorId: creator,
      user_id: id,
      type,
      province,
      district,
      ward,
      street,
      location,
      direction,
      subscribeId: mySubscribe === 'true' ? auth.id : null,
      myRecord,
      permissionInfo,
      branch_id,
    },
    JSON.parse(sort),
    auth.id,
  );

  return RestAPI.success(res, realEstateList, {
    total: count,
  });
};

async function insertRealEstate(req, res) {
  const {id, full_name} = req.auth;
  const {mainData, detailData} = req.body;

  const validator = new Validator();
  const resultValid = validator.validate(
    {...mainData, creator_sale_id: id, ...detailData, full_name},
    realEstateSchema.insertRealEstateSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.serverError(res, errors);
  }

  try {
    const response = await realEstateService.insertRealEstate(
      {
        ...mainData,
        creator_sale_id: id,
        full_name,
      },
      {
        ...detailData,
      },
    );

    if (!response) {
      return RestAPI.notFound(res, 'Insert real state failed');
    }

    return RestAPI.success(res, response);
  } catch (error) {
    console.log(error);
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function updateRealEstate(req, res) {
  const {id: real_estate_id} = req.params;
  const {mainData, detailData, next_status, previous_status} = req.body;
  const {full_name, permissionInfo, id: user_id} = req.auth;

  const validator = new Validator();
  const resultValid = validator.validate(
    {...mainData},
    realEstateSchema.updateRealEstateSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.serverError(res, errors);
  }

  try {
    const response = await realEstateService.updateRealEstate(
      {...mainData, next_status, previous_status},
      detailData,
      real_estate_id,
      {
        permissionInfo: permissionInfo,
        full_name: full_name,
        user_id: user_id,
      },
    );

    if (next_status !== undefined) {
      await notificationService.createNotification({
        realEstateId: real_estate_id,
        infoData: {
          code: mainData.code,
          previous_status_title: previous_status?.title,
          next_status_title: next_status.title,
        },
      });
    }

    return generateResponseApi({res: res, response: response});
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function checkDuplicateRealEstate(req, res) {
  const body = req.body;
  const validator = new Validator();
  const resultValid = validator.validate(
    body,
    realEstateSchema.checkDuplicateRealEstateSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.serverError(res, errors);
  }
  try {
    const response = await realEstateService.checkDuplicateRealEstate({
      ...body,
    });

    if (!response) {
      return RestAPI.notFound(res, 'Check duplicate real state failed');
    }

    RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

const subscribeRealEstate = async (req, res) => {
  let {auth} = req;
  let {id} = req.params;
  const {isSubscribe} = req.body;
  try {
    const response = await realEstateService.subscribeRealEstate(
      {
        realEstate: id,
        saleId: auth.id,
      },
      isSubscribe,
    );
    if (!response) {
      return RestAPI.serverError(res, 'Internal server error');
    }
    return RestAPI.success(res, 'Ok');
  } catch (e) {
    return RestAPI.serverError(res, 'Internal server error', e);
  }
};

async function getRealEstateById(req, res) {
  const {id} = req.params;
  const {permissionInfo, id: user_id} = req.auth;

  const validator = new Validator();
  const resultValid = validator.validate(
    {id},
    realEstateSchema.getRealEstateByIdSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.serverError(res, errors);
  }
  try {
    const response = await realEstateService.getRealEstateById(id);
    let is_accessible = true;
    if (!response) {
      return RestAPI.notFound(res, 'Get real estate item failed');
    } else {
      if (permissionInfo && user_id !== response.creator_id) {
        is_accessible = false;
      }
    }

    return RestAPI.success(res, {...response, is_accessible: is_accessible});
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function getHistoryRealEstateStatus(req, res) {
  const {id} = req.params;
  try {
    const response = await realEstateService.getHistoryRealEstateStatus(id);
    if (!response) {
      return RestAPI.notFound(res, 'Get history real estate status failed');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function updateHistoryCloneRealEstate(req, res) {
  const {realEstateStatus, note} = req.body;
  const {id} = req.params;
  const {full_name} = req.auth;
  try {
    const response = await realEstateService.updateHistoryCloneRealEstate(id, {
      realEstateStatus,
      full_name,
      note,
    });
    if (!response) {
      return RestAPI.notFound(res, 'Insert history real estate status failed');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

const insertExportQueue = async (req, res) => {
  const {role_id} = req.auth;
  const {type} = req.body;
  const accessibility = await permissionServices.permissionAccess(
    role_id,
    type === 1 ? 'realEstateSell' : 'realEstateRent',
    'export',
  );
  if (!accessibility) {
    return RestAPI.forbidden(res, 'forbidden');
  }
  let {
    auth: {permissionInfo, id},
    body,
  } = req;

  const realEstateList = await exportService.insertExportRequest(body, id);
  return RestAPI.success(res, realEstateList);
};

const getExportQueueList = async (req, res) => {
  let {
    auth: {permissionInfo, id},
    query: {limit, offset, status},
  } = req;

  const realEstateList = await exportService.getListExportQueue({
    limit,
    offset,
    status,
  });
  return RestAPI.success(res, realEstateList);
};

async function getListRealEstateReport(req, res) {
  const {params} = req.query;
  const newParams = params && JSON.parse(params);

  const validator = new Validator();
  const resultValid = validator.validate(
    newParams,
    realEstateSchema.getListRealEstateReportSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.serverError(res, errors);
  }
  try {
    const response = await realEstateService.getListRealEstateReport(newParams);
    if (!response) {
      return RestAPI.notFound(res, 'Get real estate report failed');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function getListRealEstateDataReport(req, res) {
  const {params} = req.query;
  const newParams = params && JSON.parse(params);
  const validator = new Validator();
  const resultValid = validator.validate(
    newParams,
    realEstateSchema.getListRealEstateDataReportSchema,
  );

  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.serverError(res, errors);
  }
  try {
    const response = await realEstateService.getListRealEstateDataReport(
      newParams,
    );
    if (!response) {
      return RestAPI.notFound(res, 'Get real estate data report failed');
    }

    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

const insertImportQueue = async (req, res) => {
  const {role_id} = req.auth;
  const {type, branch_id} = req.body;

  const accessibility = await permissionServices.permissionAccess(
    role_id,
    type == 1 ? 'realEstateSell' : 'realEstateRent',
    'import',
  );

  if (!accessibility) {
    return RestAPI.forbidden(res, 'forbidden');
  }
  try {
    let {
      auth: {permissionInfo, id},
    } = req;

    if (_.isEmpty(req.file.fileNameUpload)) {
      return RestAPI.badRequest(res, Constants.MSG.FILE_EMPTY_ERR);
    } else {
      const {fileNameUpload, path, nameWithoutExt} = req.file;

      const response = await importService.insertImportRequest(
        nameWithoutExt,
        id,
        path,
        {type: type, branch_id: branch_id},
      );

      if (!response) {
        return RestAPI.notFound(res, 'Upload error ');
      }
      RestAPI.success(res, response);
    }
  } catch (error) {
    return RestAPI.serverError(res, Constants.MSG.SERVER_ERR, error);
  }
};
const getChangeStatusRealEstateReportChartData = async (req, res) => {
  const {params} = req.query;
  const newParams = params && JSON.parse(params);
  const validator = new Validator();
  const resultValid = validator.validate(
    newParams,
    realEstateSchema.getChangeStatusRealEstateReportChartDataSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.serverError(res, errors);
  }
  try {
    const response =
      await realEstateService.getChangeStatusRealEstateReportChartData(
        newParams,
      );
    if (!response) {
      return RestAPI.notFound(res, 'Get real estate report failed');
    }

    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
};
const getChangeStatusRealEstateReportList = async (req, res) => {
  const {params} = req.query;
  const newParams = params && JSON.parse(params);
  const validator = new Validator();
  const resultValid = validator.validate(
    newParams,
    realEstateSchema.getChangeStatusRealEstateReportListSchema,
  );

  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.serverError(res, errors);
  }
  try {
    const response =
      await realEstateService.getChangeStatusRealEstateReportList(newParams);
    if (!response) {
      return RestAPI.notFound(res, 'Get real estate report failed');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
};

const generateRealEstate = async (req, res) => {
  const {params, body} = req;
  const {id, full_name} = req.auth;
  try {
    const {number} = params;
    const worker = new Worker('./worker/index.js', {
      workerData: {
        numberRealEstate: number,
        dataForGenerate: {
          ...body,
          creator_sale_id: id,
          full_name,
        },
      },
    });
    worker.on('message', (data) => {
      // return RestAPI.success(res, "ok");
    });
    worker.on('error', (msg) => {
      // res.status(404).send(`An error occurred: ${msg}`);
    });

    return RestAPI.success(res, 'response');
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
};

const changeRealEstateStatus = async (req, res) => {
  try {
    const response = await realEstateService.changeStatusRealEstate();
    if (!response) {
      return RestAPI.notFound(res, 'Get real estate status failed');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
};

const assignMultipleRealEstateToUser = async (req, res) => {
  console.info(performance.now());
  try {
    const {data_assign} = req.body;
    const {full_name, permissionInfo} = req.auth;

    const response = await realEstateService.assignMultipleRealEstateToUser(
      data_assign,
      {admin_full_name: full_name, permissionInfo: permissionInfo},
    );

    console.info(performance.now());
    return generateResponseApi({res: res, response: response});
  } catch (error) {
    console.info(performance.now());
    return RestAPI.serverError(res, 'Internal server error', error);
  }
};

const assignSingleRealEstateToUser = async (req, res) => {
  try {
    const {permissionInfo, full_name} = req.auth;
    const {data_assign} = req.body;

    const response = await realEstateService.assignSingleRealEstateToUser(
      {...data_assign, admin_full_name: full_name},
      permissionInfo,
    );

    return generateResponseApi({res: res, response: response});
  } catch (error) {
    console.log('Assign single real estate API error', error);
    return RestAPI.serverError(res, 'Internal server error');
  }
};

const convertRealEstateListToDuplicate = async (req, res) => {
  try {
    const {real_estate_list, branch_id} = req.body;
    const {full_name, id, permissionInfo} = req.auth;

    const response = await realEstateService.convertRealEstateListToDuplicate(
      real_estate_list,
      {admin_full_name: full_name, creator_id: id, permissionInfo},
      branch_id,
    );

    return generateResponseApi({res: res, response: response});
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
};

const convertSingleRealEstateToDuplicate = async (req, res) => {
  try {
    const {real_estate_id, branch_id} = req.body;
    const {full_name, id, permissionInfo} = req.auth;

    const response = await realEstateService.convertSingleRealEstateToDuplicate(
      real_estate_id,
      {admin_full_name: full_name, creator_id: id, permissionInfo},
      branch_id,
    );

    return generateResponseApi({res: res, response: response});
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
};

const deleteRealEstateList = async (req, res) => {
  try {
    const {real_estate_list} = req.body;
    const {id} = req.auth;

    const response = await realEstateService.deleteRealEstateList(
      real_estate_list,
      id,
    );

    return generateResponseApi({res: res, response: response});
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
};
const deleteSingleRealEstate = async (req, res) => {
  try {
    const {real_estate_id} = req.body;
    const {id} = req.auth;
    const response = await realEstateService.deleteSingleRealEstate(
      real_estate_id,
      id,
    );

    return generateResponseApi({res: res, response: response});
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
};

const backupLocation = async (req, res) => {
  try {
    const response = await realEstateService.backupLocation();
    if (!response) {
      return RestAPI.notFound(res, 'Backup location real estate failed');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
};

router.post(
  '/assign-single-to-user',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateSellAssign'),
  assignSingleRealEstateToUser,
);

router.post(
  '/assign-multiple-to-user',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateSellAssign'),
  assignMultipleRealEstateToUser,
);

router.post(
  '/delete-multiple',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateSellDelete'),
  deleteRealEstateList,
);
router.post(
  '/delete-single',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateSellDelete'),
  deleteSingleRealEstate,
);

router.post(
  '/convert-single-duplicate',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateSellDuplicate'),
  convertSingleRealEstateToDuplicate,
);

router.post(
  '/convert-multiple-duplicate',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateSellDuplicate'),
  convertRealEstateListToDuplicate,
);

// router.get('/get/:id',auth.authenticateToken,getListRealEstateSubcribe)
router.get('/list-status', auth.authenticateToken, changeRealEstateStatus);
router.get('/backup-location', auth.authenticateToken, backupLocation);
router.post(
  '/insert',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateSellCreate'),
  insertRealEstate,
);
router.get(
  '/item/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateSellEdit'),
  getRealEstateById,
);
router.put(
  '/update/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateSellEdit'),
  updateRealEstate,
);
router.get(
  '/list',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateSellList'),
  getListRealEstate,
);
router.post(
  '/check-duplicate',
  auth.authenticateToken,
  checkInvalidBranch(),
  checkDuplicateRealEstate,
);
router.post(
  '/subscribe/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateSellEdit'),
  subscribeRealEstate,
);
router.post(
  '/history/:id',
  auth.authenticateToken,
  updateHistoryCloneRealEstate,
);

router.get(
  '/list-report',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('reportView'),
  getListRealEstateReport,
);
router.get(
  '/data-report',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('reportView'),
  getListRealEstateDataReport,
);
router.get(
  '/list-status-report',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('reportView'),
  getChangeStatusRealEstateReportList,
);
router.get(
  '/data-status-report',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('reportView'),
  getChangeStatusRealEstateReportChartData,
);

router.get('/history/:id', auth.authenticateToken, getHistoryRealEstateStatus);
router.post(
  '/export/request',
  auth.authenticateToken,
  checkInvalidBranch(),
  insertExportQueue,
);
router.get(
  '/export/request',
  auth.authenticateToken,
  checkInvalidBranch(),
  getExportQueueList,
);
router.post(
  '/import/request',
  [auth.authenticateToken, upload.uploadFile()],
  checkInvalidBranch(),
  insertImportQueue,
);
router.post(
  '/generate/real-estate/:number',
  [auth.authenticateToken],
  generateRealEstate,
);

module.exports = {
  router,
  getListRealEstate,
  assignSingleRealEstateToUser,
  assignMultipleRealEstateToUser,
  insertImportQueue,
  insertExportQueue,
  updateRealEstate,
  insertRealEstate,
  deleteRealEstateList,
  convertRealEstateListToDuplicate,
  convertSingleRealEstateToDuplicate,
  deleteSingleRealEstate,
  getRealEstateById,
  subscribeRealEstate,
};
