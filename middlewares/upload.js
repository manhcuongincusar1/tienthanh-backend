const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Common = require('../common/common');
const Constants = require('../common/constants');

const buildDirectoryByDate = () => {
  const date = new Date();
  var currDate = date.getDate();
  var currMonth = date.getMonth() + 1;
  var currYear = date.getFullYear();
  if (currMonth < 10) currMonth = '0' + currMonth;
  if (currDate < 10) currDate = '0' + currDate;

  return 'files/' + currYear + '/' + currMonth + '/' + currDate;
};

const storageFile = multer.diskStorage({
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
  },
});
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
    const upload = multer({
      storage: storageFile,
      fileFilter: fileFilter,
      // DECISIONS D1: limit consistent với common/uploadMiddleware.
      limits: {
        fileSize: Constants.LIMIT_IMPORT,
        files: Constants.LIMIT_IMPORT_FILES,
        fields: 50,
        parts: 60,
      },
    });
    return upload;
  }
}

module.exports = Upload;
