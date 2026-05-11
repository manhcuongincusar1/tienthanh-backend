const {workerData, parentPort} = require('worker_threads');
const realEstateService = require('../services/realEstateService');
const realEstateStatusService = require('../services/realEstateStatusService');
const realEstateCategoryService = require('../services/realEstateCategoryService');
const _ = require('lodash');
const dayjs = require('dayjs');
const dayjsRandom = require('dayjs-random');
const DIRECTION_ENUM = [
  'west',
  'north_west',
  'north',
  'north_east',
  'east',
  'south_east',
  'south',
  'south_west',
];

const LOCATION_ENUM = [1, 2, 3];

dayjs.extend(dayjsRandom);

const {numberRealEstate, dataForGenerate} = workerData;
let counter = 0;

(async () => {
  const {
    creator_sale_id,
    full_name,
    type,
    province_city_id,
    district_id,
    street_id,
    ward_id,
    customer_name,
    customer_phone,
    start_date,
    to_date,
  } = dataForGenerate;

  const {realEstateStatusList} = await realEstateStatusService.getList({
    type,
  });
  const {realEstateCategoryList} = await realEstateCategoryService.getList({
    limit: 500,
    offset: 0,
  });
  for (let i = 0; i < numberRealEstate; i++) {
    let randomStatus =
      realEstateStatusList[
        Math.floor(Math.random() * realEstateStatusList.length)
      ];
    let randomCategory =
      realEstateCategoryList[
        Math.floor(Math.random() * realEstateCategoryList.length)
      ];
    let price = 0;
    switch (type) {
      case 1:
        price = Math.floor(_.random(1, 99, true) * 100) / 100;
        break;
      default:
        price = Math.floor(_.random(1, 999, true) * 100) / 100;
    }

    let dataInsert = {
      creator_sale_id,
      location: LOCATION_ENUM[_.random(0, 2)],
      full_name,
      address: performance.now().toString().replace('.', 7),
      goodwill: Math.random() < 0.5,
      price,
      type,
      category_id: randomCategory.id,
      province_city_id,
      district_id: district_id,
      street_id,
      ward_id,
      saler_full_name: customer_name,
      saler_phone_number: customer_phone,
      is_internal: Math.random() < 0.5,
      real_estate_status_id: randomStatus.id,
      previous_real_estate_status: randomStatus.title,
      agency: Math.random() < 0.5,
      direction: 'north_west',
      brokerage_fees: Math.floor(_.random(1, 99, true) * 100) / 100,
    };

    if (start_date && to_date) {
      dataInsert.created_at = dayjs
        .between(start_date, to_date)
        .format('YYYY-MM-DD');
    } else {
      dataInsert.created_at = dayjs().format('YYYY-MM-DD');
    }
    let width = _.random(1, 99);
    let length = _.random(1, 99);
    let dataDetail = {
      horizontal: width,
      long: length,
      area: width * length,
      recognized_area: width * length,
      bedroom: _.random(1, 6),
      wc: _.random(1, 6),
      book_status: Math.random() < 0.5,
      structure: 'Kết cấu',
      direction: DIRECTION_ENUM[_.random(0, 7)],
      note: 'Ghi chú',
    };
    // console.log(dataInsert, dataDetail);
    const response = await realEstateService.insertRealEstate(
      {
        ...dataInsert,
      },
      {
        ...dataDetail,
      },
    );
    console.log(response);
  }
})();
parentPort.postMessage(counter);
