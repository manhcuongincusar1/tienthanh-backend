const {
  exportService,
  EXPORT_STATUS_ENUM,
} = require('../services/exportService');

const {DIRECTION_ENUM} = require('../services/importService');
const realEstateService = require('../services/realEstateService');
const _ = require('lodash');
const dayjs = require('dayjs');
const {Worker} = require('worker_threads');
const saleService = require('../services/saleService');
const {
  Parser,
  AsyncParser,
  transforms: {unwind},
} = require('json2csv');
const fs = require('fs');
const {ceil} = require('lodash/math');
const Constants = require('../common/constants');
const {mailService} = require('../services/mailService');
const userService = require('../services/userService');
const {createExportTemplate} = require('../common/templates/email');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
const REAL_LOCATION = {
  facede: 1,
  alley_moto: 2,
  alley_car: 3,
};
const REAL_LOCATION_ENUM = {
  [REAL_LOCATION.facede]: 'Mặt tiền',
  [REAL_LOCATION.alley_moto]: 'Hẻm xe máy',
  [REAL_LOCATION.alley_car]: 'Hẻm xe hơi',
};
/**
 *
 * @param currentPage
 * @param meta_data
 * @param user_id
 * @returns {Promise<boolean|{count: number, realEstateList: T}>}
 */
const getDataForExport = (currentPage, meta_data = {}, user_id) => {
  meta_data.offset = meta_data.limit * currentPage - meta_data.limit;
  return realEstateService.getList(meta_data, {}, user_id);
};

const buildDirectoryByDate = () => {
  const date = new Date();
  var currDate = date.getDate();
  var currMonth = date.getMonth() + 1;
  var currYear = date.getFullYear();
  if (currMonth < 10) currMonth = '0' + currMonth;
  if (currDate < 10) currDate = '0' + currDate;

  return currYear + '/' + currMonth + '/' + currDate;
};

