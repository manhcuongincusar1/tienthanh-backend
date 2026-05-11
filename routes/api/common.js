var express = require('express');
var router = express.Router();
const RestAPI = require('../../common/rest_api');
const Constants = require('../../common/constants');
const Common = require('../../common/common');
const upload = require('../../common/uploadMiddleware');
const Auth = require('../../common/auth');
var p = require('path');
const multer = require('multer');
var fs = require('fs');
const path = require('path');
const multerS3 = require('multer-s3');
const AWS = require('aws-sdk');
const AuthMiddleware = require('../../middlewares/auth');
const mediaService = require('../../services/mediaService');
const auth = require('../../middlewares/auth');
const webPush = require('web-push');
webPush.setVapidDetails(
    `mailto:${Constants.SECRET_WEB_NOTIFICATION.MAIL_TO}`,
    Constants.SECRET_WEB_NOTIFICATION.PUBLIC_VAPID_KEY,
    Constants.SECRET_WEB_NOTIFICATION.PRIVATE_VAPID_KEY,
);
const subscriptionService = require('../../services/subscriptionService');
const {Worker} = require("worker_threads");
router.post(
    '/upload',
    [AuthMiddleware.authenticateToken, upload.uploadFileS3()],
    async function (req, res) {
        try {
            let {token} = req;
            if (Common.isEmpty(req.fileNameUpload)) {
                return RestAPI.badRequest(res, Constants.MSG.FILE_EMPTY_ERR);
            } else {
                const {file, fileNameUpload, filePath, extension, nameWithoutExt} = req;
                const response = await mediaService.insertMedia({
                    cdn_path: file.location,
                    extension: extension,
                    path: filePath,
                    title: nameWithoutExt,
                });
                if (!response) {
                    return RestAPI.notFound(res, 'Upload error ');
                }
                RestAPI.success(res, response);
            }
        } catch (error) {
            return RestAPI.serverError(res, Constants.MSG.SERVER_ERR, error);
        }
    },
);

router.post('/execute', Auth.checkTokenApi, async function (req, res) {
    try {
        var params = req.body;
        var results = await Hasura.execute(params);
        if (Common.isEmptyObject(results))
            return RestAPI.badRequest(res, Constants.MSG.MISMATCH_PARAMS_ERR);
        else {
            if (results.errors) return RestAPI.badRequest(res, results.errors);
            else RestAPI.success(res, results.data);
        }
    } catch (error) {
        return RestAPI.serverError(res, Constants.MSG.SERVER_ERR, error);
    }
});

router.post('/log', async function (req, res) {
    try {
        var params = req.body;
        var date = params.date;
        var logPath = Constants.DIR_UPLOAD + '/log/log_' + date + '.txt';
        try {
            var data = fs.readFileSync(logPath, 'utf8');
            RestAPI.success(res, data.toString());
        } catch (e) {
            return RestAPI.badRequest(res, e.stack);
        }
    } catch (error) {
        return RestAPI.serverError(res, Constants.MSG.SERVER_ERR, error);
    }
});
const s3 = new AWS.S3({
    accessKeyId: Constants.S3.S3_KEY,
    secretAccessKey: Constants.S3.S3_SECRET,
});
const uploadS3 = multer({
    storage: multerS3({
        s3: s3,
        bucket: Constants.S3.S3_BUCKET,
        acl: 'public-read',
        key: function (req, file, cb) {
            var date = new Date();
            var currDate = date.getDate();
            var currMonth = date.getMonth() + 1;
            var currYear = date.getFullYear();
            if (currMonth < 10) currMonth = '0' + currMonth;
            if (currDate < 10) currDate = '0' + currDate;
            var filetypes = /jpeg|jpg|png|gif/;
            var extname = filetypes.test(
                path.extname(file.originalname).toLowerCase(),
            );
            var fileNameSplit = file.originalname.split('.');
            var extension = fileNameSplit[1].toLowerCase();
            var name = fileNameSplit[0];
            var folders = ['xlsx', 'xls'].includes(extension)
                ? 'imported/' + currYear + '/' + currMonth + '/' + currDate + '/'
                : extname
                    ? 'images/'
                    : 'files/';
            var filename =
                folders +
                date.getTime() +
                '_' +
                Common.skipVN(name).replace(/[^a-zA-Z]/g, '_') +
                '.' +
                extension;
            cb(null, filename);
            req.fileNameUpload = filename;
        },
    }),
    fileFilter: function (req, file, cb) {
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
    },
    limits: {
        fileSize: Constants.LIMIT_DEFAULT,
    },
});

