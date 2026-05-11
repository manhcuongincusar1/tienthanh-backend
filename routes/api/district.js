const express = require('express');
const _ = require('lodash');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const Constants = require('../../common/constants');
const Authentication = require('../../middlewares/auth');
const {httpGet, httpPost} = require('../../request/httpRequest');
const permission = require('../../middlewares/permission');
const checkInvalidBranch = require('../../middlewares/checkInvalidBranch');

/**
 * It gets a list of districts from the administrative service
 * @param req - The request object.
 * @param res - response object
 * @param next - The next middleware function in the stack.
 */
const getListDistrict = async (req, res, next) => {
  let {query} = req;

  const result = await httpGet(
    `${Constants.ADMINISTRATIVE_URL}/district/list`,
    {
      params: query,
    },
  );
  const {data, total} = result.data;
  let dataDistrict = [];
  if (!_.isEmpty(data)) {
    _.each(data, (district) => {
      dataDistrict.push({
        ...district,
        display_status:
          district.status == Constants.STATUS_ENUM.ACTIVE ? true : false,
      });
    });
  }

  return RestAPI.success(res, dataDistrict, {
    total,
  });
};

/**
 * It makes a POST request to the administrative service to create a district
 * @param req - The request object
 * @param res - response object
 * @param next - The next middleware function in the stack.
 */
const createDistrict = async (req, res, next) => {
  try {
    const result = await httpPost(
      `${Constants.ADMINISTRATIVE_URL}/district/create`,
      {
        ...req.body,
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

/**
 * This function is used to get the detail of a district by id.
 * @param req - request object
 * @param res - response object
 * @param next - The next middleware function in the stack.
 */
const detailDistrict = async (req, res, next) => {
  let {id} = req.params;
  const result = await httpGet(
    `${Constants.ADMINISTRATIVE_URL}/district/detail/${id}`,
  );
  const {status, message} = result.data;
  if (status !== 200) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  return RestAPI.success(res, message);
};

/**
 * It updates the active/deactive status of a District.
 * @param req - The request object.
 * @param res - The response object.
 * @param next - The next middleware function in the stack.
 */
const updateActiveDeActiveDistrict = async (req, res, next) => {
  let {id} = req.params;
  let {status: updateStatus} = req.body;
  const result = await httpPost(
    `${Constants.ADMINISTRATIVE_URL}/district/active-deactive/${id}`,
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

/**
 * It updates a district
 * @param req - The request object
 * @param res - response object
 * @param next - This is the next middleware function in the stack.
 */
const updateDistrict = async (req, res, next) => {
  let {id} = req.params;
  let {code, title, status: updateStatus} = req.body;
  try {
    const result = await httpPost(
      `${Constants.ADMINISTRATIVE_URL}/district/update/${id}`,
      {
        ...req.body,
      },
    );
    const {status, message} = result.data;
    if (status !== 200) {
      return RestAPI.serverError(res, 'Internal server error');
    }
    return RestAPI.success(res, message);
  } catch (e) {
    const {status, message} = e.response.data;
    return RestAPI.badRequest(res, message);
  }
};

const deleteDistrict = async (req, res, next) => {
  let {id} = req.params;
  try {
    const result = await httpPost(
      `${Constants.ADMINISTRATIVE_URL}/district/delete/${id}`,
    );
    const {status, message} = result.data;
    if (status !== 200) {
      return RestAPI.serverError(res, 'Internal server error');
    }
    return RestAPI.success(res, message);
  } catch (e) {
    const {status, message} = e.response.data;
    return RestAPI.badRequest(res, message);
  }
};

/**
 * This function is used to get check if the code already existed in District
 * @param req - request object
 * @param res - response object
 * @param next - The next middleware function in the stack.
 */
const checkCodeExistDistrict = async (req, res, next) => {
  let {code} = req.params;
  const result = await httpGet(
    `${Constants.ADMINISTRATIVE_URL}/district/code-exist/${code}`,
  );
  const {status, message, data} = result.data;
  if (status !== 200) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  return RestAPI.success(res, data);
};

router.get('/list', Authentication.authenticateToken, getListDistrict);
router.get(
  '/get-list',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('districtList'),
  getListDistrict,
);
router.post(
  '/create',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('districtCreate'),
  createDistrict,
);
router.post(
  '/active-deactive/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('districtEdit'),
  updateActiveDeActiveDistrict,
);
router.get(
  '/detail/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('districtEdit'),
  detailDistrict,
);
router.post(
  '/update/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('districtEdit'),
  updateDistrict,
);
router.post(
  '/delete/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('districtDelete'),
  deleteDistrict,
);
router.get(
  '/code-exist/:code',
  Authentication.authenticateToken,
  checkCodeExistDistrict,
);
module.exports = router;
