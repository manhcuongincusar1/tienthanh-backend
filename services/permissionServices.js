const BaseService = require('./baseService');
const _ = require('lodash');
const knexPg = require('../db/connectKnex');
const Constants = require('../common/constants');
const redis = require('../db/redis');

const invalidate = (role_id) =>
  redis.del(`perm:role:${role_id}`, `perm:perms:${role_id}`);

class PermissionService extends BaseService {
  getPermissions = async (role) => {
    const {id: role_id, type} = await knexPg('roles')
      .where('role', role)
      .where('status', Constants.STATUS_ENUM.ACTIVE)
      .first();

    if (type && type === 1) {
      return {permission_data: true};
    }

    const row = await knexPg('role_permissions')
      .where('role_id', role_id)
      .first();
    if (!row) {
      return false;
    }
    // Backward-compat shape: cũ trả full doc Mongo (đã `delete _id`).
    return {
      role_id: row.role_id,
      title: row.title,
      permission_data: row.permission_data,
    };
  };

  getPermissionById = async (id) => {
    const row = await knexPg('role_permissions')
      .where('role_id', id)
      .first();
    if (row) {
      // Mongo cũ projection {role_id:false, role:false} → trả {permission_data, title}.
      return {
        title: row.title,
        permission_data: row.permission_data,
      };
    }
    const fallback = await knexPg('roles')
      .where('id', id)
      .select('title')
      .first();
    return fallback || false;
  };

  getPermissionsList = async () => {
    const roles = await knexPg('roles')
      .select('id', 'title')
      .whereNot('role', 'super_admin')
      .where('status', Constants.STATUS_ENUM.ACTIVE);

    const permissionRows = await knexPg('role_permissions').select(
      'role_id',
      'title',
      'permission_data',
    );

    if (!roles) {
      return false;
    }

    return roles.map((roleItem) => {
      const permissionItem = permissionRows.find(
        (p) => Number(p.role_id) === Number(roleItem.id),
      );
      if (!permissionItem) {
        return {title: roleItem.title, id: roleItem.id, amount: 0};
      }
      const amount = Object.entries(permissionItem.permission_data || {}).reduce(
        (acc, [, val]) => {
          if (val && _.isArray(val)) {
            return acc + val.length;
          }
          return acc;
        },
        0,
      );
      return {
        title: permissionItem.title,
        id: permissionItem.role_id,
        amount,
      };
    });
  };

  insertPermission = async ({role_id, permission_data, title}) => {
    // Upsert-safe: gọi 2 lần cùng role_id sẽ merge thay vì throw PK violation.
    const rows = await knexPg('role_permissions')
      .insert({
        role_id,
        title,
        permission_data,
        updated_at: knexPg.fn.now(),
      })
      .onConflict('role_id')
      .merge({
        title,
        permission_data,
        updated_at: knexPg.fn.now(),
      })
      .returning('*');
    if (rows[0]) await invalidate(role_id);
    return rows[0] || false;
  };

  updatePermission = async (roleData, permission_data) => {
    const {id, title} = roleData;
    const [row] = await knexPg('role_permissions')
      .insert({
        role_id: id,
        title,
        permission_data,
        updated_at: knexPg.fn.now(),
      })
      .onConflict('role_id')
      .merge({
        permission_data,
        title,
        updated_at: knexPg.fn.now(),
      })
      .returning('*');
    if (row) await invalidate(id);
    return row || false;
  };

  checkExistRoleByRoleId = async (id) => {
    const row = await knexPg('role_permissions')
      .where('role_id', id)
      .first();
    return Boolean(row && row.role_id);
  };

  permissionAccess = async (role_id, permission_key, feature_key) => {
    const response = await knexPg('roles')
      .where('status', Constants.STATUS_ENUM.ACTIVE)
      .where('id', role_id)
      .select('type')
      .first();

    if (response?.type && response.type === 1) {
      return true;
    }

    if (response?.type && response.type !== 1 && permission_key && feature_key) {
      const row = await knexPg('role_permissions')
        .where('role_id', role_id)
        .first();
      const permission_data = row?.permission_data;
      return Boolean(permission_data?.[permission_key]?.includes(feature_key));
    }

    return false;
  };
}

module.exports = new PermissionService();
