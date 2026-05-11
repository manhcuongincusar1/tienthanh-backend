const multer = require('multer');
const fs = require('fs');
const Common = require('./common');
const Constants = require('./constants');
const multerS3 = require('multer-s3');
const AWS = require('aws-sdk');
const path = require('path');

const buildDirectoryByDate = () => {
  const date = new Date();
  var currDate = date.getDate();
  var currMonth = date.getMonth() + 1;
  var currYear = date.getFullYear();
  if (currMonth < 10) currMonth = '0' + currMonth;
  if (currDate < 10) currDate = '0' + currDate;

  return 'files/' + currYear + '/' + currMonth + '/' + currDate;
};

const fileFilter = (req, file, cb) => {
  if (
    Common.findStringInKeyDictionary(
      file.mimetype,
      Constants.MINETYPE_ALLOW_UPLOAD.FILES,
    )
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

class Upload {
  static uploadFile() {
    const middleware = uploadLocal.single('file');
    return middleware;
  }

  static uploadFileS3() {
    const middleware = uploadS3.single('file');
    return middleware;
  }
}

const s3 = new AWS.S3({
  accessKeyId: Constants.S3.S3_KEY,
  secretAccessKey: Constants.S3.S3_SECRET,
});

// S3 init log — KHÔNG print secret. Chỉ region + bucket cho debug.
console.log('S3 init', {
  region: Constants.S3.S3_REGION,
  bucket: Constants.S3.S3_BUCKET,
  hasKey: Boolean(Constants.S3.S3_KEY),
});

const uploadS3 = multer({
  storage: multerS3({
    s3: s3,
    bucket: Constants.S3.S3_BUCKET,
    acl: 'public-read',
    key: function (req, file, cb) {
      var filetypes = /jpeg|jpg|png|gif/;

      const fileNameUpload = path.basename(file.originalname);
      const ext = path.extname(file.originalname);
      const nameWithoutExt = path.basename(fileNameUpload, ext).toLowerCase();

      const extension = ext.replace('.', '');
      let filename =
        Date.now() +
        '_' +
        Common.skipVN(nameWithoutExt).replace(/[^a-zA-Z]/g, '_') +
        '.' +
        extension;

      const direction = buildDirectoryByDate();
      const filepath = direction + filename;

      cb(null, filepath);
      req.fileNameUpload = filename;
      req.filePath = filepath;
      req.extension = extension;
      req.nameWithoutExt = nameWithoutExt;
    },
  }),
  fileFilter: fileFilter,
  limits: {
    fileSize: Constants.LIMIT_DEFAULT,
  },
});
const uploadLocal = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const directory =
        'public' + '/' + Constants.DIR_UPLOAD + '/' + buildDirectoryByDate();
      fs.mkdir(directory, {recursive: true}, (err) => {
        if (err) {
          console.log(err);
        }
        cb(null, directory);
      });
    },
    filename: (req, file, cb) => {
      const fileNameUpload = path.basename(file.originalname);
      const ext = path.extname(file.originalname);
      const nameWithoutExt = path.basename(fileNameUpload, ext).toLowerCase();

      const extension = ext.replace('.', '').toLowerCase();
      const filename =
        Date.now() +
        '_' +
        Common.skipVN(nameWithoutExt).replace(/[^a-zA-Z]/g, '_') +
        '.' +
        extension;
      cb(null, filename);

      file.extension = extension;
      file.fileNameUpload = filename;
      file.nameWithoutExt = nameWithoutExt;
    },
  }),
  fileFilter: fileFilter,
});

module.exports = Upload;
