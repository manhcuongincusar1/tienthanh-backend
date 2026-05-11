const RestAPI = require('../common/rest_api');
const knexPg = require('../db/connectKnex');
const Constants = require('../common/constants');
const _ = require('lodash');
const checkInvalidBranch = () => {
  return async (req, res, next) => {
    let branch_id;
    const {id: user_id, role} = req.auth;

    branch_id = req.query?.branch_id || req.body?.branch_id;

    if (role === 'super_admin') return next();
    if (branch_id && user_id) {
      const responseCheckIsAcitve = await knexPg('branches')
        .where((whereQuery) => {
          whereQuery
            .where('status', Constants.STATUS_ENUM.ACTIVE)
            .where('id', branch_id);
        })
        .select('id')
        .first();
      if (responseCheckIsAcitve?.id) {
        const responseForbidden = await knexPg('branches')
          .innerJoin('sale_branch', 'sale_branch.branch_id', 'branches.id')
          .innerJoin('sales', 'sales.id', 'sale_branch.sale_id')
          .where((whereQuery) => {
            whereQuery
              .where('branches.status', Constants.STATUS_ENUM.ACTIVE)
              .where('sales.user_id', user_id)
              .where('branches.id', branch_id);
          })
          .select('branches.id')
          .first();
        if (responseForbidden?.id) {
          return next();
        } else {
          return RestAPI.forbidden(res, 'forbidden');
        }
      } else {
        return RestAPI.forbidden(res, 'forbidden_branch');
      }
    } else {
      return RestAPI.notFound(res, 'forbidden_branch');
    }
  };
};

module.exports = checkInvalidBranch;
