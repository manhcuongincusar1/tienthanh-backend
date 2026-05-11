const {workerData, parentPort} = require('worker_threads');
const customerService = require('../services/customerService');
const _ = require('lodash');
const dayjs = require('dayjs');
const dayjsRandom = require('dayjs-random');
dayjs.extend(dayjsRandom);

const NOTE_LIST = [
  'Chỉ có nhu cầu nhà phố',
  'Chỉ có nhu cầu nhà phố',
  'Chỉ có nhu cầu nhà view biển',
  'Chỉ có nhu cầu nhà trong ngõ',
  'Nhu cầu nhà thoáng mát',
  'Nhu cầu biệt thự đồi',
  'Nhu cầu nhà ở',
  'Nhu cầu nhà kinh doanh',
  'Nhu cầu nhà kết cấu hạ tầng tốt',
  'Nhu cầu nhà kết cấu hạ tầng tốt',
  'Nhu cầu đất cứng',
];
const DEMAND_RENT = [
  'Nhu cầu thuê để ở',
  'Nhu cầu thuê để ở',
  'Nhu cầu thuê để kinh doanh',
  'Nhu cầu thuê bán hàng',
  'Nhu cầu thuê làm quán coffee',
  'Thuê để ở',
  'Thuê để bán hàng',
  'Thuê để làm quán bánh mỳ',
  'Thuê để làm quán nhậu',
  'Thuê để bán điện thoại',
  'Thuê để làm gì',
];
const DEMAND_BUY = [
  'Nhu cầu thuê để ở',
  'Nhu cầu thuê để ở',
  'Mua để ở',
  'Mua để kinh doanh',
  'Mua để bán coffee',
  'Mua để bán hàng',
  'Mua để bán bánh mỳ',
  'Mua để làm nhà hàng',
  'Mua để bán điện thoại',
  'Mua để bán bánh ngọt',
  'Mua để làm gì đó',
  'Mua để đầu tư',
];
const {numberCustomer, dataForGenerate} = workerData;
let counter = 0;
(async () => {
  const {
    user_id,
    start_date,
    end_date,
    districts_id,
    province_city_id,
    create_buy,
    create_rent,
  } = dataForGenerate;
  const character = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

  for (let i = 0; i < numberCustomer; i++) {
    const dataDemandBuy = [];
    const dataDemandRent = [];
    const phoneNumber = '0989' + Math.floor(Math.random() * 899999 + 100000);
    const goodwill = Math.random() < 0.5;

    let created_at;
    if (start_date && end_date) {
      created_at = dayjs.between(start_date, end_date).format('YYYY-MM-DD');
    } else {
      created_at = dayjs().format('YYYY-MM-DD');
    }

    if (create_buy) {
      for (let j = 0; j < 10; j++) {
        const newDataDemandBuy = {
          type: 1,
          price_from: _.random(1, 400),
          price_to: _.random(401, 999),
          note: NOTE_LIST[_.random(10)],
          uses: DEMAND_BUY[_.random(10)],
          created_at: created_at,
          districts_id: districts_id,
          province_city_id: province_city_id,
        };
        dataDemandBuy.push(newDataDemandBuy);
      }
    }
    if (create_rent) {
      for (let j = 0; j < 10; j++) {
        const newDataDemandRent = {
          type: 2,
          price_from: _.random(1, 400),
          price_to: _.random(401, 999),
          note: NOTE_LIST[_.random(10)],
          uses: DEMAND_RENT[_.random(10)],
          created_at: created_at,
          province_city_id: province_city_id,
          districts_id: districts_id,
        };
        dataDemandRent.push(newDataDemandRent);
      }
    }

    const response = await customerService.insertCustomerBuyRent({
      phone_main: phoneNumber,
      created_at: created_at,
      full_name: character
        .split('')
        .sort(() => Math.random() - 0.5)
        .slice(1, 10)
        .join(''),
      goodwill: goodwill,
      user_id: user_id,
      data_demand: [...dataDemandRent, ...dataDemandBuy],
    });
    console.log(response);
  }
})();
parentPort.postMessage(counter);