async function executeQueue() {
  const listExportQueue = await exportService.getListWaitingExportQueue();

  if (!_.isEmpty(listExportQueue)) {
    const dirExport =
      Constants.DIR_DOWNLOAD +
      '/' +
      Constants.DIR_EXPORT +
      '/' +
      buildDirectoryByDate();
    const directory = 'public' + '/' + dirExport;
    fs.mkdir(directory, {recursive: true}, (err) => {
      if (err) {
        console.log(err);
      }
    });
    const listId = _.values(
      _.mapValues(listExportQueue, (exportData) => {
        return exportData.id;
      }),
    );
    await exportService.exportUpdate(
      {listId},
      {
        status: EXPORT_STATUS_ENUM.EXECUTION,
        modification_date: dayjs().utc(),
      },
    );
    //Duyệt qua từng danh sách cần export
    const fields = [
      {label: 'Ngày tạo', value: 'created_date'},
      {label: 'Địa chỉ', value: 'address'},
      {label: 'Đường', value: 'street'},
      {label: 'Phường/xã', value: 'ward'},
      {label: 'Quận/huyện', value: 'district'},
      {label: 'Tỉnh/Thành phố', value: 'province_city'},
      {
        label: 'Vị trí',
        value: (row, field) => {
          if (!_.isEmpty(row)) {
            let {location} = row;
            return REAL_LOCATION_ENUM[location];
          } else {
            field.default;
          }
        },
        default: '',
      },
      {
        label: 'Hướng',
        value: (row, field) => {
          if (!_.isEmpty(row)) {
            let {direction} = row;
            return DIRECTION_ENUM[direction];
          } else {
            return field.default;
          }
        },
        default: '',
      },
      {label: 'Ngang', value: 'detail.horizontal'},
      {label: 'Dài', value: 'detail.long'},
      {label: 'Kết cấu', value: 'detail.structure'},
      {label: 'Diện tích công nhận (m2)', value: 'detail.recognized_area'},
      {label: 'Giá (tỷ VND)', value: 'price'},
      {
        label: 'Hợp tác',
        value: (row, field) => {
          if (!_.isEmpty(row)) {
            const {agency} = row;
            return agency ? 'Yes' : 'No';
          } else {
            return field.default;
          }
        },
        default: '',
      },
      {label: 'Phí môi giới', value: 'brokerage_fees'},
      {label: 'Tên người môi giới', value: 'broker_full_name'},
      {label: 'Số điện thoại người môi giới', value: 'broker_phone_number'},
      {label: 'Tên người bán/chủ nhà', value: 'saler_full_name'},
      {label: 'Số điện thoại người bán/chủ nhà', value: 'saler_phone_number'},
      {label: 'Ghi chú', value: 'detail.note'},
      {label: 'Người xử lý', value: 'creator'},
    ];

    _.each(listExportQueue, async (exportData) => {
      const {meta_data, id, user_id, type} = exportData;
      const userPersonalInfo = await userService.getPersonalInfoByUserId(
        user_id,
      );
      try {
        const fileName = `EXPORT-BDS-${dayjs()
          .tz('Asia/Ho_Chi_Minh')
          .format('DD-MM-YYYY_H_mm_ss_SSS')}`;
        const filePath = `${directory}/${fileName}.csv`;
        const filePathNoPublic = `${dirExport}/${fileName}.csv`;
        const output = fs.createWriteStream(filePath, {
          encoding: 'utf8',
          flags: 'a',
        });
        const newFields = fields?.map((field) => {
          if (field.value === 'price') {
            field.label = type === 1 ? 'Giá (tỷ VND)' : 'Giá (triệu VND)';
          }
          if (field.value === 'saler_full_name') {
            field.label =
              type === 1
                ? 'Tên người bán/chủ nhà'
                : 'Tên người cho thuê/chủ nhà';
          }
          if (field.value === 'saler_phone_number') {
            field.label =
              type === 1
                ? 'Số điện thoại người bán/chủ nhà'
                : 'Số điện thoại người cho thuê/chủ nhà';
          }
          return field;
        });
        meta_data.limit = 100;
        meta_data.type = type;
        const transformOpts = {
          highWaterMark: 8192,
          encoding: 'utf-8',
        };

        let {myRecord, creator, mySubscribe} = meta_data;
        if (myRecord === true) {
          if (_.isArray(creator)) {
            creator.push(user_id);
          } else {
            creator = [user_id];
          }
        }
        meta_data.creatorId = creator;
        meta_data.subscribeId = mySubscribe === true ? user_id : null;

        const asyncParser = new AsyncParser(
          {fields: newFields, withBOM: true},
          transformOpts,
        );
        asyncParser.toOutput(output);
        let csv = '';
        asyncParser.processor
          .on('data', (chunk) => {
            csv += chunk.toString();
          })
          .on('end', () => {
            asyncParser.fromInput(csv);
          })
          .on('error', (err) => console.error(err));
        const permissionInfo = await saleService.getSaleInfo(user_id);

        const {realEstateList, count} = await realEstateService.getList(
          {...meta_data, permissionInfo},
          {},
          user_id,
        );

        const totalPage = ceil(count / meta_data.limit);
        const newRealEstateList = realEstateList?.map((item) => {
          const {
            created_date,
            sale_phone,
            sale_full_name,
            broker_phone_number,
            address,
          } = item;

          return {
            ...item,
            address: '="' + address + '"',
            created_date:
              created_date &&
              dayjs?.utc(created_date)?.add(7, 'hour')?.format('DD/MM/YYYY'),
            broker_phone_number:
              broker_phone_number?.length === 10
                ? // ? `'${broker_phone_number}'`
                  '="' + broker_phone_number + '"'
                : broker_phone_number,
            saler_full_name: sale_full_name,
            saler_phone_number:
              sale_phone?.length === 10
                ? // ? `'${sale_phone}'`
                  '="' + sale_phone + '"'
                : sale_phone,
          };
        });

        asyncParser.input.push(JSON.stringify(newRealEstateList));
        if (totalPage > 1) {
          for (let i = 2; i <= totalPage; i++) {
            let {realEstateList} = await getDataForExport(
              i,
              meta_data,
              user_id,
            );

            const newRealEstateList = realEstateList?.map((item) => {
              const {
                created_date,
                sale_phone,
                sale_full_name,
                broker_phone_number,
                address,
              } = item;

              return {
                ...item,
                address: '="' + address + '"',
                created_date:
                  created_date &&
                  dayjs(created_date).utc(true)?.format('DD/MM/YYYY'),
                broker_phone_number:
                  broker_phone_number?.length === 10
                    ? // ? `'${broker_phone_number}'`
                      '="' + broker_phone_number + '"'
                    : broker_phone_number,
                saler_full_name: sale_full_name,
                saler_phone_number:
                  sale_phone?.length === 10
                    ? // ? `'${sale_phone}'`
                      '="' + sale_phone + '"'
                    : sale_phone,
              };
            });
            asyncParser.input.push(JSON.stringify(newRealEstateList));
          }
        }

        asyncParser.input.push(null);
        output.end();

        await exportService.exportUpdate(
          {listId: [id]},
          {
            file_path: filePathNoPublic,
            file_name: fileName,
            status: EXPORT_STATUS_ENUM.SUCCESS,
            modification_date: dayjs().utc(),
          },
        );

        await mailService.createMail({
          toMail: userPersonalInfo.username,
          subject: 'Yêu cầu Export của bạn đã được xử lý',
          content: createExportTemplate({
            full_name: userPersonalInfo.full_name,
            link: `${Constants.FO_DOMAIN_URL}/import-export/export`,
          }),
        });
      } catch (e) {
        console.error(e.toString());
      }
    });
  }
}

module.exports = {executeQueue};
