const realEstateCategoryService = require('../services/realEstateCategoryService');
const realEstateStatusService = require('../services/realEstateStatusService');
const realEstateService = require('../services/realEstateService');
const userService = require('../services/userService');
const _ = require('lodash');
const dayjs = require('dayjs');
const fs = require('fs');
const ExcelJS = require('exceljs');
const {
  importService,
  IMPORT_STATUS_ENUM,
  REAL_LOCATION_ENUM,
  DIRECTION_ENUM,
} = require('../services/importService');
const REGULAR_EXPRESSION = require('../common/regularExpression');
const {httpGet} = require('../request/httpRequest');
const Constants = require('../common/constants');
const {
  createImportTemplateFail,
  createImportTemplateSuccess,
} = require('../common/templates/email');
const Common = require('../common/common');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
const {mailService} = require('../services/mailService');

let provinceLists = [];
let districtLists = [];
let wardLists = [];
let streetLists = [];
let realEstateCategoryResult = {};
let realEstateStatusResult = {};
let listSuccessData = [];
let listFailData = [];
let intervalId;

const buildDirectoryByDate = () => {
  const date = new Date();
  var currDate = date.getDate();
  var currMonth = date.getMonth() + 1;
  var currYear = date.getFullYear();
  if (currMonth < 10) currMonth = '0' + currMonth;
  if (currDate < 10) currDate = '0' + currDate;
  return currYear + '/' + currMonth + '/' + currDate;
};

const generateErrorMessage = (type) => {
  const error_message_owner_full_name =
    type === Constants?.REAL_ESTATE_TYPE_ENUM.SELL
      ? 'Tên người bán/chủ nhà'
      : 'Tên người cho thuê/chủ nhà';
  const error_message_owner_phone_number =
    type === Constants?.REAL_ESTATE_TYPE_ENUM.SELL
      ? 'Số điện thoại người bán/chủ nhà'
      : 'Số điện thoại người cho thuê/chủ nhà';

  return {error_message_owner_full_name, error_message_owner_phone_number};
};

