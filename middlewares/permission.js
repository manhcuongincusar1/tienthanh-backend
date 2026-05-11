const RestAPI = require('../common/rest_api');
const knexPg = require('../db/connectKnex');
const Constants = require('../common/constants');
const redis = require('../db/redis');
const _ = require('lodash');

const ROLE_ENUM = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  SALE: 2,
};

// Cache role row (id, type) qua Redis 1h (DECISIONS C5).
// Invalidate explicit khi roleService update — caller phải `redis.del('perm:role:<id>')`.
async function loadRole(role_id) {
  return redis.wrap(`perm:role:${role_id}`, redis.TTL.PERMISSION, async () => {
    const row = await knexPg('roles')
      .where('status', Constants.STATUS_ENUM.ACTIVE)
      .where('id', role_id)
      .select('id', 'type')
      .first();
    return row || null;
  });
}

async function loadRolePermissions(role_id) {
  return redis.wrap(
    `perm:perms:${role_id}`,
    redis.TTL.PERMISSION,
    async () => {
      const row = await knexPg('role_permissions')
        .where('role_id', role_id)
        .first();
      return row?.permission_data || null;
    },
  );
}

const permission = (key) => {
  return async (req, res, next) => {
    const {role_id} = req.auth;
    const responseRole = await loadRole(role_id);

    if (responseRole && responseRole.type === ROLE_ENUM.SUPER_ADMIN) {
      return next();
    }

    if (responseRole && responseRole.type !== ROLE_ENUM.SUPER_ADMIN) {
      const permission_data = await loadRolePermissions(role_id);

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

permission.invalidateRole = (role_id) =>
  redis.del(`perm:role:${role_id}`, `perm:perms:${role_id}`);

module.exports = permission;
