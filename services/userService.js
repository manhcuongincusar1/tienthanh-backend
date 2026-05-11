const BaseService = require('./baseService');
const _ = require('lodash');
const knexPg = require('../db/connectKnex');
const Constants = require('../common/constants');
const ROLE_ENUM = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  SALE: 2,
};

class UserService extends BaseService {
  loginUser = async (data) => {
    const {username, password} = data;
    const res = await knexPg('users')
      .innerJoin('users_roles', 'users_roles.user_id', 'users.id')
      .innerJoin('roles', 'roles.id', 'users_roles.role_id')
      .leftJoin({s: 'sales'}, (builder) => {
        builder
          .on('users.id', '=', 's.user_id')
          .onIn('s.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .leftJoin({sb: 'sale_branch'}, (builder) => {
        builder.on('s.id', '=', 'sb.sale_id');
      })
      .whereIn('users.status', [1, 2])
      .where('roles.status', 1)
      .where('users.username', username)
      .where('users.password', password)
      .select({
        id: 'users.id',
        username: 'users.username',
        full_name: 'users.full_name',
        status: 'users.status',
        role: 'roles.role',
        role_id: 'roles.id',
        update_password: 'users.update_password',
        branch_id: knexPg.raw(
          'COALESCE(jsonb_agg("sb"."branch_id") FILTER (WHERE "sb"."branch_id" IS NOT NULL), \'[]\')',
        ),
      })
      .groupBy([
        'users.id',
        'users.username',
        'users.full_name',
        'roles.role',
        'roles.id',
        'users.update_password',
      ])
      .first();

    if (_.isUndefined(res)) {
      return false;
    }

    if (res.status === 1) {
      return {data: res, active: true};
    } else if (res.status === 2) {
      return {data: res, active: false};
    }
  };

  getUserInfo = async (data) => {
    const {id, role} = data;

    try {
      const res = await knexPg
        .select({
          id: 'u.id',
          full_name: 'u.full_name',
          avatar: 'u.avatar',
          prices: knexPg.raw(
            "jsonb_strip_nulls(jsonb_build_object('sell_price_from', s.sell_price_from, 'sell_price_to', s.sell_price_to, 'rent_price_from', s.rent_price_from, 'rent_price_to', s.rent_price_to))",
          ),
          branch_id: knexPg.raw(
            'COALESCE(jsonb_agg("sb"."branch_id") FILTER (WHERE "sb"."branch_id" IS NOT NULL), \'[]\')',
          ),
          district_id: knexPg.raw(
            "CASE WHEN max(sd.districts_id) is not null then jsonb_agg(sd.districts_id) else '[]'::jsonb END",
          ),
          province_city_id: 'pc.id',
        })
        .from({u: 'users'})
        .where((builder) => {
          builder.andWhere({
            'u.id': id,
            'u.status': Constants.STATUS_ENUM.ACTIVE,
          });
        })
        .leftJoin({s: 'sales'}, (builder) => {
          builder
            .on('u.id', '=', 's.user_id')
            .onIn('s.status', [Constants.STATUS_ENUM.ACTIVE]);
        })
        .leftJoin({sb: 'sale_branch'}, (builder) => {
          builder.on('s.id', '=', 'sb.sale_id');
        })
        .leftJoin({sd: 'sale_district'}, (builder) => {
          builder.on('s.id', '=', 'sd.sale_id');
        })
        .leftJoin({d: 'districts'}, (builder) => {
          builder.on('d.id', '=', 'sd.districts_id');
        })
        .leftJoin({pc: 'province_city'}, (builder) => {
          builder.on('pc.id', '=', 'd.province_city_id');
        })
        .groupBy([
          'u.id',
          's.sell_price_from',
          's.sell_price_to',
          's.rent_price_from',
          's.rent_price_to',
          'pc.id',
        ])
        .first();

      return {...res, role: role};
    } catch (e) {
      console.log(e);
      return false;
    }
  };

  checkUserExist = async (data) => {
    const {username} = data;
    const response = await knexPg('users')
      .whereIn('status', [1, 2])
      .select('username', 'status', 'id', 'full_name')
      .where('username', username)
      .first();

    if (!response) {
      return false;
    }
    return response;
  };

  checkUserIsActive = async (user_id) => {
    const response = await knexPg('users')
      .select('id')
      .where('id', user_id)
      .where('status', Constants.STATUS_ENUM.ACTIVE)
      .first();
    if (response?.id) {
      return true;
    } else {
      return false;
    }
  };
  checkUserExistWhenImport = async ({username}) => {
    let response;
    if (username) {
      response = await knexPg('users')
        .where('status', Constants.STATUS_ENUM.ACTIVE)
        .select('username', 'status', 'id', 'full_name')
        .where('username', username)
        .first();
    }

    if (!response) {
      return false;
    }
    return response;
  };
  updateActivationKey = async (data) => {
    const {username, activationKey} = data;
    const response = await knexPg('users')
      .where('username', username)
      .where('status', 1)
      .update('activation_key', activationKey);
    if (!response) {
      return false;
    }
    return response;
  };

  checkTokenResetPassword = async (data) => {
    const {activation_key} = data;
    const response = await knexPg('users')
      .select('id')
      .where('status', 1)
      .where('activation_key', activation_key)
      .first();
    if (_.isEmpty(response)) {
      return false;
    }
    return response;
  };

  resetPassword = async (data) => {
    const {password, activation_key} = data;
    const response = await knexPg('users')
      .where('status', 1)
      .where('activation_key', activation_key)
      .update({
        password: password,
        activation_key: null,
      })
      .returning('id');
    if (_.isEmpty(response) || _.isUndefined(response)) {
      return false;
    }
    return response;
  };

  checkPassword = async (data) => {
    const {username, password} = data;
    const response = await knexPg('users')
      .select('id')
      .where('status', 1)
      .where('username', username)
      .where('password', password)
      .first();

    if (_.isEmpty(response) || _.isUndefined(response)) {
      return false;
    }
    return response;
  };

  updatePassword = async (data) => {
    const {username, new_password} = data;
    const response = await knexPg('users')
      .where('status', Constants.STATUS_ENUM.ACTIVE)
      .where('username', username)
      .update({
        password: new_password,
        update_password: new Date(),
      })
      .returning('id');
    if (_.isEmpty(response) || _.isUndefined(response)) {
      return false;
    }
    return response;
  };

  getPersonalInfo = async (data) => {
    const {username, permissionInfo, id} = data;
    let response;

    if (permissionInfo?.is_sale) {
      response = await knexPg('users')
        .where('users.id', id)
        .where('users.status', 1)
        .leftJoin('sales', 'sales.user_id', 'users.id')
        .joinRaw(
          'left join lateral (select sale_district.sale_id,jsonb_agg(Distinct districts_translation.title) as title from sale_district left join districts_translation on districts_translation.district_id = sale_district.districts_id where sales.id = sale_district.sale_id group by sale_district.sale_id) as districts_sub on districts_sub.sale_id = sales.id',
        )
        .leftJoin('sale_branch', 'sales.id', 'sale_branch.sale_id')
        .leftJoin('sale_district', 'sale_district.sale_id', 'sales.id')
        .leftJoin('districts', 'districts.id', 'sale_district.districts_id')
        .leftJoin('branches', 'branches.id', 'sale_branch.branch_id')
        .leftJoin(
          'province_city',
          'province_city.id',
          'districts.province_city_id',
        )
        .leftJoin(
          'province_city_translation',
          'province_city_translation.province_city_id',
          'province_city.id',
        )
        .where('province_city_translation.language_code', 'vi')
        .select(
          'users.username',
          'users.full_name',
          'users.avatar',
          'users.raw_phone_number',
          'districts_sub.title as district_title',
          'branches.title as branch_title',
          'province_city_translation.title as province_city_title',
          'sales.sell_price_from',
          'sales.sell_price_to',
          'sales.rent_price_from',
          'sales.rent_price_to',
        )
        .first();
    } else {
      response = await knexPg('users')
        .innerJoin('sales', 'sales.user_id', 'users.id')
        .innerJoin('sale_branch', 'sale_branch.sale_id', 'sales.id')
        .innerJoin('branches', 'branches.id', 'sale_branch.branch_id')
        .where('users.id', id)
        .where('users.status', Constants.STATUS_ENUM.ACTIVE)
        .select(
          'users.username',
          'users.full_name',
          'users.avatar',
          'users.raw_phone_number',
          knexPg.raw('jsonb_agg(Distinct branches.title) as branch_title'),
        )
        .groupBy('users.id')
        .first();
    }

    if (!response) {
      return false;
    }
    return response;
  };

  checkPhoneExist = async (data) => {
    const {username, raw_phone_number} = data;
    const response = await knexPg('users')
      .select('username', 'raw_phone_number')
      .whereNot('status', -1)
      .where('raw_phone_number', raw_phone_number)
      .first();

    if (_.isEmpty(response) || _.isUndefined(response)) {
      return false;
    }
    return response;
  };

  getPersonalInfoByUserId = async (id, permissionInfo = false) => {
    let baseQuery = knexPg('users')
      .where('users.id', id)
      .where('users.status', 1);
    if (permissionInfo) {
      baseQuery = baseQuery
        .innerJoin('sales', 'user_id', 'users.id')
        .innerJoin('sale_branch', 'sales.id', 'sale_branch.sale_id')
        .innerJoin('sale_district', 'sales.id', 'sale_district.sale_id')
        .innerJoin('districts', 'districts.id', 'sale_district.districts_id')
        .innerJoin('branches', 'branches.id', 'sale_branch.branch_id')
        .innerJoin(
          'province_city',
          'province_city.id',
          'districts.province_city_id',
        )
        .select(
          'districts.title as district_title',
          'branches.title as branch_title',
          'province_city.title as province_city_title',
          'sales.sell_price_from',
          'sales.sell_price_to',
          'sales.rent_price_from',
          'sales.rent_price_to',
        );
    }
    const response = await baseQuery
      .select(
        'users.id',
        'users.username',
        'users.full_name',
        'users.avatar',
        'users.raw_phone_number',
      )
      .first();

    if (!response) {
      return false;
    }
    return response;
  };

  checkPhoneExist = async (data) => {
    const {username, raw_phone_number} = data;
    const response = await knexPg('users')
      .select('username', 'raw_phone_number')
      .whereNot('status', -1)
      .where('raw_phone_number', raw_phone_number)
      .first();

    if (response && response.username === username) {
      return true;
    } else if (!response) {
      return true;
    }
    return false;
  };

  updatePersonalInfo = async (data) => {
    const {username, full_name, raw_phone_number} = data;
    const response = await knexPg('users')
      .whereNot('status', -1)
      .where('username', username)
      .update({
        full_name: full_name,
        raw_phone_number: raw_phone_number,
      })
      .returning('id');

    if (!response) {
      return false;
    }
    return response[0];
  };

  updateUrlAvatar = async (data) => {
    const {username, path} = data;
    const response = await knexPg('users')
      .whereNot('status', -1)
      .where('username', username)
      .update({
        avatar: path,
      })
      .returning(['id', 'avatar']);

    if (!response) {
      return false;
    }
    return response[0];
  };

  getRole = async () => {
    const response = await knexPg('roles')
      .where('status', Constants.STATUS_ENUM.ACTIVE)
      .select('id', 'role', 'title');
    if (!response) {
      return false;
    }
    return response;
  };

  getUserInfoToAssignRealEstate = async (keyword, branch_id) => {
    try {
      let response;
      if (keyword && branch_id) {
        const keywordNew = `%${keyword}%`;
        response = await knexPg('users')
          .select(
            'users.id',
            'users.raw_phone_number',
            'users.full_name',
            'users.username',
          )
          .innerJoin('users_roles', 'users.id', 'users_roles.user_id')
          .innerJoin('roles', 'roles.id', 'users_roles.role_id')
          .innerJoin('sales', 'sales.user_id', 'users.id')
          .innerJoin('sale_branch', 'sales.id', 'sale_branch.sale_id')
          .where(function (whereQuery) {
            whereQuery
              .whereNot('roles.type', ROLE_ENUM.SUPER_ADMIN)
              .where('users.status', Constants.STATUS_ENUM.ACTIVE)
              .where('sale_branch.branch_id', branch_id)
              .whereRaw(
                `("users"."username" ilike '${keywordNew}' or "users"."raw_phone_number" ilike '${keywordNew}')`,
              );
          })
          .limit(30);
      }
      if (!response) {
        return false;
      }

      return response;
    } catch (error) {
      console.log(error);
    }
  };
}

module.exports = new UserService();
