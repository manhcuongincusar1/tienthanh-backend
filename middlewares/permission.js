const RestAPI = require('../common/rest_api');
const knexPg = require('../db/connectKnex');
const Constants = require('../common/constants');
const ROLE_ENUM = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  SALE: 2,
};
const _ = require('lodash');

const permission = (key) => {
  return async (req, res, next) => {
    const {role_id} = req.auth;
    const responseRole = await knexPg('roles')
      .where('status', Constants.STATUS_ENUM.ACTIVE)
      .where('id', role_id)
      .select('type')
      .first();

    if (responseRole && responseRole.type === ROLE_ENUM.SUPER_ADMIN) {
      return next();
    }

    if (responseRole && responseRole.type !== ROLE_ENUM.SUPER_ADMIN) {
      // Hot path: 1 query/request. DECISIONS: cache Redis sẽ đến ở Sprint 2.
      const responsePermission = await knexPg('role_permissions')
        .where('role_id', role_id)
        .first();
      const permission_data = responsePermission?.permission_data;

      if (permission_data && !_.isEmpty(permission_data)) {
        const newAccessList = Object.entries(permission_data).reduce(
          (acc, item) => {
            const newItem =
              item[1] &&
              _.isArray(item[1]) &&
              item[1].reduce((acc2, children) => {
                return {
                  ...acc2,
                  [`${item[0]}${children
                    .charAt(0)
                    .toUpperCase()}${children.slice(1)}`]: true,
                };
              }, {});
            return {...acc, ...newItem};
          },
          {},
        );

        if (key && newAccessList && newAccessList[key] === true) {
          return next();
        }
        return RestAPI.forbidden(res, 'forbidden');
      }
      return RestAPI.forbidden(res, 'forbidden');
    }
  };
};

module.exports = permission;
