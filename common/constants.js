const IS_DEV =
  (process.env.NODE_ENV != undefined ? process.env.NODE_ENV : 'development') ==
  'development';
const MAIL_CONSTANT = require('../common/constants/mail');
const ROLES_CONSTANT = require('../common/constants/roles');
const REAL_ESTATE_CONSTANT = require('../common/constants/real_estate');
const ADMINISTRATIVE_URL = process.env.ADMINISTRATIVE_URL
  ? process.env.ADMINISTRATIVE_URL
  : 'http://0.0.0.0:3011';
const DOMAIN_URL = process.env.DOMAIN_URL
  ? process.env.DOMAIN_URL
  : 'localhost:8000';

const Constants = {
  EXCUTING_CRON_UPDATE_TIME: 1,
  EXCUTING_CRON_KILL_TIME: 2,
  MAIL_CONSTANT,
  ROLES_CONSTANT,
  ROLES_TYPE_ENUM: {
    SUPER_ADMIN: 1,
    OTHER: 2,
  },
  REAL_ESTATE_CONSTANT,
  DEFAULT_PASSWORD:
    '9145df64c38e9fe27b19a8fc1ce1b2359768d46bfd347f56d14762bd8642797b', //Tienthanh123
  DEFAULT_PASSWORD_RAW: 'Tienthanh123',
  ADMINISTRATIVE_URL: `${ADMINISTRATIVE_URL}/_api`,
  FO_DOMAIN_URL: process.env.FO_DOMAIN_URL ?? 'http://localhost:8000/cms',
  DOMAIN_INFO: DOMAIN_URL,
  CRON: {
    SUSPEND_TIMEOUT: 10,
  },
  S3: {
    S3_KEY: process.env.S3_KEY,
    S3_SECRET: process.env.S3_SECRET,
    S3_REGION: process.env.S3_REGION || 'ap-southeast-1',
    S3_BUCKET: process.env.S3_BUCKET || 'tita-qat',
  },
  SECRET_WEB_NOTIFICATION: {
    PUBLIC_VAPID_KEY: IS_DEV
      ? 'BEEQu35i-gHV59m-9JfaLbtBDRQN1W3su3niYGII7o55iWIe50cLi60h0qkgY4OMY_bAg1Q2rk5VLmdATEdeTmc'
      : process.env.PUBLIC_VAPID_KEY,
    PRIVATE_VAPID_KEY: IS_DEV
      ? 'wW8dHWYJa8W0oKBftdlxkwIPDpQQXGkg0H6RdC68cvQ'
      : process.env.PRIVATE_VAPID_KEY,
    MAIL_TO: IS_DEV
        ? 'nhatnguyen@eos-solutions.tech'
        : process.env.MAIL_TO,
  },
  SECRET_JWT:
    IS_DEV || process.env.SECRET_JWT == undefined
      ? 'f90d6859-f5f6-401f-94ef-40d870f79c8d'
      : process.env.SECRET_JWT,
  LIMIT_DEFAULT: 100 * 1024 * 1024, //100MB (legacy — uploadFileS3 path, deprecated theo DECISIONS D1)
  LIMIT_IMPORT: 25 * 1024 * 1024, // 25MB cho /api/import (DECISIONS D1)
  LIMIT_IMPORT_FILES: 1, // chỉ 1 file/request — chống abuse
  IS_WRITE_LOG: true,
  DISPLAY_FORMAT_DATE: 'DD/MM/YYYY',
  DB_FORMAT_DATE: 'YYYY-MM-DD',
  DB_FORMAT_DATE_TIME: 'YYYY-MM-DD HH:mm:ss',
  DISPLAY_FORMAT_DATETIME_SS: 'DD/MM/YYYY HH:mm:ss',
  SERVER_FORMAT_DATETIME_SS: 'YYYY/MM/DD HH:mm:ss',
  FORMAT_IMPORT_SALE_TIME: 'DD/MM/YYYY HH:mm:ss',
  FORMAT_DATE_DISPLAY_CLIENT: 'HH:mm DD/MM/YYYY',
  FORMAT_DATE_PARTNER: 'YYYYMMDDHHmmss',
  VIEWS_DIR: process.cwd() + '/views',
  DEFAULT_TIMEZONE: 'Asia/Ho_Chi_Minh',
  DB_TIMEZONE: 'UTC',
  SECRET_KEY_DECRYPT: 'djfshfsdjfhdsfjdshfjsdfh',
  //thêm chuỗi #repl# cho thành string vì khi for nếu ko string thì sẽ bắt đầu từ 0=> chủ nhật
  // DECISIONS D1/D2 (Sprint 3 task 04):
  //  - Bỏ `image/svg+xml` (XSS qua <script> inline).
  //  - Bỏ `image/*` wildcard.
  //  - Bỏ `application/octet-stream` (bypass dễ).
  //  - Duplicate keys cũ (vd 'application/msword' map 'doc' + 'dot') đã merge — JS object key sau ghi đè key trước, giữ value cuối cùng để preserve behavior cũ.
  MINETYPE_ALLOW_UPLOAD: {
    FILES: {
      // Word
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        'docx',
      'application/vnd.ms-word.document.macroEnabled.12': 'docm',
      'application/vnd.ms-word.template.macroEnabled.12': 'dotm',
      // Excel
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        'xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.template':
        'xltx',
      'application/vnd.ms-excel.sheet.macroEnabled.12': 'xlsm',
      'application/vnd.ms-excel.template.macroEnabled.12': 'xltm',
      'application/vnd.ms-excel.addin.macroEnabled.12': 'xlam',
      'application/vnd.ms-excel.sheet.binary.macroEnabled.12': 'xlsb',
      // PowerPoint
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        'pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.template':
        'potx',
      'application/vnd.openxmlformats-officedocument.presentationml.slideshow':
        'ppsx',
      'application/vnd.ms-powerpoint.addin.macroEnabled.12': 'ppam',
      'application/vnd.ms-powerpoint.presentation.macroEnabled.12': 'pptm',
      'application/vnd.ms-powerpoint.template.macroEnabled.12': 'potm',
      'application/vnd.ms-powerpoint.slideshow.macroEnabled.12': 'ppsm',
      // PDF + CSV
      'text/csv': 'csv',
      'application/pdf': 'pdf',
      // Images — SVG removed (D2), image/* wildcard removed.
      'image/apng': 'apng',
      'image/bmp': 'bmp',
      'image/gif': 'gif',
      'image/x-icon': 'ico',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/tiff': 'tif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
    },
  }, //MIME cho phép upload trong server

  // Whitelist mới dạng array — dùng cho fileFilter logic mới (validation magic bytes ở task 09).
  // KHÔNG có SVG (D2). KHÔNG có octet-stream.
  MIMETYPE_IMAGE: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
  ],
  MIMETYPE_DOC: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ],

  DIR_DOWNLOAD: 'download',
  DIR_UPLOAD: 'upload',
  DIR_EXPORT: 'exports',
  DIR_IMPORT: 'imports',
  DIR_UPLOAD_LOG: 'log',
  MSG: {
    SERVER_ERR: 'SERVER_ERR',
    NOT_FOUND_ERR: 'NOT_FOUND_ERR',
    INVALID_TOKEN_ERR: 'INVALID_TOKEN_ERR',
    INVALID_USERNAME_OR_PASSWORD_ERR: 'INVALID_USERNAME_OR_PASSWORD_ERR',
    MISMATCH_PARAMS_ERR: 'MISMATCH_PARAMS_ERR',
    CARD_NOT_ALLOW_ERR: 'CARD_NOT_ALLOW_ERR',
    ERROR_MCRAD_ERR: 'ERROR_MCRAD_ERR',
    CARD_VALUE_INVALID_ERR: 'CARD_VALUE_INVALID_ERR',
    CATE_MCARD_NOT_EXIST: 'CATE_MCARD_NOT_EXIST',
    INVALID_NUMBER_CARD_ERR: 'INVALID_NUMBER_CARD_ERR',
    ACCOUNT_IS_EXISTED_ERR: 'ACCOUNT_IS_EXISTED_ERR',
    EMAIL_IS_EXISTED_ERR: 'EMAIL_IS_EXISTED_ERR',
    RESTAURANT_NOT_FOUND_ERR: 'RESTAURANT_NOT_FOUND_ERR',
    WRONG_CAPTCHA: 'WRONG_CAPTCHA_ERR',
    CAPTCHA_IS_EXPIRED: 'CAPTCHA_IS_EXPIRED_ERR',
    ACCOUNT_IS_NOT_EXISTED_ERR: 'ACCOUNT_IS_NOT_EXISTED_ERR',
    ACCOUNT_IS_DEACTIVE_ERR: 'ACCOUNT_IS_DEACTIVE_ERR',
    ACCOUNT_IS_BANNED_ERR: 'ACCOUNT_IS_BANNED_ERR',
    FORBIDDEN_ERR: 'FORBIDDEN_ERR',
    INVALID_PASSWORD_ERR: 'INVALID_PASSWORD_ERR',
    INVALID_CURRENT_PASSWORD_ERR: 'INVALID_CURRENT_PASSWORD_ERR',
    CODE_USED_ERR: 'CODE_USED_ERR',
    CODE_NOT_EXIST_ERR: 'CODE_NOT_EXIST_ERR',
    SECURE_HASH_INVALID_ERR: 'SECURE_HASH_INVALID_ERR',
    SECURE_HASH_TIME_OUT_MSG: 'SECURE_HASH_TIME_OUT_MSG',
    TYPE_INVALID_ERR: 'TYPE_INVALID_ERR',
    EXPIRED_TIME_ERR: 'EXPIRED_TIME_ERR',
    FILE_EMPTY_ERR: 'FILE_EMPTY_ERR',
    REQUEST_CANCEL_ERR: 'REQUEST_CANCEL_ERR',
    INVALID_CODE_ERR: 'INVALID_CODE_ERR',
    INVALID_EMAIL_ERR: 'INVALID_EMAIL_ERR',
    VERIFY_PHONE_ERR: 'VERIFY_PHONE_ERR',
    ACCOUNT_BLOCKED_ERR: 'ACCOUNT_BLOCKED_ERR',
    HASURA_RESPONSE_ERR: 'HASURA_RESPONSE_ERR',
    FIREBASE_RESPONSE_ERR: 'FIREBASE_RESPONSE_ERR',
  },
  STATUS_RES: {
    NOTFOUND: 404,
    FORBIDDEN: 403,
    UNAUTHORIZED: 401,
    BADREQUEST: 400,
    SERVER_ERROR: 500,
    SUCCESS: 200,
  },
  SESSION: {
    //keys in session
    KEY_ADMIN_USER: 'sess_admin_user',
    SET_TIME_START_CAPTCHA: 'set_time_start_captcha',
    KEY_USER_ID: 'sess_user_id',
    KEY_USER_TYPE: 'sess_user_type',
    KEY_USER_NAME: 'sess_user_name',

    KEY_ADMIN_ID: 'sess_admin_id',
    KEY_ADMIN_TYPE: 'sess_admin_type',
    KEY_ADMIN_NAME: 'sess_admin_name',

    KEY_CAPTCHA: 'sess_captcha', //save CAPTCHA number
    KEY_CAPTCHA_HOME: 'sess_captcha_home',
  },
  STATUS_ENUM: {
    DELETED: -1,
    ACTIVE: 1,
    PENDING: 2,
  },
  REAL_ESTATE_TYPE_ENUM: {
    SELL: 1,
    RENT: 2,
  },
  AUTH_PROVIDERS: {
    EMAIL: 1,
    PHONE: 2,
    FACEBOOK: 3,
    GOOGLE: 4,
    APPLE: 5,
  },
  AUTH_PROVIDERS_OPTIONS: [
    {
      label: 'email',
      value: 1,
    },
    {
      label: 'phone',
      value: 2,
    },
    {
      label: 'facebook',
      value: 3,
    },
    {
      label: 'google',
      value: 4,
    },
    {
      label: 'apple',
      value: 5,
    },
  ],
  SORTER_VALUE_ENUM: {
    descend: 'desc',
    ascend: 'asc',
  },
  STATUS_TOGGLE_IMPORT: {
    NO: 'No',
    YES: 'Yes',
  },
  GENDER_MAPPING: {
    1: 'Nữ',
    2: 'Nam',
    3: 'Không khai báo',
  },
  NOTIFICATION: {
    MAX_PER_TIME: 100,
  },
  MASTER_COLUMN_IMPORT: [
    'NgayTao*',
    'DiaChi*',
    'Duong*',
    'PhuongXa*',
    'QuanHuyen*',
    'TinhThanhPho*',
    'ViTri*',
    'Huong',
    'ChieuNgang*',
    'ChieuDai*',
    'KetCau*',
    'Gia*',
    'HopTac',
    'TenMoiGioi*',
    'SoDienThoaiMoiGioi*',
    'DanhMuc*',
    'TrangThai*',
    'SoHong',
    'GhiChu',
    'EmailNguoiXuLy*',
    'ThienChi',
    'PhongNgu',
    'NhaVeSinh',
  ],
  MASTER_COLUMN_IMPORT_SELL: [
    'TenNguoiBan/ChuNha*',
    'SoDienThoaiNguoiBan/ChuNha*',
    'PhiMoiGioi*',
    'DienTichCongNhan(m2)*',
    'NoiBoBan',
  ],
  MASTER_COLUMN_IMPORT_RENT: [
    'TenNguoiChoThue/ChuNha*',
    'SoDienThoaiNguoiChoThue/ChuNha*',
    'PhiMoiGioi',
    'DienTichCongNhan(m2)',
    'NoiBoChoThue',
  ],
  LABEL_NOTE_REAL_ESTATE_DUPLICATE: 'BĐS Trùng',
  GROUP_PRICE: {
    p1_10: {
      label: 'p1_10',
      price_from: 1,
      price_to: 10,
    },
    p10_15: {
      label: 'p10_15',
      price_from: 10,
      price_to: 15,
    },
    p15_20: {
      label: 'p15_20',
      price_from: 15,
      price_to: 20,
    },
    p20_50: {
      label: 'p20_50',
      price_from: 20,
      price_to: 50,
    },
    p50: {
      label: 'p50',
      price_from: 50,
    },
  },
};

module.exports = Constants;