const validateDataImport = async (dataImportQueue, output_file) => {
  try {
    const {type, branch_id, file_path} = dataImportQueue;
    let isOk = true,
      totalRow = 0,
      successRow = 0;
    const workbook = new ExcelJS.Workbook();
    const wb = await workbook.xlsx.readFile(file_path);
    const outputWb = await workbook.xlsx.readFile(output_file);

    const worksheet = wb.getWorksheet('Template-import-file');
    outputWb.removeWorksheet('Template-import-file');

    const outputWs = outputWb.addWorksheet('Template-import-file', {
      properties: worksheet?.properties,
      views: worksheet?.views,
      headerFooter: worksheet?.headerFooter,
      pageSetup: worksheet?.pageSetup,
      state: worksheet?.state,
    });

    const tableDef = worksheet?.getTable('ListImport');

    outputWs.addTable({
      name: tableDef?.table?.name,
      ref: 'A1',
      style: {
        ...tableDef?.table?.style,
      },
      columns: [
        ...tableDef?.table.columns,
        {
          name: 'Field Bị Trống',
        },
        {
          name: 'Không Đúng Định Dạng',
        },
        {
          name: 'Không Có Trong Hệ Thống',
        },
      ],
      rows: [],
    });

    const tableImportFailed = outputWs?.getTable('ListImport');

    const header = worksheet.getRow(1);

    const newHeader = header?.values?.reduce((acc, item, index) => {
      if (item) {
        return {...acc, [item]: index};
      }
      return acc;
    }, {});

    const MASTER_COLUMN_IMPORT =
      type === Constants?.REAL_ESTATE_TYPE_ENUM?.SELL
        ? [
            ...Constants?.MASTER_COLUMN_IMPORT,
            ...Constants?.MASTER_COLUMN_IMPORT_SELL,
          ]
        : [
            ...Constants?.MASTER_COLUMN_IMPORT,
            ...Constants?.MASTER_COLUMN_IMPORT_RENT,
          ];

    const isValidColumn = MASTER_COLUMN_IMPORT?.every(
      (item) => newHeader[item],
    );

    if (
      !isValidColumn ||
      header.values.length - 1 !== MASTER_COLUMN_IMPORT?.length
    ) {
      return {
        error: 'invalid_column_error',
        successRow: 0,
        totalRow: undefined,
      };
    }

    totalRow = worksheet.actualRowCount - 1;
    for (let i = 1; i <= worksheet.actualRowCount; i++) {
      let provinceId,
        districtId,
        wardId,
        streetId,
        realEstateStatusId,
        realEstateCategoryId,
        messageEmpty = [],
        messageInvalid = [],
        messageNotFound = [],
        is_show_internal = false,
        previous_real_estate_status = '';
      if (i === 1) {
        continue;
      }

      const row = worksheet.getRow(i);

      const record = row.values;
      const recordRowData = Common.parseRecordRowImportRealEstate(
        record,
        newHeader,
        type,
      );

      let {
        created_at,
        status_title,
        category_title,
        address,
        street_title,
        ward_title,
        district_title,
        province_city_title,
        saler_full_name,
        saler_phone_number,
        broker_full_name,
        broker_phone_number,
        goodwill,
        price,
        agency,
        brokerage_fees,
        internal_sell,
        direction,
        location,
        width,
        length,
        recognized_area,
        bedroom,
        wc,
        book_status,
        structure,
        note,
        creator_email,
      } = recordRowData;
      let creatorInfo;

      if (typeof recognized_area === 'object') {
        throw 'error_formular_recognized_area';
      }

      if (
        creator_email &&
        typeof creator_email === 'object' &&
        creator_email?.text
      ) {
        creator_email = creator_email.text?.toString()?.trim();
      } else {
        creator_email = creator_email?.toString()?.trim();
      }

      if (!creator_email) {
        messageEmpty.push('Email người xử lý');
      } else if (
        creator_email &&
        creator_email.match(REGULAR_EXPRESSION.CHECK_EMAIL)
      ) {
        const userByEmail = await userService.checkUserExistWhenImport({
          username: creator_email,
        });

        if (!userByEmail?.id) {
          messageNotFound.push('Email người xử lý');
        } else {
          creatorInfo = userByEmail;
        }
      } else {
        messageInvalid.push('Email người xử lý');
      }

      if (
        agency &&
        agency?.toLowerCase() ===
          Constants.STATUS_TOGGLE_IMPORT.YES?.toLowerCase()
      ) {
        const {
          error_message_owner_phone_number,
          error_message_owner_full_name,
        } = generateErrorMessage(type);
        if (!broker_full_name) {
          messageEmpty.push('Tên người môi giới');
        }
        if (!broker_phone_number) {
          messageEmpty.push('Số điện thoại người môi giới');
        }
        if (saler_full_name && !saler_phone_number) {
          messageEmpty.push(error_message_owner_phone_number);
        }
        if (saler_phone_number && !saler_full_name) {
          messageEmpty.push(error_message_owner_full_name);
        }
      } else if (
        agency &&
        agency?.toLowerCase() !==
          Constants.STATUS_TOGGLE_IMPORT.NO?.toLowerCase() &&
        agency?.toLowerCase() !==
          Constants.STATUS_TOGGLE_IMPORT.YES?.toLowerCase()
      ) {
        messageInvalid.push('Hợp tác(Nhập: Yes hoặc No)');
      } else {
        const {
          error_message_owner_phone_number,
          error_message_owner_full_name,
        } = generateErrorMessage(type);
        if (!saler_phone_number) {
          messageEmpty.push(error_message_owner_phone_number);
        }
        if (!saler_full_name) {
          messageEmpty.push(error_message_owner_full_name);
        }
      }
      if (
        saler_phone_number &&
        !saler_phone_number?.match(REGULAR_EXPRESSION.CHECK_PHONE_NUMBER)
      ) {
        const {error_message_owner_phone_number} = generateErrorMessage(type);
        messageInvalid.push(error_message_owner_phone_number);
      }

      if (
        broker_phone_number &&
        !broker_phone_number?.match(REGULAR_EXPRESSION.CHECK_PHONE_NUMBER)
      ) {
        messageInvalid.push('Số điện thoại người môi giới');
      }

      if (!price) {
        messageEmpty.push('Giá');
      } else if (
        price &&
        price?.toString()?.match(REGULAR_EXPRESSION.CHECK_REAL_ESTATE_PRICE)
      ) {
        price = Number(price);
      } else {
        messageInvalid.push('Giá (chữ số)');
      }

      if (!width) {
        messageEmpty.push('Chiều ngang');
      } else if (
        width &&
        width
          ?.toString()
          ?.match(REGULAR_EXPRESSION.CHECK_MEASURE_DECIMAL_NUMBER)
      ) {
        width = Number(width);
      } else {
        messageInvalid.push('Chiều ngang (chữ số)');
      }

      if (!length) {
        messageEmpty.push('Chiều dài');
      } else if (
        length &&
        length
          ?.toString()
          ?.match(REGULAR_EXPRESSION.CHECK_MEASURE_DECIMAL_NUMBER)
      ) {
        length = Number(length);
      } else {
        messageInvalid.push('Chiều dài (chữ số)');
      }
      if (!recognized_area && type === Constants.REAL_ESTATE_TYPE_ENUM.SELL) {
        messageEmpty.push('Diện tích công nhận');
      } else if (recognized_area) {
        if (
          recognized_area
            .toString()
            .match(REGULAR_EXPRESSION.CHECK_DECIMAL_AREA_NUMBER)
        ) {
          recognized_area = Number(recognized_area.toString()?.trim());
          if (Common.countDecimals(recognized_area) > 3) {
            recognized_area = _.round(recognized_area, 3);
          }
        } else {
          messageInvalid.push('Diện tích công nhận (chữ số)');
        }
      }

      if (type === Constants.REAL_ESTATE_TYPE_ENUM.SELL) {
        if (!brokerage_fees) {
          messageEmpty.push('Phí môi giới');
        } else if (
          Number(brokerage_fees) <= 100 &&
          Number(brokerage_fees) >= 0
        ) {
          brokerage_fees = Number(brokerage_fees);
        } else {
          messageInvalid.push('Phí môi giới');
        }
      } else if (brokerage_fees) {
        if (Number(brokerage_fees) && brokerage_fees?.toString()?.match(REGULAR_EXPRESSION.CHECK_REAL_ESTATE_PRICE)) {
          brokerage_fees = Number(brokerage_fees);
        } else {
          messageInvalid.push('Phí môi giới');
        }
      }

      if (
        bedroom &&
        bedroom?.toString()?.match(REGULAR_EXPRESSION.CHECK_INTEGER_NUMBER)
      ) {
        bedroom = Number(bedroom);
      } else if (bedroom) {
        messageInvalid.push('Phòng ngủ (Số nguyên)');
      }
      if (
        wc &&
        wc?.toString()?.match(REGULAR_EXPRESSION.CHECK_INTEGER_NUMBER)
      ) {
        wc = Number(wc);
      } else if (wc) {
        messageInvalid.push('Nhà vệ sinh (Số nguyên)');
      }

      if (
        book_status &&
        book_status?.toLowerCase() !==
          Constants.STATUS_TOGGLE_IMPORT.YES?.toLowerCase() &&
        book_status?.toLowerCase() !==
          Constants.STATUS_TOGGLE_IMPORT.NO?.toLowerCase()
      ) {
        messageInvalid.push('Sổ hồng (Nhập: Yes hoặc No)');
      }

      if (
        goodwill &&
        goodwill?.toLowerCase() !==
          Constants.STATUS_TOGGLE_IMPORT.YES?.toLowerCase() &&
        goodwill?.toLowerCase() !==
          Constants.STATUS_TOGGLE_IMPORT.NO?.toLowerCase()
      ) {
        messageInvalid.push('Thiện chí (Nhập: Yes hoặc No)');
      }

      if (
        internal_sell &&
        internal_sell?.toLowerCase() !==
          Constants.STATUS_TOGGLE_IMPORT.YES?.toLowerCase() &&
        internal_sell?.toLowerCase() !==
          Constants.STATUS_TOGGLE_IMPORT.NO?.toLowerCase()
      ) {
        messageInvalid.push('Nội bộ bán (Nhập: Yes hoặc No)');
      }

      if (category_title) {
        const {realEstateCategoryList, count: countCategory} =
          realEstateCategoryResult;

        const categoryIndex = _.findIndex(realEstateCategoryList, (item) => {
          return item?.title?.toLowerCase() === category_title?.toLowerCase();
        });

        if (countCategory > 0 && categoryIndex < 0) {
          messageNotFound.push('Danh mục');
        } else {
          realEstateCategoryId = realEstateCategoryList[categoryIndex].id;
          category_title = realEstateCategoryList[categoryIndex].title;
        }
      } else {
        messageEmpty.push('Danh mục');
      }

      if (status_title) {
        const {realEstateStatusList, count: countStatus} =
          realEstateStatusResult;

        const statusIndex = _.findIndex(realEstateStatusList, (item) => {
          return (
            item?.title?.toLowerCase() === status_title.toLowerCase() &&
            item.type === type
          );
        });

        if (countStatus > 0 && statusIndex < 0) {
          messageNotFound.push('Trạng thái');
        } else {
          realEstateStatusId = realEstateStatusList[statusIndex].id;
          is_show_internal = realEstateStatusList[statusIndex].is_show_internal;
          previous_real_estate_status = realEstateStatusList[statusIndex].title;
        }
      } else {
        messageEmpty.push('Trạng thái');
      }

      if (province_city_title) {
        const provinceIndex = _.findIndex(provinceLists, (item) => {
          return (
            item?.display_title?.toLowerCase() ===
            province_city_title?.toLowerCase()
          );
        });
        if (provinceIndex < 0) {
          messageNotFound.push('Tỉnh thành phố');
        } else {
          provinceId = provinceLists[provinceIndex].id;
          province_city_title = provinceLists[provinceIndex]?.display_title;
        }
      } else {
        messageEmpty.push('Tỉnh thành phố');
      }

      if (district_title) {
        if (provinceId) {
          const districtIndex = _.findIndex(districtLists, (item) => {
            return (
              item?.display_title?.toLowerCase() ===
                district_title?.toLowerCase() &&
              item?.province_city?.id === provinceId
            );
          });
          if (districtIndex < 0) {
            messageNotFound.push('Quận/Huyện');
          } else {
            districtId = districtLists[districtIndex].id;
            district_title = districtLists[districtIndex]?.display_title;
          }
        }
      } else {
        messageEmpty.push('Quận/Huyện');
      }

      if (ward_title) {
        if (districtId && provinceId) {
          const wardIndex = _.findIndex(wardLists, (item) => {
            return (
              item?.display_title?.toLowerCase() ===
                ward_title?.toLowerCase() && item?.districts?.id === districtId
            );
          });
          if (wardIndex < 0) {
            messageNotFound.push('Phường/xã');
          } else {
            wardId = wardLists[wardIndex].id;
            ward_title = wardLists[wardIndex]?.display_title;
          }
        }
      } else {
        messageEmpty.push('Phường/xã');
      }

      if (street_title) {
        if (districtId && provinceId && wardId) {
          const streetIndex = _.findIndex(streetLists, (item) => {
            return (
              item?.display_title?.toLowerCase() ===
                street_title?.toLowerCase() &&
              item?.districts?.id === districtId
            );
          });
          if (streetIndex < 0) {
            messageNotFound.push('Đường');
          } else {
            streetId = streetLists[streetIndex].id;
            street_title = streetLists[streetIndex]?.display_title;
          }
        }
      } else {
        messageEmpty.push('Đường');
      }

      if (address) {
        const str = address?.toString()?.trim();
        const newStr = str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'D');
        if (!newStr?.toString().match(REGULAR_EXPRESSION.CHECK_ADDRESS)) {
          messageInvalid.push('Địa chỉ (nhập: chữ, số , - , /)');
        } else {
          address = str;
        }
      } else {
        messageEmpty.push('Địa chỉ');
      }

      let locationIndex;
      if (!location) {
        messageEmpty.push('Vị trí');
      } else {
        locationIndex = _.findKey(REAL_LOCATION_ENUM, (value) => {
          return value?.toLowerCase() === location?.toLowerCase();
        });

        if (!locationIndex) {
          messageNotFound.push('Vị trí');
        }
      }

      const directionIndex = _.findKey(DIRECTION_ENUM, (value) => {
        return value?.toLowerCase() === direction?.toLowerCase();
      });

      if (direction && !directionIndex) {
        messageNotFound.push('Hướng');
      }

      if (!structure) {
        messageEmpty.push('Kết cấu');
      }

      if (_.isUndefined(created_at)) {
        messageEmpty.push('Ngày tạo');
      } else if (dayjs(created_at, 'DD/MM/YYYY').isValid()) {
        const createdAtParse = dayjs(created_at, 'DD/MM/YYYY').isValid()
          ? created_at
          : dayjs(created_at)?.format('DD/MM/YYYY');

        created_at = dayjs(createdAtParse, 'DD/MM/YYYY')
          .utc(true)
          .subtract(7, 'hour');

        const currentDateUTC = dayjs().utc(true);

        if (currentDateUTC.diff(created_at, 'hour') <= 0) {
          messageInvalid.push('Ngày Tạo (Không nhập ngày tương lai)');
        }
      } else {
        messageInvalid.push('Ngày Tạo (Định dạng đúng DD/MM/YYYY)');
      }

      const newMessageEmpty = [...new Set(messageEmpty)];
      const newMessageNotfound = [...new Set(messageNotFound)];
      const newMessageInvalid = [...new Set(messageInvalid)];

      if (!_.isEmpty(newMessageEmpty)) {
        record[29] = newMessageEmpty.join(', ');
      }
      if (!_.isEmpty(newMessageInvalid)) {
        record[30] = newMessageInvalid.join(', ');
      }
      if (!_.isEmpty(newMessageNotfound)) {
        record[31] = newMessageNotfound.join(', ');
      }

      row.values = record;

      isOk =
        _.isEmpty(messageEmpty) &&
        _.isEmpty(messageNotFound) &&
        _.isEmpty(messageInvalid);
      if (isOk && record) {
        let dataRealEstate = {};
        let dataRealEstateDetail = {};
        dataRealEstate.created_at = created_at;
        dataRealEstate.creator_sale_id = creatorInfo?.id;
        dataRealEstate.saler_full_name = saler_full_name;
        dataRealEstate.saler_phone_number = saler_phone_number;
        dataRealEstate.broker_full_name = broker_full_name;
        dataRealEstate.broker_phone_number = broker_phone_number;
        dataRealEstate.type = type;
        dataRealEstate.branch_id = branch_id;
        dataRealEstate.address = address;
        dataRealEstate.price = price;
        dataRealEstate.goodwill =
          goodwill?.toLowerCase() ===
          Constants.STATUS_TOGGLE_IMPORT.YES?.toLowerCase();
        dataRealEstate.agency =
          agency?.toLowerCase() ===
          Constants.STATUS_TOGGLE_IMPORT.YES?.toLowerCase();
        dataRealEstate.brokerage_fees = brokerage_fees;
        dataRealEstate.province_city_id = provinceId;
        dataRealEstate.district_title = district_title;
        dataRealEstate.province_city_title = province_city_title;
        dataRealEstate.ward_title = ward_title;
        dataRealEstate.street_title = street_title;
        dataRealEstate.district_id = districtId;
        dataRealEstate.ward_id = wardId;
        dataRealEstate.street_id = streetId;
        dataRealEstate.category_id = realEstateCategoryId;
        dataRealEstate.category_title = category_title;
        dataRealEstate.real_estate_status_id = realEstateStatusId;
        dataRealEstate.location = locationIndex;
        dataRealEstate.direction = directionIndex;

        if (is_show_internal) {
          if (_.isEmpty(internal_sell)) {
            dataRealEstate.is_internal = false;
          } else {
            dataRealEstate.is_internal =
              internal_sell?.toLowerCase() ===
              Constants.STATUS_TOGGLE_IMPORT.YES?.toLowerCase();
          }
        }

        if (
          dataRealEstate.province_city_id &&
          dataRealEstate.district_id &&
          dataRealEstate.street_id &&
          dataRealEstate.ward_id &&
          dataRealEstate.address
        ) {
          const {is_duplicate} =
            await realEstateService.checkDuplicateRealEstate({
              province_city_id: dataRealEstate.province_city_id,
              district_id: dataRealEstate.district_id,
              street_id: dataRealEstate.street_id,
              ward_id: dataRealEstate.ward_id,
              type,
              address: dataRealEstate.address,
              real_estate_status_id: dataRealEstate.real_estate_status_id,
              branch_id: branch_id,
            });

          dataRealEstate.duplicate = is_duplicate;
          dataRealEstate.previous_real_estate_status =
            previous_real_estate_status;
        } else {
          return;
        }

        dataRealEstateDetail.horizontal = width;
        dataRealEstateDetail.long = length;
        dataRealEstateDetail.recognized_area = recognized_area;
        dataRealEstateDetail.bedroom = bedroom;
        dataRealEstateDetail.wc = wc;
        dataRealEstateDetail.book_status =
          book_status?.toLowerCase() ===
          Constants.STATUS_TOGGLE_IMPORT.YES?.toLowerCase();
        dataRealEstateDetail.structure = structure;
        dataRealEstateDetail.note = note;

        const response = await realEstateService.insertRealEstate(
          {
            ...dataRealEstate,
            creator_sale_id: creatorInfo?.id,
            full_name: creatorInfo?.full_name,
          },
          {
            ...dataRealEstateDetail,
          },
        );

        if (response) {
          successRow += 1;
          listSuccessData.push(record);
        }
      } else {
        const recordRowNew = _.map(record, (value) => {
          return value;
        });
        recordRowNew.shift();
        tableImportFailed?.addRow(recordRowNew);
      }
      if (tableImportFailed.table.columns.length < 25) {
        throw 'invalid_column_error';
      }

      tableImportFailed?.commit();

      outputWs.getColumn(29).eachCell((cell, cellNumber) => {
        if (cellNumber === 1) {
          cell.border = {
            left: {style: 'thin', color: {argb: 'ff949494'}},
            right: {style: 'thin', color: {argb: 'ff949494'}},
          };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: {argb: 'ffe91b11'},
          };
          return;
        }
      });

      outputWs.getColumn(30).eachCell((cell, cellNumber) => {
        if (cellNumber === 1) {
          cell.border = {
            left: {style: 'thin', color: {argb: 'ff949494'}},
            right: {style: 'thin', color: {argb: 'ff949494'}},
          };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: {argb: 'ffe91b11'},
          };
          return;
        }
      });
      outputWs.getColumn(31).eachCell((cell, cellNumber) => {
        if (cellNumber === 1) {
          cell.border = {
            left: {style: 'thin', color: {argb: 'ff949494'}},
            right: {style: 'thin', color: {argb: 'ff949494'}},
          };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: {argb: 'ffe91b11'},
          };
          return;
        }
      });

      listFailData.push(record);
    }

    // await workbook.xlsx.writeFile(file_path);
    await workbook.xlsx.writeFile(output_file);

    return {
      totalRow,
      successRow,
    };
  } catch (error) {
    console.log('Error import', error);
    if (
      error?.message?.includes('Worksheet') ||
      error?.message?.includes('iterable')
    ) {
      return {
        error: 'worksheet_name_error',
        successRow: 0,
        totalRow: undefined,
      };
    }

    clearInterval(intervalId);
    return {
      error: error || 'import_failed_error',
      successRow: 0,
      totalRow: undefined,
    };
  }
};

