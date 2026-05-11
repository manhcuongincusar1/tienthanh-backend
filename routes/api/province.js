const express = require('express');
const _ = require('lodash');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const Constants = require('../../common/constants');
const Authentication = require('../../middlewares/auth');
const {httpGet, httpPost} = require('../../request/httpRequest');
const permission = require('../../middlewares/permission');
const checkInvalidBranch = require('../../middlewares/checkInvalidBranch');

const getListProvince = async (req, res, next) => {
  let {query} = req;
  const result = await httpGet(
    `${Constants.ADMINISTRATIVE_URL}/province/list`,
    {
      params: query,
    },
  );
  const {data, total} = result.data;

  let dataProvince = [];
  if (!_.isEmpty(data)) {
    _.each(data, (province) => {
      dataProvince.push({
        ...province,
        display_status:
          province.status == Constants.STATUS_ENUM.ACTIVE ? true : false,
      });
    });
  }
  return RestAPI.success(res, dataProvince, {
    total,
  });
};

const updateActiveDeActiveProvince = async (req, res, next) => {
  let {id} = req.params;
  let {status: updateStatus} = req.body;
  const result = await httpPost(
    `${Constants.ADMINISTRATIVE_URL}/province/active-deactive/${id}`,
    {
      status: updateStatus,
    },
  );
  const {status, message} = result.data;
  if (status !== 200) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  return RestAPI.success(res, message);
};

const createProvince = async (req, res, next) => {
  try {
    let {code, title, status: updateStatus} = req.body;
    const result = await httpPost(
      `${Constants.ADMINISTRATIVE_URL}/province/create`,
      {
        code,
        title,
        status: updateStatus,
      },
    );

    const {status, message} = result.data;
    if (status !== 200) {
      return RestAPI.badRequest(res, message);
    }
    return RestAPI.success(res, message);
  } catch (e) {
    const {status, message} = e.response.data;
    return RestAPI.badRequest(res, message);
  }
};

const detailProvince = async (req, res, next) => {
  let {id} = req.params;
  const result = await httpGet(
    `${Constants.ADMINISTRATIVE_URL}/province/detail/${id}`,
  );
  const {status, message} = result.data;
  if (status !== 200) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  return RestAPI.success(res, message);
};

const updateProvince = async (req, res, next) => {
  let {id} = req.params;
  let {code, title, status: updateStatus} = req.body;
  const result = await httpPost(
    `${Constants.ADMINISTRATIVE_URL}/province/update/${id}`,
    {
      ...req.body,
    },
  );
  const {status, message} = result.data;
  if (status !== 200) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  return RestAPI.success(res, message);
};

const deleteProvince = async (req, res, next) => {
  let {id} = req.params;
  const result = await httpPost(
    `${Constants.ADMINISTRATIVE_URL}/province/delete/${id}`,
  );
  const {status, message} = result.data;
  if (status !== 200) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  return RestAPI.success(res, message);
};

const checkCodeExistProvince = async (req, res, next) => {
  let {code} = req.params;
  const result = await httpGet(
    `${Constants.ADMINISTRATIVE_URL}/province/code-exist/${code}`,
  );
  const {status, message, data} = result.data;
  if (status !== 200) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  return RestAPI.success(res, data);
};

router.get('/list', Authentication.authenticateToken, getListProvince);
router.get(
  '/get-list',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('provinceList'),
  getListProvince,
);
router.post(
  '/active-deactive/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('provinceEdit'),
  updateActiveDeActiveProvince,
);
router.post(
  '/create',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('provinceCreate'),
  createProvince,
);
router.get(
  '/detail/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('provinceDelete'),
  detailProvince,
);
router.post(
  '/update/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('provinceEdit'),
  updateProvince,
);
router.post(
  '/delete/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('provinceDelete'),
  deleteProvince,
);
router.get(
  '/code-exist/:code',
  Authentication.authenticateToken,
  checkCodeExistProvince,
);
module.exports = router;
