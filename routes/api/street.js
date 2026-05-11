const express = require('express');
const _ = require('lodash');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const Constants = require('../../common/constants');
const Authentication = require('../../middlewares/auth');
const {httpGet, httpPost} = require('../../request/httpRequest');
const realEstateService = require('../../services/realEstateService');
const permission = require('../../middlewares/permission');
const checkInvalidBranch = require('../../middlewares/checkInvalidBranch');

const ExcelJS = require('exceljs');
const slugify = require('slugify');

const getStreetList = async (req, res, next) => {
  // let {street_id} = req.query;

  const result = await httpGet(`${Constants.ADMINISTRATIVE_URL}/street/list`, {
    params: {
      ...req.query,
    },
  });

  if (!result) {
    return RestAPI.notFound(res, 'Street not found');
  }

  const {data, total} = result.data;
  const response = await realEstateService.getStreetExist();

  const idStreetList = data.map((street) => {
    const isExist = response.find((item) => item.street_id === street.id);
    if (isExist) {
      return {...street, isDelete: false};
    } else {
      return {...street, isDelete: true};
    }
  });

  return RestAPI.success(res, idStreetList, {
    total,
  });
};

const getStreetListByWardId = async (req, res, next) => {
  let {ward_id} = req.params;

  const result = await httpGet(`${Constants.ADMINISTRATIVE_URL}/street/list`, {
    params: {
      ward_id,
    },
  });

  if (!result) {
    return RestAPI.notFound(res, 'Street not found');
  }

  const {data, total} = result.data;
  return RestAPI.success(res, data, {
    total,
  });
};

/**
 * This function is used to get the detail of a street by id.
 * @param req - request object
 * @param res - response object
 * @param next - The next middleware function in the stack.
 */
const detailStreet = async (req, res, next) => {
  let {id} = req.params;
  const result = await httpGet(
    `${Constants.ADMINISTRATIVE_URL}/street/detail/${id}`,
  );
  const {status, message} = result.data;
  if (status !== 200) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  return RestAPI.success(res, message);
};

/**
 * It updates a street
 * @param req - The request object
 * @param res - response object
 * @param next - This is the next middleware function in the stack.
 */
const updateStreet = async (req, res, next) => {
  let {id} = req.params;
  let {
    ward_id,
    title,
    status: updateStatus,
    province_city_id,
    districts_id,
  } = req.body;

  const {data} = await httpPost(
    `${Constants.ADMINISTRATIVE_URL}/street/update/${id}`,
    {
      wardId: ward_id,
      provinceCityId: province_city_id,
      districtId: districts_id,
      title,
      status: updateStatus,
      languageCode: 'vi',
    },
  ).catch((err) => {
    return RestAPI.serverError(res, 'Internal server error');
  });

  if (data?.status !== 200) {
    return RestAPI.serverError(res, 'Internal server error');
  }

  return RestAPI.success(res, data?.data);
};
const createStreet = async (req, res) => {
  let {
    ward_id,
    title,
    status: insertStatus,
    province_city_id,
    districts_id,
  } = req.body;

  try {
    const {data} = await httpPost(
      `${Constants.ADMINISTRATIVE_URL}/street/create`,
      {
        wardId: ward_id,
        provinceCityId: province_city_id,
        districtId: districts_id,
        title,
        status: insertStatus,
      },
    ).catch((err) => {
      return RestAPI.serverError(res, 'Internal server error');
    });
    console.log(data);
    if (data?.status !== 200) {
      return RestAPI.serverError(res, 'Internal server error');
    }
    return RestAPI.success(res, data?.data);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error');
  }
};

const deleteStreet = async (req, res, next) => {
  let {id} = req.params;
  const result = await httpPost(
    `${Constants.ADMINISTRATIVE_URL}/street/delete/${id}`,
  );
  const {status, message} = result.data;
  if (status !== 200) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  return RestAPI.success(res, message);
};

/**
 * This function is used to get check if the code already existed in Street
 * @param req - request object
 * @param res - response object
 * @param next - The next middleware function in the stack.
 */
const checkCodeExistStreet = async (req, res, next) => {
  let {code} = req.params;
  const result = await httpGet(
    `${Constants.ADMINISTRATIVE_URL}/street/code-exist/${code}`,
  );
  const {status, message, data} = result.data;
  if (status !== 200) {
    return RestAPI.serverError(res, 'Internal server error');
  }
  return RestAPI.success(res, data);
};

const activeDeactiveStreet = async (req, res) => {
  const {id} = req.params;
  const {status: updateStatus} = req.body;

  try {
    const response = await httpPost(
      `${Constants.ADMINISTRATIVE_URL}/street/active-deactive/${id}`,
      {
        status: updateStatus,
      },
    );
    const {status, message, data} = response.data;
    if (status !== 200) {
      return RestAPI.serverError(res, 'Internal server error');
    }
    return RestAPI.success(res, data);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error');
  }
};

const generateDataStreet = async (req, res) => {
  const districtResult = await httpGet(
    `${Constants.ADMINISTRATIVE_URL}/district/list`,
    {
      params: {
        limit: 2000,
        province_id: 50,
      },
    },
  );
  const {data: listDistrict} = districtResult.data;
  const workbook = new ExcelJS.Workbook();
  const wb = await workbook.xlsx.readFile('public/template/street_name.xlsx');
  const worksheet = wb.getWorksheet('Sheet1');
  let query = ``;
  worksheet.eachRow(function (row, rowNumber) {
    const record = row.values;
    let district = _.find(listDistrict, {title: `Quận ${record[4]}`});
    if (_.isUndefined(district)) {
      district = _.find(listDistrict, {title: `Huyện ${record[4]}`});
    }
    if (_.isUndefined(district)) {
      district = _.find(listDistrict, {title: `Thành phố ${record[4]}`});
    }
    if (_.isUndefined(district)) {
      switch (record[4]) {
        case 2:
        case 9:
          district = _.find(listDistrict, {title: `Thành phố Thủ Đức`});
          break;
      }
    }

    if (!_.isUndefined(district)) {
      const alias = slugify(_.toLower(record[3]));
      query += `with ins${rowNumber} as (
                      insert
                      into streets (title, alias, district_id, province_city_id, status)
                      VALUES ('${record[3]}', '${alias}', ${district.id},
                          50, 1) returning id)
                      insert
                      into streets_translation (street_id, language_code, title, status)
                      values ((select ins${rowNumber}.id from ins${rowNumber}), 'vi', '${record[3]}', 1);`;
      // console.info(record[3], record[4]);
    }
  });
  res.render('streets', {
    data: query,
  });
};

router.get('/list', Authentication.authenticateToken, getStreetList);
router.get(
  '/get-list',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('streetList'),
  getStreetList,
);
router.get(
  '/list/:ward_id',
  Authentication.authenticateToken,
  getStreetListByWardId,
);
router.get(
  '/detail/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('streetEdit'),
  detailStreet,
);
router.post(
  '/update/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('streetEdit'),
  updateStreet,
);
router.post(
  '/active-deactive/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('streetEdit'),
  activeDeactiveStreet,
);
router.post(
  '/create',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('streetCreate'),
  createStreet,
);
router.delete(
  '/delete/:id',
  Authentication.authenticateToken,
  checkInvalidBranch(),
  permission('streetDelete'),
  deleteStreet,
);
router.get(
  '/code-exist/:code',
  Authentication.authenticateToken,
  checkCodeExistStreet,
);
router.get('/generate', generateDataStreet);
module.exports = router;
