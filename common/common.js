const Constants = require('./constants');
const fs = require('fs');
const moment = require('moment');
const Security = require('./security');
const AWS = require('aws-sdk');
const path = require('path');
const _ = require('lodash');
const CryptoJS = require('crypto-js');
const dayjs = require('dayjs');

var logPath =
  Constants.DIR_UPLOAD + '/log/log_' + moment().format('YYMMDD') + '.txt';

const s3 = new AWS.S3({
  accessKeyId: Constants.S3.S3_KEY,
  secretAccessKey: Constants.S3.S3_SECRET,
});

const buildDirectoryByDate = () => {
  const date = new Date();
  var currDate = date.getDate();
  var currMonth = date.getMonth() + 1;
  var currYear = date.getFullYear();
  if (currMonth < 10) currMonth = '0' + currMonth;
  if (currDate < 10) currDate = '0' + currDate;

  return 'files/' + currYear + '/' + currMonth + '/' + currDate + '/';
};

class Common {
  static dLog(message) {
    if (Constants.IS_WRITE_LOG) {
      message =
        moment().format('YYYY-MM-DD HH:mm:ss.SSS') +
        ' ' +
        JSON.stringify(message);
      // console.log(message);
      fs.appendFile(logPath, message + '\n', function (err) {});
    }
  }
  static isEmpty(a_var) {
    if (a_var === undefined || a_var === null || a_var === '') return true;
    return false;
  }
  static countDecimals(number) {
    const stringNumber = number?.toString();
    if (Math.floor(stringNumber?.valueOf()) === stringNumber?.valueOf())
      return 0;
    return stringNumber?.toString()?.split('.')[1]?.length || 0;
  }

  static convertDateToLocalTimeIOSString(start_day, end_day) {
    let newStartDay, newEndDay;
    if (start_day) {
      newStartDay = dayjs
        .utc(start_day, 'YYYY/MM/DD')
        ?.subtract(7, 'hour')
        ?.$d.toISOString();
    }
    if (end_day) {
      newEndDay = dayjs
        .utc(end_day, 'YYYY/MM/DD')
        ?.endOf('day')
        ?.subtract(7, 'hour')
        ?.$d?.toISOString();
    }

    return {f_start_day: newStartDay, f_end_day: newEndDay};
  }

  static convertDateToLocalTime(start_day, end_day) {
    let newStartDay, newEndDay;
    if (start_day) {
      newStartDay = dayjs.utc(start_day, 'YYYY/MM/DD')?.subtract(7, 'hour')?.$d;
    }
    if (end_day) {
      newEndDay = dayjs
        .utc(end_day, 'YYYY/MM/DD')
        ?.endOf('day')
        ?.subtract(7, 'hour')?.$d;
    }

    return {f_start_day: newStartDay, f_end_day: newEndDay};
  }

  static isNull(a_var) {
    return a_var === undefined || a_var === null;
  }

  static checkVerifyParams(params) {
    if (Common.isArray(params)) {
      for (var i = 0; i < params.length; i++) {
        if (Common.isEmpty(params[i])) {
          return false;
        } else {
        }
      }
    } else {
      return !Common.isEmpty(params);
    }

    return true;
  }

  static isArray(something) {
    return Object.prototype.toString.call(something) === '[object Array]';
  }

  static baseUrl(req) {
    return req.protocol + '://' + req.headers.host;
  }
  static makeResourceURL(req, path) {
    if (path.startsWith('/')) {
      return Common.baseUrl(req) + path;
    } else {
      return Common.baseUrl(req) + '/' + path;
    }
  }

  static convertJsonObject(obj) {
    if (Common.isEmpty(obj)) {
      return null;
    }
    return JSON.parse(JSON.stringify(obj));
  }

  static compareURLAndControler(req, controller) {
    var baseUrlSegment = req.baseUrl.split('/');
    var controllerUrlSegment = controller.url.split('/');
    if (baseUrlSegment.length < controllerUrlSegment.length) {
      return false;
    }

    for (var i = 0; i < controllerUrlSegment.length; i++) {
      if (controllerUrlSegment[i] !== baseUrlSegment[i]) {
        return false;
      }
    }

    return true;
  }

