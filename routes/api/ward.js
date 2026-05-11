const express = require('express');
const _ = require('lodash');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const Constants = require('../../common/constants');
const Authentication = require('../../middlewares/auth');
const {httpGet, httpPost} = require('../../request/httpRequest');
const permission = require('../../middlewares/permission');
const checkInvalidBranch = require('../../middlewares/checkInvalidBranch');

const getWardList = async (req, res, next) => {
  let {query} = req;

  const result = await httpGet(`${Constants.ADMINISTRATIVE_URL}/ward/list`, {
    params: query,
  });

  const {data, total} = result.data;

  let dataWard = [];
  if (!_.isEmpty(data)) {
    _.each(data, (ward) => {
      dataWard.push({
        ...ward,
        display_status:
          ward.status == Constants.STATUS_ENUM.ACTIVE ? true : false,
      });
    });
  }

  return RestAPI.success(res, dataWard, {
    total,
  });
};

/**
 * It makes a POST request to the administrative service to create a ward
 * @param req - The request object
 * @param res - response object
 * @param next - The next middleware function in the stack.
 */
const createWard = async (req, res, next) => {
  try {
    const result = await httpPost(
      `${Constants.ADMINISTRATIVE_URL}/ward/create`,
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
 * It updates the active/deactive status of a Ward.
 * @param req - The request object.
 * @param res - The response object.
 * @param next - The next middleware function in the stack.
 */
const updateActiveDeActiveWard = async (req, res, next) => {
  let {id} = req.params;
  let {status: updateStatus} = req.body;
  const result = await httpPost(
    `${Constants.ADMINISTRATIVE_URL}/ward/active-deactive/${id}`,
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
 * This function is used to get the detail of a ward by id.
 * @param req - request object
 * @param res - response object
 * @param next - The next middleware function in the stack.
 */
const detailWard = async (req, res, next) => {
  let {id} = req.params;
  const result = await httpGet(
    `${Constants.ADMINISTRATIVE_URL}/ward/detail/${id}`,
  );
  const {status, message} = result.data;
  if (status !== 200) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  return RestAPI.success(res, message);
};

/**
 * It updates a ward
 * @param req - The request object
 * @param res - response object
 * @param next - This is the next middleware function in the stack.
 */
const updateWard = async (req, res, next) => {
  let {id} = req.params;
  let {code, title, status: updateStatus} = req.body;
  try {
    const result = await httpPost(
      `${Constants.ADMINISTRATIVE_URL}/ward/update/${id}`,
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

const deleteWard = async (req, res, next) => {
  let {id} = req.params;
  try {
    const result = await httpPost(
      `${Constants.ADMINISTRATIVE_URL}/ward/delete/${id}`,
    );
    const {status, message} = result.data;
    if (status !== 200) {
      return RestAPI.serverError(res, 'Internal server error');
    }
    return RestAPI.success(res, message);
  } catch (e) {
    const {message} = e.response.data;
    return RestAPI.badRequest(res, message);
  }
};

/**
 * This function is used to get check if the code already existed in Ward
 * @param req - request object
 * @param res - response object
 * @param next - The next middleware function in the stack.
 */
const checkCodeExistWard = async (req, res, next) => {
  let {code} = req.params;
  const result = await httpGet(
    `${Constants.ADMINISTRATIVE_URL}/ward/code-exist/${code}`,
  );
  const {status, message, data} = result.data;
  if (status !== 200) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  return RestAPI.success(res, data);
};

router.get('/list', Authentication.authenticateToken, getWardList);
router.get(
  '/get-list',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('wardList'),
  getWardList,
);
router.post(
  '/create',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('wardCreate'),
  createWard,
);
router.post(
  '/active-deactive/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('wardEdit'),
  updateActiveDeActiveWard,
);
router.get(
  '/detail/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('wardEdit'),
  detailWard,
);
router.post(
  '/update/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('wardEdit'),
  updateWard,
);
router.post(
  '/delete/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('wardDelete'),
  deleteWard,
);
router.get(
  '/code-exist/:code',
  Authentication.authenticateToken,
  checkCodeExistWard,
);
module.exports = router;
