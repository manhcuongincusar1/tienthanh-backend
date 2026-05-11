const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth');
const upload = require('../../common/uploadMiddleware');
const permission = require('../../middlewares/permission');
const checkInvalidBranch = require('../../middlewares/checkInvalidBranch');
const realEstateController = require('./real_estate');

router.post(
  '/insert',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateRentCreate'),
  realEstateController.insertRealEstate,
);
router.get(
  '/item/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateRentEdit'),
  realEstateController.getRealEstateById,
);
router.put(
  '/update/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateRentEdit'),
  realEstateController.updateRealEstate,
);
router.get(
  '/list',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateRentList'),
  realEstateController.getListRealEstate,
);

router.post(
  '/import/request',
  [auth.authenticateToken, upload.uploadFile()],
  checkInvalidBranch(),
  realEstateController.insertImportQueue,
);

router.post(
  '/export/request',
  auth.authenticateToken,
  checkInvalidBranch(),
  realEstateController.insertExportQueue,
);
router.post(
  '/assign-single-to-user',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateRentAssign'),
  realEstateController.assignSingleRealEstateToUser,
);

router.post(
  '/assign-multiple-to-user',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateRentAssign'),
  realEstateController.assignMultipleRealEstateToUser,
);

router.post(
  '/delete-multiple',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateRentDelete'),
  realEstateController.deleteRealEstateList,
);
router.post(
  '/delete-single',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateRentDelete'),
  realEstateController.deleteSingleRealEstate,
);

router.post(
  '/convert-single-duplicate',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateRentDuplicate'),
  realEstateController.convertSingleRealEstateToDuplicate,
);

router.post(
  '/convert-multiple-duplicate',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateRentDuplicate'),
  realEstateController.convertRealEstateListToDuplicate,
);

router.post(
  '/subscribe/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('realEstateRentEdit'),
  realEstateController.subscribeRealEstate,
);

module.exports = router;
