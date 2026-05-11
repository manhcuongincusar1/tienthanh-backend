const RestAPI = require('./rest_api');

generateResponseApi = ({res, response = 'error'}) => {
  const responseAPI = {
    forbidden: () => {
      return RestAPI.forbidden(res, 'forbidden');
    },
    success: () => {
      return RestAPI.success(res, response);
    },
    duplicate: () => {
      return RestAPI.badRequest(res, undefined, 'duplicate');
    },
    delete: () => {
      return RestAPI.badRequest(res, undefined, 'delete');
    },
    notfound: () => {
      return RestAPI.notFound(res, 'notfound');
    },
    failed: () => {
      return RestAPI.notFound(res, 'failed');
    },
    error: () => RestAPI.notFound(res, 'failed'),
  };

  return responseAPI[response] ? responseAPI[response]() : responseAPI.error();
};

module.exports = generateResponseApi;
