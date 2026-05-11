var createError = require('http-errors');
var express = require('express');
var path = require('path');
var logger = require('morgan');
var session = require('express-session');
var bodyParser = require('body-parser');
const config = require('./config/setting')();
const cors = require('cors');
const dayjs = require('dayjs');
var authRouter = require('./routes/api/auth');
var commonRouter = require('./routes/api/common');

const routerList = require('./routes/api/index');
const utc = require('dayjs/plugin/utc');
const localeData = require('dayjs/plugin/localeData');
const weekday = require('dayjs/plugin/weekday');
const weekYear = require('dayjs/plugin/weekYear');
const weekOfYear = require('dayjs/plugin/weekOfYear');
const localizedFormat = require('dayjs/plugin/localizedFormat');
const isMoment = require('dayjs/plugin/isMoment');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const advancedFormat = require('dayjs/plugin/advancedFormat');
const objectSupport = require('dayjs/plugin/objectSupport');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const isBetween = require('dayjs/plugin/isBetween');
const durationDayjs = require('dayjs/plugin/duration');
const relativeTime = require('dayjs/plugin/relativeTime');
const {Worker} = require('worker_threads');
const Constants = require('./common/constants');

dayjs.extend(utc);
dayjs.extend(localeData);
dayjs.extend(weekday);
dayjs.extend(weekYear);
dayjs.extend(weekOfYear);
dayjs.extend(localizedFormat);
dayjs.extend(isMoment);
dayjs.extend(isSameOrBefore);
dayjs.extend(advancedFormat);
dayjs.extend(customParseFormat);
dayjs.extend(isBetween);
dayjs.extend(relativeTime);
dayjs.extend(objectSupport);
dayjs.extend(durationDayjs);
dayjs.tz.setDefault(Constants.DEFAULT_TIMEZONE);
var app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static(__dirname + '/upload'));

var corsOptions = {
  origin: true,
};

app.use(cors(corsOptions));

// parse application/json
app.use(bodyParser.json());

app.use(
  session({
    secret: config.secret,
    cookie: {
      maxAge: 30 * 24 * 3600 * 1000,
      expires: new Date(Date.now() + 30 * 86400 * 1000),
    }, // life time: 30 day
    resave: false,
    saveUninitialized: false,
  }),
);
//API
// const worker = new Worker('./worker/updateImportQueue.js', {
//   workerData: {},
// });
app.use('/_api/auth', authRouter);

app.use('/_api/common', commonRouter);

routerList.forEach((router) => {
  app.use(router.path, router.api);
});

app.use(express.static('public'));

app.use(function (req, res, next) {
  res.send('Wellcome');
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

app.use(function (req, res, next) {
  req.getUrl = function () {
    return req.protocol + '://' + req.get('host') + req.originalUrl;
  };
  return next();
});

module.exports = app;