router.post(
    '/upload-s3',
    Auth.checkTokenApi,
    uploadS3.single('file'),
    async function (req, res) {
        try {
            if (Common.isEmpty(req.fileNameUpload)) {
                return RestAPI.badRequest(res, Constants.MSG.FILE_EMPTY_ERR);
            } else {
                var path = '/' + req.file.key;
                var url = req.file.location;
                var dataRes = {
                    url: url,
                    cdn: url.replace(path, ''),
                    path: path,
                    media_type: req.file.mimetype,
                    file_size: req.file.size,
                };
                RestAPI.success(res, dataRes);
            }
        } catch (error) {
            return RestAPI.serverError(res, Constants.MSG.SERVER_ERR, error);
        }
    },
);
const subscriptions = {};
const subscription = async (req, res, next) => {
    try {
        let {
            auth: {permissionInfo, id},
            body: subscriptionRequest,
        } = req;

        const subscriptionString = JSON.stringify(subscriptionRequest);
        const response = await subscriptionService.insertNewSubscription(
            id,
            subscriptionString,
            subscriptionRequest?.keys?.auth,
        );
        subscriptions['nhatnguyen'] = subscriptionRequest;
        if (!response) {
            return RestAPI.notFound(res, 'Insert subcription failed');
        }
        RestAPI.success(res, response);
    } catch (error) {
    }
};

const getNotification = async (req, res, next) => {
    let {
        auth: {id},
    } = req;
    const response = await subscriptionService.getSubscription(id);

    // const listResponse = await subscriptionService.getListSubscription();
    // listResponse.forEach((item)=>{
    //
    // })

    const pushSubscription = JSON.parse(response?.info);
    webPush
        .sendNotification(
            pushSubscription,
            JSON.stringify({
                title: 'New Product Available ',
                text: 'HEY! Take a look at this brand new t-shirt!',
                image: '/images/jason-leung-HM6TMmevbZQ-unsplash.jpg',
                tag: 'new-product',
                url: '/new-product-jason-leung-HM6TMmevbZQ-unsplash.html',
            }),
        )
        .catch((err) => {
            console.log(err);
        });
    RestAPI.success(res, 'OK');
};
const deleteSubscriptionByEnpoint = async (req, res, next) => {
    try {
        const {id} = req.params;

        const response = await subscriptionService.deleteSubscriptionByEnpoint(id);
        RestAPI.success(res, response);
    } catch (error) {
        return RestAPI.serverError(res, Constants.MSG.SERVER_ERR, error);
    }
};
const generateMasterData = async (req, res, next) => {
    const {params, body} = req;
    try {
        const {} = params;
        const worker = new Worker('./worker/masterData.js', {
            workerData: {
                numberRealEstate: 0,
            },
        });
        worker.on('message', (data) => {
            // return RestAPI.success(res, "ok");
            console.log(data);
        });
        worker.on('error', (msg) => {
            // res.status(404).send(`An error occurred: ${msg}`);
        });

        return RestAPI.success(res, 'response');
    } catch (error) {
        return RestAPI.serverError(res, 'Internal server error', error);
    }
}


router.delete('/subscription/:id', deleteSubscriptionByEnpoint);
router.post('/subscription', [auth.authenticateToken], subscription);
router.get('/subscription/:id', [auth.authenticateToken], getNotification);
router.post('/generate-master-data', [auth.authenticateToken], generateMasterData);

module.exports = router;
