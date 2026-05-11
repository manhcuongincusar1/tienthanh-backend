var config = require('../config/setting')();
var Common = require('../common/common');
var Constants = require('../common/constants');

class RestAPI {
  static notFound(res, message) {
    res.status(404).json({status: 404, message: message});
  }

  static forbidden(res, message) {
    res.status(403).json({status: 403, message: message});
  }
  static partialContent(res, message) {
    res.status(206).json({status: 206, data: message});
  }

  static unauthorized(res, message) {
    res.status(401).json({status: 401, message: message});
  }

  static badRequest(res, status = 400, message, error = null, data = null) {
    if (isNaN(status) && status != 400) {
      message = status;
      status = 400;
    }
    var dataRes = {status: status, message: message};
    if (data != null) {
      dataRes['data'] = data;
    }
    if (error != null) {
      Common.dLog(error);
      dataRes['error'] = error;
    }
    res.status(status).json(dataRes);
  }

  static serverError(res, message, error = null) {
    if (error != null) {
      Common.dLog(error.message);
      res
        .status(500)
        .json({status: 500, message: message, error: error.message});
    } else {
      res.status(500).json({status: 500, message: message});
    }
  }

  static success(res, data, keyAdditional = null) {
    if (Common.isEmpty(data)) {
      res.status(200).json({status: 200, message: 'OK'});
    } else {
      // data = removeEmpty(data);
      var response = {status: 200, message: 'OK', data: data};
      if (keyAdditional != null) {
        response = Object.assign({}, response, keyAdditional);
      }
      res.status(200).json(response);
    }
  }

  static handleCatch(res, error) {
    var env = process.env.NODE_ENV;
    Common.dLog(error.message);
    if (env == 'production') {
      this.serverError(res, Constants.MSG.SERVER_ERR, error);
    } else {
      this.serverError(res, Constants.MSG.SERVER_ERR, error);
      throw error;
    }
  }

  static successListAdmin(res, data, error = null) {
    if (!Common.isEmpty(error)) {
      data['message'] = error.message;
    }
    if (Common.isEmpty(data.data)) {
      var dataReturn = Object.assign({}, {status: 200}, data);
      res.json(dataReturn);
    } else {
      data['data'] = removeEmpty(data.data);
      // merge two dictionaries
      var dataReturn = Object.assign({}, {status: 200}, data);
      res.json(dataReturn);
    }
  }
}

function removeEmpty(obj) {
  //dataValues
  obj = JSON.parse(JSON.stringify(obj));
  if (Common.isEmpty(obj)) {
    return null;
  } else if (Array.isArray(obj)) {
    const newArray = [];
    obj.forEach((item) => {
      newArray.push(removeEmpty(item));
    });
    return newArray;
  } else if (typeof obj === 'object') {
    const newObj = {};
    Object.keys(obj).forEach((key) => {
      if (obj[key] && Array.isArray(obj[key])) {
        const newArray = [];
        obj[key].forEach((item) => {
          newArray.push(removeEmpty(item));
        });
        newObj[key] = newArray;
      } else if (obj[key] && typeof obj[key] === 'object') {
        newObj[key] = removeEmpty(obj[key]); // recurse
      } else if (obj[key] != null) {
        newObj[key] = obj[key]; // copy value
      }
    });

    return newObj;
  } else {
    return obj;
  }
}

module.exports = RestAPI;