  static weekdayTitle(number, lang = 'vi') {
    number = parseInt(number, 0);
    var weekday = new Array(7);
    if (lang === 'vi') {
      weekday[0] = 'Chủ nhật';
      weekday[1] = 'Thứ 2';
      weekday[2] = 'Thứ 3';
      weekday[3] = 'Thứ 4';
      weekday[4] = 'Thứ 5';
      weekday[5] = 'Thứ 6';
      weekday[6] = 'Thứ 7';
    } else {
      weekday[0] = 'Sunday';
      weekday[1] = 'Monday';
      weekday[2] = 'Tuesday';
      weekday[3] = 'Wednesday';
      weekday[4] = 'Thursday';
      weekday[5] = 'Friday';
      weekday[6] = 'Saturday';
    }

    return number >= 7 ? weekday[6] : weekday[number];
  }
  static skipVN(str) {
    var plainString = str.toLowerCase();
    plainString = plainString.replace(
      /à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g,
      'a',
    );
    plainString = plainString.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
    plainString = plainString.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
    plainString = plainString.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
    plainString = plainString.replace(
      /ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g,
      'o',
    );
    plainString = plainString.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
    plainString = plainString.replace(/đ/g, 'd');
    plainString = plainString.replace(/[^A-Za-z0-9_\s\-]/g, '');
    return plainString;
  }
  static makeId(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  static findStringInKeyDictionary(str, dictionnary) {
    if (dictionnary) {
      for (const [key, value] of Object.entries(dictionnary)) {
        if (key == str) {
          return true;
        }
      }
    }
    return false;
  }

  //A-Z number start=0=> A
  /*static getCharacter(number){
        return String.fromCharCode(97 + number).toUpperCase();
    }*/
  //A-Z number start=0=> A
  static getCharacter(n) {
    var ordA = 'a'.charCodeAt(0);
    var ordZ = 'z'.charCodeAt(0);
    var len = ordZ - ordA + 1;
    var s = '';
    while (n >= 0) {
      s = String.fromCharCode((n % len) + ordA) + s;
      n = Math.floor(n / len) - 1;
    }
    return s.toUpperCase();
  }

  static getRandomCode(length) {
    var randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var result = '';
    for (var i = 0; i < length; i++) {
      result += randomChars.charAt(
        Math.floor(Math.random() * randomChars.length),
      );
    }
    return result;
  }
  //identification code
  /**
   *
   * @param codePartnert
   * @param centerCode random
   * @param stt
   * @returns {string}
   */
  static indentificationCode(codePartnert, centerCode, stt) {
    return (
      codePartnert + '-' + centerCode + '-' + stt.toString().padStart(9, '0')
    );
  }

  static findStringInKeyDictionary(str, dictionnary) {
    if (dictionnary) {
      for (const [key, value] of Object.entries(dictionnary)) {
        if (key == str) {
          return true;
        }
      }
    }
    return false;
  }

  static numberFormat(number, decimals, dec_point, thousands_sep) {
    // http://kevin.vanzonneveld.net
    // + original by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
    // + improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // + bugfix by: Michael White (http://crestidg.com)
    // + bugfix by: Benjamin Lupton
    // + bugfix by: Allan Jensen (http://www.winternet.no)
    // + revised by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
    // * example 1: number_format(1234.5678, 2, '.', '');
    // * returns 1: 1234.57

    var n = number,
      c = isNaN((decimals = Math.abs(decimals))) ? 2 : decimals;
    var d = dec_point == undefined ? ',' : dec_point;
    var t = thousands_sep == undefined ? '.' : thousands_sep,
      s = n < 0 ? '-' : '';
    var i = parseInt((n = Math.abs(+n || 0).toFixed(c))) + '',
      j = (j = i.length) > 3 ? j % 3 : 0;

    return (
      s +
      (j ? i.substr(0, j) + t : '') +
      i.substr(j).replace(/(\d{3})(?=\d)/g, '$1' + t) +
      (c
        ? d +
          Math.abs(n - i)
            .toFixed(c)
            .slice(2)
        : '')
    );
  }
  static sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static hashParam(data, apiKey) {
    var hashData = '';
    var loop = 0;
    Object.keys(data)
      .sort()
      .forEach(function (key) {
        if (loop == 1) {
          hashData += ':' + data[key];
        } else {
          hashData += data[key];
          loop = 1;
        }
      });
    Common.logToFile('BODY-hashData', hashData, 'common');
    //console.log(data);
    //console.log(hashData);
    var secureHash = Security.hashSHA256(apiKey + hashData);
    return secureHash;
  }

  static logToFile(title, text, file) {
    // Define file name.
    const filename =
      file !== undefined
        ? moment().format('YYYYMMDD') + '_' + file + '.log'
        : moment().format('YYMMDD') + '_default.log';
    // Define log text.
    var logText = '\r\n';
    logText +=
      '=================================================================================' +
      '\r\n';
    logText +=
      'DATETIME:' +
      ' -> ' +
      moment().format(Constants.DISPLAY_FORMAT_DATETIME_SS) +
      '\r\n';
    logText += 'TITLE:' + ' -> ' + title + '\r\n';
    logText += 'CONTENT:' + ' -> ' + JSON.stringify(text) + '\r\n';
    // Save log to file.
    const directory = Constants.DIR_UPLOAD + '/' + Constants.DIR_UPLOAD_LOG;
    fs.mkdir(directory, {recursive: true}, async (err) => {
      if (err) {
        console.log('ERR CREATE DIRECTORY.');
      }
      //Thành công thì tạo file log
      // fs.appendFile(directory+'/'+filename, logText, 'utf8', function (error) {
      //     if (error) {
      //         // If error - show in console.
      //         console.log('getDateAsText()' + ' -> ' + error);
      //     }
      // });
    });
    fs.appendFile(
      directory + '/' + filename,
      logText,
      'utf8',
      function (error) {},
    );
  }

  static milisecond() {
    return Math.ceil(moment().tz(Constants.DEFAULT_TIMEZONE).unix() * 1000);
  }

  static isEmptyObject(value) {
    if (value === undefined || value === null || value === '') {
      return true;
    } else {
      return Object.keys(value).length === 0 && value.constructor === Object;
    }
  }

  static isNumeric(value) {
    return /^-?\d$/.test(value);
  }

  static replaceAllSpaces(value, character = '') {
    return value.replace(/ /g, character);
  }

  static isEmail(value) {
    var tester =
      /^[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;
    if (!email) return false;

    var emailParts = email.split('@');

    if (emailParts.length !== 2) return false;

    var account = emailParts[0];
    var address = emailParts[1];

    if (account.length > 64) return false;
    else if (address.length > 255) return false;

    var domainParts = address.split('.');
    if (
      domainParts.some(function (part) {
        return part.length > 63;
      })
    )
      return false;
    if (!tester.test(email)) return false;
    return true;
  }
  static getRandomCodeNumber(length = 6) {
    return Math.random().toString().substr(2, length);
  }
  static async getSettings(variables) {
    var params = {
      query:
        'query MyQuery($where_key: core_settings_bool_exp, $orderBy: [core_settings_order_by!]) { core_settings(where: $where_key, order_by: $orderBy) { key value } }',
      variables: JSON.stringify(variables),
    };
    var results = await Hasura.execute(params);
    if (Common.isEmptyObject(results)) {
      return null;
    } else {
      if (results.errors) {
        return null;
      } else {
        var objData = results.data;
        if (objData != null && Object.keys(objData).length > 0) {
          objData = objData[Object.keys(objData)];
          return objData;
        }
      }
    }
  }

  static decryptPassword(password) {
    const bytes = CryptoJS.AES.decrypt(password, Constants.SECRET_KEY_DECRYPT);
    const passwordRaw = bytes.toString(CryptoJS.enc.Utf8);
    return passwordRaw;
  }

  static buildWhereQuery = (baseQuery, table, {...rest}) => {
    const whereQuery = Object.entries(rest).reduce((total, value) => {
      if (!_.isUndefined(value[1])) {
        if (typeof value[1] === 'object') {
          if (value?.[1]?.length > 0) {
            return total.whereIn(`${table}.${value[0]}`, value[1]);
          } else {
            return total;
          }
        }
        return total.where(`${table}.${value[0]}`, value[1]);
      }
      return total;
    }, baseQuery);
    return whereQuery;
  };

  static parseRecordRowImportRealEstate = (record, keyColumn, type) => {
    let recordResultFlowType = {};
    if (type === Constants.REAL_ESTATE_TYPE_ENUM.SELL) {
      recordResultFlowType = {
        saler_full_name: record[keyColumn['TenNguoiBan/ChuNha*']]
          ?.toString()
          ?.trim(),
        saler_phone_number: record[keyColumn['SoDienThoaiNguoiBan/ChuNha*']]
          ?.toString()
          ?.replace("'", '')
          ?.trim(),
        brokerage_fees: record[keyColumn['PhiMoiGioi*']]?.toString()?.trim(),
        recognized_area: record[keyColumn['DienTichCongNhan(m2)*']],
        internal_sell: record[keyColumn['NoiBoBan']]?.toString()?.trim(),
      };
    } else if (type === Constants.REAL_ESTATE_TYPE_ENUM.RENT) {
      recordResultFlowType = {
        saler_full_name: record[keyColumn['TenNguoiChoThue/ChuNha*']]
          ?.toString()
          ?.trim(),
        saler_phone_number: record[keyColumn['SoDienThoaiNguoiChoThue/ChuNha*']]
          ?.toString()
          ?.replace("'", '')
          ?.trim(),
        internal_sell: record[keyColumn['NoiBoChoThue']]?.toString()?.trim(),
        brokerage_fees: record[keyColumn['PhiMoiGioi']]?.toString()?.trim(),
        recognized_area: record[keyColumn['DienTichCongNhan(m2)']],
      };
    }

    return {
      ...recordResultFlowType,
      created_at: record[keyColumn['NgayTao*']],
      status_title: record[keyColumn['TrangThai*']]?.toString()?.trim(),
      category_title: record[keyColumn['DanhMuc*']]?.toString()?.trim(),
      address: record[keyColumn['DiaChi*']]?.toString()?.trim(),
      street_title: record[keyColumn['Duong*']]?.toString()?.trim(),
      ward_title: record[keyColumn['PhuongXa*']]?.toString()?.trim(),
      district_title: record[keyColumn['QuanHuyen*']]?.toString()?.trim(),
      province_city_title: record[keyColumn['TinhThanhPho*']]
        ?.toString()
        ?.trim(),
      broker_full_name: record[keyColumn['TenMoiGioi*']]?.toString()?.trim(),
      broker_phone_number: record[keyColumn['SoDienThoaiMoiGioi*']]
        ?.toString()
        ?.replace("'", '')
        ?.trim(),
      goodwill: record[keyColumn['ThienChi']]?.toString()?.trim(),
      price: record[keyColumn['Gia*']]?.toString()?.trim(),
      agency: record[keyColumn['HopTac']]?.toString()?.trim(),
      direction: record[keyColumn['Huong']]?.toString()?.trim(),
      location: record[keyColumn['ViTri*']]?.toString()?.trim(),
      width: record[keyColumn['ChieuNgang*']]?.toString()?.trim(),
      length: record[keyColumn['ChieuDai*']]?.toString()?.trim(),
      bedroom: record[keyColumn['PhongNgu']]?.toString()?.trim(),
      wc: record[keyColumn['NhaVeSinh']]?.toString()?.trim(),
      book_status: record[keyColumn['SoHong']]?.toString()?.trim(),
      structure: record[keyColumn['KetCau*']]?.toString()?.trim(),
      note: record[keyColumn['GhiChu']]?.toString()?.trim(),
      creator_email: record[keyColumn['EmailNguoiXuLy*']],
    };
  };
  static buildError = (resultValid) => {
    return resultValid?.errors?.map((value) => ({
      [value.path[0]]: value.message,
    }));
  };
  static uploadS3 = (fileName, fileContent) => {
    const fileNameUpload = path.basename(fileName);
    const ext = path.extname(fileName);
    const nameWithoutExt = path.basename(fileNameUpload, ext);

    const extension = ext.replace('.', '');
    let filename = nameWithoutExt + '_' + Date.now() + '.' + extension;

    const direction = buildDirectoryByDate();
    const filepath = direction + filename;

    // Setting up S3 upload parameters
    const params = {
      Bucket: Constants.S3.S3_BUCKET,
      Key: filepath, // File name you want to save as in S3
      Body: fileContent,
    };

    // Uploading files to the bucket
    return s3
      .upload(params, function (err, data) {
        if (err) {
          throw err;
        }
        return data;
      })
      .promise();
  };
}

module.exports = Common;
