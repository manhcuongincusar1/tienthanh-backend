// Street CRUD route — in-process implementation (no HTTP proxy to admin service).
const express = require('express');
const _ = require('lodash');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const Constants = require('../../common/constants');
const Authentication = require('../../middlewares/auth');
const realEstateService = require('../../services/realEstateService');
const permission = require('../../middlewares/permission');
const checkInvalidBranch = require('../../middlewares/checkInvalidBranch');
const streetService = require('../../services/streetService');
const districtService = require('../../services/districtService');

const ExcelJS = require('exceljs');
const slugify = require('slugify');

const handleBizError = (res, err) => {
  if (err && err.status) return RestAPI.badRequest(res, err.message);
  console.log(err);
  return RestAPI.serverError(res, 'Internal server error');
};

const normalizeBodyStatus = (status) => {
  if (status === undefined) return undefined;
  if (typeof status === 'boolean') return status ? Constants.STATUS_ENUM.ACTIVE : Constants.STATUS_ENUM.PENDING;
  return Number(status);
};

const decorateDisplay = (row) => ({
  ...row,
  display_status: Number(row.status) === Constants.STATUS_ENUM.ACTIVE,
});

const getStreetList = async (req, res) => {
  try {
    const {data, total} = await streetService.getList(req.query);
    // Enrich với isDelete flag — true nếu street KHÔNG được real_estate tham chiếu (an toàn xoá).
    const referenced = await realEstateService.getStreetExist();
    const list = data.map((street) => {
      const isExist = referenced.find((item) => item.street_id === street.id);
      return {...decorateDisplay(street), isDelete: !isExist};
    });
    return RestAPI.success(res, list, {total});
  } catch (err) {
    return handleBizError(res, err);
  }
};

const getStreetListByWardId = async (req, res) => {
  try {
    const {ward_id} = req.params;
    const {data, total} = await streetService.getList({ward_id, limit: 500});
    return RestAPI.success(res, data.map(decorateDisplay), {total});
  } catch (err) {
    return handleBizError(res, err);
  }
};

const detailStreet = async (req, res) => {
  try {
    const row = await streetService.getDetail(req.params.id, {
      languageCode: req.query.languageCode || 'vi',
    });
    if (!row) return RestAPI.notFound(res, 'Street not found');
    return RestAPI.success(res, decorateDisplay(row));
  } catch (err) {
    return handleBizError(res, err);
  }
};

const createStreet = async (req, res) => {
  try {
    const row = await streetService.create({
      ...req.body,
      status: normalizeBodyStatus(req.body.status),
    });
    return RestAPI.success(res, decorateDisplay(row));
  } catch (err) {
    return handleBizError(res, err);
  }
};

const updateStreet = async (req, res) => {
  try {
    const row = await streetService.update(req.params.id, {
      ...req.body,
      status: normalizeBodyStatus(req.body.status),
    });
    return RestAPI.success(res, decorateDisplay(row));
  } catch (err) {
    return handleBizError(res, err);
  }
};

const activeDeactiveStreet = async (req, res) => {
  try {
    const row = await streetService.setActive(req.params.id, normalizeBodyStatus(req.body.status));
    return RestAPI.success(res, decorateDisplay(row));
  } catch (err) {
    return handleBizError(res, err);
  }
};

const deleteStreet = async (req, res) => {
  try {
    await streetService.remove(req.params.id);
    return RestAPI.success(res, 'Deleted');
  } catch (err) {
    return handleBizError(res, err);
  }
};

const checkCodeExistStreet = async (req, res) => {
  try {
    const exists = await streetService.codeExists(req.params.code);
    return RestAPI.success(res, {result: exists});
  } catch (err) {
    return handleBizError(res, err);
  }
};

// Admin-only XLSX importer — generates SQL view of street_name.xlsx rows mapped to TP.HCM districts.
const generateDataStreet = async (req, res) => {
  const {data: listDistrict} = await districtService.getList({limit: 2000, province_city_id: 50});
  const workbook = new ExcelJS.Workbook();
  const wb = await workbook.xlsx.readFile('public/template/street_name.xlsx');
  const worksheet = wb.getWorksheet('Sheet1');
  let query = '';
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
          district = _.find(listDistrict, {title: 'Thành phố Thủ Đức'});
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
    }
  });
  res.render('streets', {data: query});
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
