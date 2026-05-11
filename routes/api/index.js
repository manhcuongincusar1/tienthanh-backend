const emailRouter = require('./email');
const provinceRouter = require('./province');
const branchesRouter = require('./branches');
const accountRouter = require('./account');
const districtRouter = require('./district');
const wardRouter = require('./ward');
const userRouter = require('./user');
const uploadRouter = require('./upload');
const realEstateStatusRouter = require('./real_estate_status');
const realEstateCategoryRouter = require('./real_estate_category');
const customerRouter = require('./customer');
const {router: realEstateRouter} = require('./real_estate');
const realEstateRent = require('./real_estate_rent');
const streetRouter = require('./street');
const saleRouter = require('./sales');
const importExportRouter = require('./import_export');
const permissionRouter = require('./permission');
const settingRouter = require('./settings');
const brokerRouter = require('./broker');

module.exports = [
  {
    path: '/_api/account',
    api: accountRouter,
  },
  {
    path: '/_api/email',
    api: emailRouter,
  },
  {
    path: '/_api/province',
    api: provinceRouter,
  },
  {
    path: '/_api/branches',
    api: branchesRouter,
  },
  {
    path: '/_api/province',
    api: provinceRouter,
  },
  {
    path: '/_api/district',
    api: districtRouter,
  },
  {
    path: '/_api/ward',
    api: wardRouter,
  },
  {
    path: '/_api/street',
    api: streetRouter,
  },
  {
    path: '/_api/user',
    api: userRouter,
  },
  {
    path: '/_api/file',
    api: uploadRouter,
  },
  {
    path: '/_api/real-estate-status',
    api: realEstateStatusRouter,
  },
  {
    path: '/_api/real-estate-category',
    api: realEstateCategoryRouter,
  },

  {
    path: '/_api/customer',
    api: customerRouter,
  },
  {
    path: '/_api/sale',
    api: saleRouter,
  },
  {
    path: '/_api/real-estate-sell',
    api: realEstateRouter,
  },
  {
    path: '/_api/real-estate-rent',
    api: realEstateRent,
  },
  {
    path: '/_api/import-export',
    api: importExportRouter,
  },
  {
    path: '/_api/permission',
    api: permissionRouter,
  },
  {
    path: '/_api/setting',
    api: settingRouter,
  },
  {
    path: '/_api/broker',
    api: brokerRouter,
  },
];
