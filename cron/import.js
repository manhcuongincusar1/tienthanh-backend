const realEstateCategoryService = require('../services/realEstateCategoryService');
const realEstateStatusService = require('../services/realEstateStatusService');
const realEstateService = require('../services/realEstateService');
const userService = require('../services/userService');
const _ = require('lodash');
const dayjs = require('dayjs');
const fs = require('fs');
const {parse, stringify} = require('csv');
const {
  importService,
  IMPORT_STATUS_ENUM,
  REAL_LOCATION_ENUM,
  DIRECTION_ENUM,
} = require('../services/importService');
const {httpGet} = require('../request/httpRequest');
const Constants = require('../common/constants');
const {
  createImportTemplateFail,
  createImportTemplateSuccess,
} = require('../common/templates/email');
const {mailService} = require('../services/mailService');
const {DATE_FORMATS} = require('../common/constants/dateUtils');
const listColumns = [
  'NgayTao',
  'TrangThai',
  'DanhMuc',
  'DiaChi',
  'Duong',
  'PhuongXa',
  'QuanHuyen',
  'TinhThanhPho',
  'SoDienThoaiSales',
  'TenSales',
  'SoDienThoaiChuNha',
  'TenChuNha',
  'ThienChi',
  'Gia',
  'PhiMoiGioi',
  'NoiBoBan',
  'Huong',
  'ViTri',
  'ChieuNgang',
  'ChieuDai',
  'DienTich(m2)',
  'DienTichCongNhan(m2)',
  'PhongTam',
  'NhaVeSinh',
  'SoHong',
  'KetCau',
  'GhiChu',
];
let provinceLists = [];
let districtLists = [];
let wardLists = [];
let streetLists = [];
let realEstateCategoryResult = {};
let realEstateStatusResult = {};
const checkDecimalNumber = new RegExp(/^[0-9]{1,4}((\.[0-9]{1,2})|)$/);
const checkFileFormat = async (file_path) => {
  let errorText = {};

  const parser = fs.createReadStream(file_path, {encoding: 'utf8'}).pipe(
    parse({
      to_line: 1,
      columns: true,
      relax_quotes: true,
      dom: true,
      escape: '\\',
      ltrim: true,
      rtrim: true,
    }),
  );

  for await (const record of parser) {
    // Work with each record
    _.each(record, (cell) => {
      if (!listColumns.includes(cell)) {
        errorText = {
          message: 'File Impport không giống định dạng',
        };
      }
    });
  }
  return errorText;
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

/**
 *
 * @param importId
 * @param input_file_path
 * @param output_file_path
 * @param type
 * @returns {Promise<{isOk: boolean, filePath}>}
 */
const validateDataImport = async (
  importId,
  input_file_path,
  output_file_path,
  type,
) => {
  let isOk = true;
  const output = fs.createWriteStream(output_file_path, {
    encoding: 'utf8',
    flags: 'a',
  });
  const stringifier = stringify({
    header: true,
    delimiter: ',',
  }).on('readable', function () {
    let row;
    while ((row = stringifier.read()) !== null) {
      output.write('\ufeff' + row, 'UTF8');
    }
  });

  let totalRow = 0;
  const parser = fs.createReadStream(input_file_path, {encoding: 'utf8'}).pipe(
    parse({
      delimiter: ',',
      columns: true,
      dom: true,
      relax_quotes: true,
      skip_empty_lines: true,
      escape: '\\',
      ltrim: true,
      trim: true,
    }).on('end', () => {
      // output.close();
    }),
  );

  for await (const record of parser) {
    let provinceId,
      districtId,
      wardId,
      streetId,
      realEstateStatusId,
      messageEmpty = [],
      messageInvalid = [],
      messageNotFound = [];

    if (!record?.['Gia*']) {
      messageEmpty.push('Giá');
    } else if (
      record?.['Gia*'] &&
      record?.['Gia*'].toString().match(checkDecimalNumber)
    ) {
      record['Gia*'] = Number(record?.['Gia*']);
    } else {
      messageInvalid.push('Giá (chữ số)');
    }

    if (!record?.['ChieuNgang*']) {
      messageEmpty.push('Chiều ngang');
    } else if (record?.['ChieuNgang*']) {
      record['ChieuNgang*'] = Number(record['ChieuNgang*']);
    } else {
      messageInvalid.push('Chiều ngang (chữ số)');
    }

    if (!record?.['ChieuDai*']) {
      messageEmpty.push('Chiều dài');
    } else if (record?.['ChieuDai*'] && Number(record?.['ChieuDai*'])) {
      record['ChieuDai*'] = Number(record?.['ChieuDai*']);
    } else {
      messageInvalid.push('Chiều dài (chữ số)');
    }

    if (!record['DienTichCongNhan(m2)*']) {
      messageEmpty.push('Diện tích công nhận');
    } else if (
      record['DienTichCongNhan(m2)*'] &&
      Number(record['DienTichCongNhan(m2)*'])
    ) {
      record['DienTichCongNhan(m2)*'] = Number(record['DienTichCongNhan(m2)*']);
    } else {
      messageInvalid.push('Diện tích công nhận (chữ số)');
    }

    if (!record?.['PhiMoiGioi*']) {
      messageEmpty.push('Phí môi giới');
    } else if (
      record?.['PhiMoiGioi*'] &&
      Number(record?.['PhiMoiGioi*']) < 100 &&
      Number(record?.['PhiMoiGioi*']) > 0
    ) {
      record['PhiMoiGioi*'] = Number(record?.['PhiMoiGioi*']);
    } else {
      messageInvalid.push('Phí môi giới');
    }

    if (
      record?.['SoDienThoaiSales*'] &&
      record?.['SoDienThoaiSales*'].length === 9
    ) {
      record['SoDienThoaiSales*'] = `0${record?.['SoDienThoaiSales*']}`;
    } else if (record?.['SoDienThoaiSales*']) {
      messageInvalid.push('Số điện thoại người bán');
    } else {
      messageEmpty.push('Số điện thoại người bán');
    }

    if (record.SoDienThoaiChuNha && record.SoDienThoaiChuNha.length === 9) {
      record.SoDienThoaiChuNha = `0${record.SoDienThoaiChuNha}`;
    } else if (record.SoDienThoaiChuNha) {
      messageInvalid.push('Số điện thoại chủ nhà');
    }

    //Validate Category
    if (record?.['DanhMuc*']) {
      const {realEstateCategoryList, count: countCategory} =
        realEstateCategoryResult;
      if (
        countCategory > 0 &&
        _.findIndex(realEstateCategoryList, {title: record?.['DanhMuc*']}) < 0
      ) {
        messageNotFound.push('Danh mục');
      }
    } else {
      messageEmpty.push('Danh mục');
    }

    //Validate Status
    if (record?.['TrangThai*']) {
      const {realEstateStatusList, count: countStatus} = realEstateStatusResult;

      const statusIndex = _.findIndex(realEstateStatusList, {
        title: record?.['TrangThai*'],
      });
      if (
        countStatus > 0 &&
        _.findIndex(realEstateStatusList, {title: record?.['TrangThai*']}) < 0
      ) {
        messageNotFound.push('Trạng thái');
      } else {
        realEstateStatusId = realEstateStatusList[statusIndex].id;
      }
    } else {
      messageEmpty.push('Trạng thái');
    }

    //Validate Province
    if (record?.['TinhThanhPho*']) {
      const provinceIndex = _.findIndex(provinceLists, {
        display_title: record?.['TinhThanhPho*'],
      });
      if (provinceIndex < 0) {
        const provinceResult = await httpGet(
          `${Constants.ADMINISTRATIVE_URL}/province/list`,
          {
            params: {
              search: _.trim(record?.['TinhThanhPho*']),
            },
          },
        );
        const {data: provinceData} = provinceResult.data;
        if (!_.isEmpty(provinceData)) {
          provinceLists.push(_.first(provinceData));
          provinceId = _.first(provinceData).id;
        } else {
          messageNotFound.push('Tỉnh thành phố');
        }
      } else {
        provinceId = provinceLists[provinceIndex].id;
      }
    } else {
      messageEmpty.push('Tỉnh thành phố');
    }

    //validate District
    if (record?.['QuanHuyen*']) {
      if (provinceId) {
        const districtIndex = _.findIndex(districtLists, {
          display_title: record?.['QuanHuyen*'],
        });
        if (districtIndex < 0) {
          const districtResult = await httpGet(
            `${Constants.ADMINISTRATIVE_URL}/district/list`,
            {
              params: {
                province_id: provinceId,
                search: _.trim(record?.['QuanHuyen*']),
              },
            },
          );
          const {data: districtData} = districtResult.data;
          if (!_.isEmpty(districtData)) {
            districtLists.push(_.first(districtData));
            districtId = _.first(districtData).id;
          } else {
            messageNotFound.push('Quận/Huyện');
          }
        } else {
          districtId = districtLists[districtIndex].id;
        }
      } else {
        messageNotFound.push('Tỉnh thành phố');
      }
    } else {
      messageEmpty.push('Quận/Huyện');
    }

    //Validate Ward
    if (record?.['PhuongXa*']) {
      if (districtId) {
        const wardIndex = _.findIndex(wardLists, {
          display_title: record?.['PhuongXa*'],
        });
        if (wardIndex < 0) {
          const wardResult = await httpGet(
            `${Constants.ADMINISTRATIVE_URL}/ward/list`,
            {
              params: {
                district_id: districtId,
                search: _.trim(record?.['PhuongXa*']),
              },
            },
          );
          const {data: wardData} = wardResult.data;
          if (!_.isEmpty(wardData)) {
            wardLists.push(_.first(wardData));
            wardId = _.first(wardData).id;
          } else {
            messageNotFound.push('Phường/xã');
          }
        } else {
          wardId = wardLists[wardIndex].id;
        }
      } else {
        messageNotFound.push('Quận/Huyện');
      }
    } else {
      messageEmpty.push('Phường/xã');
    }

    //Validate Street
    if (record?.['Duong*']) {
      if (districtId) {
        const streetIndex = _.findIndex(streetLists, {
          display_title: record?.['Duong*'],
        });
        if (streetIndex < 0) {
          const streetResult = await httpGet(
            `${Constants.ADMINISTRATIVE_URL}/street/list`,
            {
              params: {
                // ward_id: [wardId],
                district_id: [districtId],
                search: _.trim(record?.['Duong*']),
              },
            },
          );

          const {data: streetData} = streetResult.data;
          if (!_.isEmpty(streetData)) {
            streetLists.push(_.first(streetData));
            streetId = _.first(streetData).id;
          } else {
            messageNotFound.push('Đường');
          }
        } else {
          streetId = streetLists[streetIndex].id;
        }
      } else {
        messageNotFound.push('Quận/Huyện');
      }
    } else {
      messageEmpty.push('Đường');
    }
    // Validate Dia chi
    if (!record?.['DiaChi*']) {
      messageEmpty.push('Địa chỉ');
    }

    //Validate location
    const locationIndex = _.findKey(REAL_LOCATION_ENUM, (value) => {
      return value === record['ViTri*'];
    });
    if (!locationIndex) {
      messageNotFound.push('Vị trí');
    }
    //Validate Direction
    const directionIndex = _.findKey(DIRECTION_ENUM, (value) => {
      return value === record.Huong;
    });
    if (!directionIndex) {
      messageNotFound.push('Hướng');
    }

    // if (!_.isEmpty(record.NgayTao)) {
    //   if (!dayjs(record.NgayTao, DATE_FORMATS.DD_MM_YYYY).isValid()) {
    //     messageInvalid.push('Ngày tạo');
    //   }
    // }

    const newMessageEmpty = [...new Set(messageEmpty)];
    const newMessageNotfound = [...new Set(messageNotFound)];
    const newMessageInvalid = [...new Set(messageInvalid)];

    if (!_.isEmpty(newMessageEmpty)) {
      record.FieldBiTrong = newMessageEmpty.join(', ');
    }
    if (!_.isEmpty(newMessageNotfound)) {
      record.KhongDungDinhDang = newMessageNotfound.join(', ');
    }
    if (!_.isEmpty(newMessageInvalid)) {
      record.KhongCoTrongHeThong = newMessageInvalid.join(', ');
    }

    isOk =
      _.isEmpty(messageEmpty) &&
      _.isEmpty(messageNotFound) &&
      _.isEmpty(messageInvalid);
    stringifier.write(record);
  }

  return {
    isOk: isOk,
  };
};
const importData = async (
  importId,
  input_file_path,
  output_file_path,
  creator_id,
  type,
) => {
  let totalRow = 0;

  let successRow = 0;
  const parser = fs
    .createReadStream(input_file_path, {encoding: 'utf8'})
    .pipe(
      parse({
        delimiter: ',',
        columns: true,
        dom: true,
        relax_quotes: true,
        escape: '\\',
        ltrim: true,
        trim: true,
      })
        .on('error', function (err) {
          console.error(err.message);
        })
        .on('end', function () {
          console.log('end');
        }),
    )
    .on('data', () => {
      totalRow += 1;
    });

  for await (const record of parser) {
    let dataRealEstate = {};
    let dataRealEstateDetail = {};
    let is_show_internal = false;
    const creatorInfo = await userService.getPersonalInfoByUserId(creator_id);
    const directionIndex = _.findKey(DIRECTION_ENUM, (value) => {
      return value === record.Huong;
    });
    const locationIndex = _.findKey(REAL_LOCATION_ENUM, (value) => {
      return value === record['ViTri*'];
    });
    const {realEstateCategoryList, count: countCategory} =
      realEstateCategoryResult;
    const categoryIndex = _.findIndex(realEstateCategoryList, {
      title: record['DanhMuc*'],
    });
    if (countCategory > 0 && categoryIndex >= 0) {
      dataRealEstate.category_id = realEstateCategoryList[categoryIndex].id;
    }

    const {realEstateStatusList, count: countStatus} = realEstateStatusResult;
    const statusIndex = _.findIndex(realEstateStatusList, {
      title: record['TrangThai*'],
    });

    const provinceIndex = _.findIndex(provinceLists, {
      display_title: record['TinhThanhPho*'],
    });

    dataRealEstate.province_city_id = provinceLists[provinceIndex].id;

    const districtIndex = _.findIndex(districtLists, {
      display_title: record['QuanHuyen*'],
    });
    dataRealEstate.district_id = districtLists[districtIndex].id;

    const wardIndex = _.findIndex(wardLists, {
      display_title: record['PhuongXa*'],
    });
    dataRealEstate.ward_id = wardLists[wardIndex].id;

    const streetIndex = _.findIndex(streetLists, {
      display_title: record['Duong*'],
    });

    dataRealEstate.street_id = streetLists[streetIndex].id;
    dataRealEstate.creator_sale_id = creator_id;
    dataRealEstate.saler_full_name = record['TenSales*'];
    dataRealEstate.saler_phone_number = record['SoDienThoaiSales*'];
    dataRealEstate.type = type;
    dataRealEstate.address = record['DiaChi*'];
    dataRealEstate.price = record['Gia*'];
    dataRealEstate.goodwill = record.ThienChi === 'Yes';
    dataRealEstate.brokerage_fees = record['PhiMoiGioi*'];
    if (is_show_internal) {
      dataRealEstate.is_internal = record.NoiBoBan === 'Yes';
    }

    if (!_.isEmpty(record.NgayTao)) {
      dataRealEstate.created_at = dayjs(
        record.NgayTao,
        DATE_FORMATS.DD_MM_YYYY,
      ).format('YYYY-MM-DD');
    }

    if (
      countStatus > 0 &&
      statusIndex >= 0 &&
      dataRealEstate.province_city_id &&
      dataRealEstate.district_id &&
      dataRealEstate.street_id &&
      dataRealEstate.ward_id &&
      record['DiaChi*']
    ) {
      dataRealEstate.real_estate_status_id =
        realEstateStatusList[statusIndex].id;
      is_show_internal = realEstateStatusList[statusIndex].is_show_internal;
      const {is_duplicate} = await realEstateService.checkDuplicateRealEstate({
        province_city_id: dataRealEstate.province_city_id,
        district_id: dataRealEstate.district_id,
        street_id: dataRealEstate.street_id,
        ward_id: dataRealEstate.ward_id,
        type,
        address: record['DiaChi*'],
        real_estate_status_id: dataRealEstate.real_estate_status_id,
      });
      dataRealEstate.duplicate = is_duplicate;
      dataRealEstate.previous_real_estate_status =
        realEstateStatusList[statusIndex].title;
    } else {
      //  Export error
    }

    dataRealEstateDetail.horizontal = record['ChieuNgang*'];
    dataRealEstateDetail.long = record['ChieuDai*'];
    dataRealEstateDetail.area = record['DienTich(m2)'];
    dataRealEstateDetail.recognized_area = record['DienTichCongNhan(m2)*'];
    dataRealEstateDetail.bedroom = record.PhongTam;
    dataRealEstateDetail.wc = record.NhaVeSinh;
    dataRealEstateDetail.book_status = record.SoHong === 'Yes';
    dataRealEstateDetail.structure = record['KetCau*'];
    dataRealEstateDetail.note = record.GhiChu;
    dataRealEstateDetail.owner_name = record.TenChuNha;
    dataRealEstateDetail.owner_phone = record.SoDienThoaiChuNha;
    dataRealEstateDetail.direction = directionIndex;
    dataRealEstateDetail.location = locationIndex;
    const response = await realEstateService.insertRealEstate(
      {
        ...dataRealEstate,
        creator_sale_id: creator_id,
        full_name: creatorInfo.full_name,
      },
      {
        ...dataRealEstateDetail,
      },
    );

    if (response) {
      successRow += 1;
    }
  }
  return {
    totalRow,
    successRow,
  };
};

const executeImportQueue = async () => {
  const listImportQueue = await importService.getListWaitingImportQueue();

  if (!_.isEmpty(listImportQueue)) {
    const listId = _.values(
      _.mapValues(listImportQueue, (importData) => {
        return importData.id;
      }),
    );
    await importService.importUpdate(
      {listId},
      {
        status: IMPORT_STATUS_ENUM.EXECUTION,
        modification_date: dayjs().utc(),
      },
    );
    realEstateCategoryResult = await realEstateCategoryService.getList({
      limit: 500,
      offset: 0,
    });
    realEstateStatusResult = await realEstateStatusService.getList({
      limit: 500,
      offset: 0,
    });

    const dirImport = Constants.DIR_IMPORT + '/' + buildDirectoryByDate();
    const directory = 'public' + '/' + dirImport;
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, {recursive: true}, (err) => {
        if (err) {
          console.log(err);
        }
      });
    }

    _.each(listImportQueue, async (importQueueSingle) => {
      console.info(performance.now());
      const fileName = `IMPORT-BDS-${dayjs().format('MM-DD-YYYY_hh_mm_ss')}`;
      const outputFilePath = `${directory}/${fileName}.csv`;
      const outputFilePathNoPublic = `${dirImport}/${fileName}.csv`;
      try {
        const userPersonalInfo = await userService.getPersonalInfoByUserId(
          importQueueSingle.user_id,
        );
        //First Check File Format
        const errorText = await checkFileFormat(importQueueSingle.file_path);
        if (!_.isEmpty(errorText)) {
          await importService.importUpdate(
            {listId: [importQueueSingle.id]},
            {
              errors: errorText,
              status: IMPORT_STATUS_ENUM.FAIL,
              modification_date: dayjs().utc(),
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
          //If file format is OK, then second check data
          const {isOk} = await validateDataImport(
            importQueueSingle.id,
            importQueueSingle.file_path,
            outputFilePath,
            importQueueSingle.type,
          );
          if (!isOk) {
            await importService.importUpdate(
              {listId: [importQueueSingle.id]},
              {
                error_file_path: outputFilePathNoPublic,
                status: IMPORT_STATUS_ENUM.FAIL,
                modification_date: dayjs().utc(),
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
            fs.unlinkSync(outputFilePath);
            const {totalRow, successRow} = await importData(
              importQueueSingle.id,
              importQueueSingle.file_path,
              outputFilePath,
              importQueueSingle.user_id,
              importQueueSingle.type,
            );
            await importService.importUpdate(
              {listId: [importQueueSingle.id]},
              {
                error_file_path: outputFilePathNoPublic,
                info: `${successRow}/${totalRow}`,
                status: IMPORT_STATUS_ENUM.SUCCESS,
                modification_date: dayjs().utc(),
              },
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
        }
      } catch (e) {
        console.log(e);
      }
      console.info(performance.now());
    });
  }
};

module.exports = {executeImportQueue};