const executeImportQueue = async () => {
  const execQueue = await importService.getOneExecImportQueue();

  if (!_.isEmpty(execQueue)) {
    const currentDate = dayjs().utc();
    const modicationDate = dayjs(execQueue?.modification_date);

    if (
      currentDate.diff(modicationDate, 'minute') >=
      Constants.EXCUTING_CRON_KILL_TIME
    ) {
      await importService.importUpdate(
        {listId: [execQueue?.id]},
        {
          status: IMPORT_STATUS_ENUM.FAIL,
          modification_date: dayjs().utc(),
        },
      );
    }
    return;
  }

  const importQueueSingle = await importService.getListWaitingImportQueue();

  if (!_.isEmpty(importQueueSingle)) {
    // const listId = _.values(_.mapValues(listImportQueue, (importData) => {
    //     return importData.id;
    // }),);
    await importService.importUpdate(
      {listId: [importQueueSingle.id]},
      {
        status: IMPORT_STATUS_ENUM.EXECUTION,
        modification_date: dayjs().utc(),
      },
    );

    intervalId = setInterval(async () => {
      await importService.importUpdate(
        {listId: [importQueueSingle.id]},
        {
          modification_date: dayjs().utc(),
        },
      );
    }, Constants.EXCUTING_CRON_UPDATE_TIME * 60000);

    realEstateCategoryResult = await realEstateCategoryService.getList({
      limit: 500,
      offset: 0,
    });
    realEstateStatusResult = await realEstateStatusService.getList({
      limit: 500,
      offset: 0,
    });
    const provinceResult = await httpGet(
      `${Constants.ADMINISTRATIVE_URL}/province/list`,
      {
        params: {
          limit: 100,
        },
      },
    );
    const {data: provinceData} = provinceResult.data;
    provinceLists = provinceData;

    const districtResult = await httpGet(
      `${Constants.ADMINISTRATIVE_URL}/district/list`,
      {
        params: {
          limit: 2000,
        },
      },
    );

    const {data: districtData} = districtResult.data;
    districtLists = districtData;

    const wardResult = await httpGet(
      `${Constants.ADMINISTRATIVE_URL}/ward/list`,
      {
        params: {
          limit: 20000,
        },
      },
    );

    const {data: wardData} = wardResult.data;
    wardLists = wardData;

    const streetResult = await httpGet(
      `${Constants.ADMINISTRATIVE_URL}/street/list`,
      {
        params: {
          limit: 20000,
        },
      },
    );
    const {data: streetData} = streetResult.data;
    streetLists = streetData;

    const dirImport =
      Constants.DIR_DOWNLOAD +
      '/' +
      Constants.DIR_IMPORT +
      '/' +
      buildDirectoryByDate();
    const directory = 'public' + '/' + dirImport;
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, {recursive: true}, (err) => {
        if (err) {
          console.log(err);
          return err;
        }
      });
    }

    const fileName = `IMPORT-BDS-${dayjs()
      .tz('Asia/Ho_Chi_Minh')
      .format('DD-MM-YYYY_H_mm_ss')}`;
    const outputFilePath = `${directory}/${fileName}.xlsx`;
    const outputFilePathNoPublic = `${dirImport}/${fileName}.xlsx`;
    console.info(performance.now());

    try {
      const userPersonalInfo = await userService.getPersonalInfoByUserId(
        importQueueSingle.user_id,
      );

      fs.copyFile(importQueueSingle.file_path, outputFilePath, (err) => {
        if (err) {
          return err;
        }
      });

      const {
        totalRow,
        successRow,
        error = 'import_failed_error',
      } = await validateDataImport(
        {
          file_path: importQueueSingle?.file_path,
          type: importQueueSingle?.type,
          branch_id: importQueueSingle?.branch_id,
        },
        outputFilePath,
      );

      if (successRow === 0) {
        await importService.importUpdate(
          {listId: [importQueueSingle.id]},
          {
            error_file_path: outputFilePathNoPublic,
            status: IMPORT_STATUS_ENUM.FAIL,
            modification_date: dayjs().utc(),
            note: error,
          },
        );
        await mailService.createMail({
          toMail: userPersonalInfo.username,
          subject: `Xin chào ${userPersonalInfo.full_name}`,
          content: createImportTemplateFail({
            full_name: userPersonalInfo.full_name,
            link: `${Constants.FO_DOMAIN_URL}/import-export/export`,
          }),
        });
      } else {
        const dataUpdate = {
          info: `${successRow}/${totalRow}`,
          status: IMPORT_STATUS_ENUM.SUCCESS,
          modification_date: dayjs().utc(),
        };
        if (successRow !== totalRow) {
          dataUpdate.error_file_path = outputFilePathNoPublic;
          dataUpdate.error_file_name = fileName || null;
        }
        await importService.importUpdate(
          {listId: [importQueueSingle.id]},
          dataUpdate,
        );
        await mailService.createMail({
          toMail: userPersonalInfo.username,
          subject: `Xin chào ${userPersonalInfo.full_name}`,
          content: createImportTemplateSuccess({
            full_name: userPersonalInfo.full_name,
            link: `${Constants.FO_DOMAIN_URL}/import-export/export`,
          }),
        });
      }
      console.info(performance.now());
    } catch (error) {
      clearInterval(intervalId);
      console.log(error);
    }
  }
};

module.exports = {executeImportQueue};
