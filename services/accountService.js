const BaseService = require('./baseService');
const knex = require('./../db/connectKnex');
const _ = require('lodash');
const Security = require('../common/security');
const Constants = require('../common/constants');
const dayjs = require('dayjs');
const CryptoJS = require('crypto-js');
const ROLE_ENUM = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  SALE: 'sale',
};

class AccountService extends BaseService {
  getAccountsManagement = async (data, userInfo) => {
    try {
      const {
        f_branches,
        f_province_cities,
        f_districts,
        f_roles,
        f_status,
        f_sell_price_from,
        f_sell_price_to,
        f_rent_price_from,
        f_rent_price_to,
        keyword,
        limit = 20,
        offset,
        email,
        raw_phone_number,
        branch_id,
      } = data;

      const {user_id} = userInfo;
      let base_query = knex('users')
        .leftJoin('sales', 'users.id', 'sales.user_id')
        .whereNot({
          'users.status': Constants.STATUS_ENUM.DELETED,
        })
        .where((q) =>
          q
            .whereNot({
              'sales.status': Constants.STATUS_ENUM.DELETED,
            })
            .orWhere({
              'sales.id': null,
            }),
        )
        .innerJoin('users_roles', 'users.id', 'users_roles.user_id')
        .innerJoin('roles', 'users_roles.role_id', 'roles.id')
        .leftJoin('sale_branch', 'sales.id', 'sale_branch.sale_id')
        .leftJoin('branches', 'branches.id', 'sale_branch.branch_id')
        .leftJoin('sale_district', 'sales.id', 'sale_district.sale_id')
        .leftJoin('districts', 'sale_district.districts_id', 'districts.id')
        .leftJoin(
          'districts_translation',
          'districts_translation.district_id',
          'districts.id',
        )
        .leftJoin(
          'province_city',
          'districts.province_city_id',
          'province_city.id',
        )
        .leftJoin(
          'province_city_translation',
          'province_city_translation.province_city_id',
          'province_city.id',
        )
        .whereNot('roles.type', Constants.ROLES_TYPE_ENUM.SUPER_ADMIN)
        .whereNot('users.id', user_id);

      if (keyword) {
        base_query.where((q) =>
          q
            .where('users.full_name', 'ilike', `%${keyword.trim()}%`)
            .orWhere('users.raw_phone_number', 'ilike', `%${keyword.trim()}%`)
            .orWhere('branches.title', 'ilike', `%${keyword.trim()}%`)
            .orWhere(
              'districts_translation.title',
              'ilike',
              `%${keyword.trim()}%`,
            )
            .orWhere(
              'province_city_translation.title',
              'ilike',
              `%${keyword.trim()}%`,
            )
            .orWhere('roles.title', 'ilike', `%${keyword.trim()}%`),
        );
      }

      if (branch_id) {
        base_query.where('sale_branch.branch_id', branch_id);
      }

      if (f_status) {
        base_query.where('users.status', f_status);
      }
      if (email) {
        base_query.where('users.username', email.trim());
      }
      if (raw_phone_number) {
        base_query.where('users.raw_phone_number', raw_phone_number.trim());
      }

      let has_sell_price_range = f_sell_price_from || f_sell_price_to;
      let has_rent_price_range = f_rent_price_from || f_rent_price_to;

      if (has_sell_price_range) {
        base_query.where((q) =>
          q
            .whereNotNull('sales.sell_price_from')
            .orWhereNotNull('sales.sell_price_to'),
        );
      }

      if (has_rent_price_range) {
        base_query.where((q) =>
          q
            .whereNotNull('sales.rent_price_from')
            .orWhereNotNull('sales.rent_price_to'),
        );
      }

      if (f_sell_price_from && f_sell_price_to) {
        let sell_from = f_sell_price_from;
        let sell_to = f_sell_price_to;
        if (f_sell_price_to < f_sell_price_from) {
          sell_from = f_sell_price_to;
          sell_to = f_sell_price_from;
        }
        base_query.where((q) =>
          q
            .where((q1) =>
              q1
                .where('sales.sell_price_from', '<', sell_to)
                .where('sales.sell_price_to', '>', sell_from),
            )
            .orWhere((q2) =>
              q2
                .whereNull('sales.sell_price_from')
                .where('sales.sell_price_to', '>', sell_from),
            )
            .orWhere((q3) =>
              q3
                .whereNull('sales.sell_price_to')
                .where('sales.sell_price_from', '<', sell_to),
            ),
        );
      } else if (!f_sell_price_from && f_sell_price_to) {
        base_query.where((q) =>
          q
            .where('sales.sell_price_from', '<', f_sell_price_to)
            .orWhereNull('sales.sell_price_from'),
        );
      } else if (f_sell_price_from && !f_sell_price_to) {
        base_query.where((q) =>
          q
            .where('sales.sell_price_to', '>', f_sell_price_from)
            .orWhereNull('sales.sell_price_to'),
        );
      }

      if (f_rent_price_from && f_rent_price_to) {
        let rent_from = f_rent_price_from;
        let rent_to = f_rent_price_to;
        if (f_rent_price_to < f_rent_price_from) {
          rent_from = f_rent_price_to;
          rent_to = f_rent_price_from;
        }
        base_query.where((q) =>
          q
            .where((q1) =>
              q1
                .where('sales.rent_price_from', '<', rent_to)
                .where('sales.rent_price_to', '>', rent_from),
            )
            .orWhere((q2) =>
              q2
                .whereNull('sales.rent_price_from')
                .where('sales.rent_price_to', '>', rent_from),
            )
            .orWhere((q3) =>
              q3
                .whereNull('sales.rent_price_to')
                .where('sales.rent_price_from', '<', rent_to),
            ),
        );
      } else if (!f_rent_price_from && f_rent_price_to) {
        base_query.where((q) =>
          q
            .where('sales.rent_price_from', '<', f_rent_price_to)
            .orWhereNull('sales.rent_price_from'),
        );
      } else if (f_rent_price_from && !f_rent_price_to) {
        base_query.where((q) =>
          q
            .where('sales.rent_price_to', '>', f_rent_price_from)
            .orWhereNull('sales.rent_price_to'),
        );
      }

      let count_query = base_query.clone();

      if (f_roles?.length) {
        base_query.havingRaw(
          `jsonb_agg(roles.id::varchar) \\?| array[${f_roles
            .map(() => '?')
            .join(',')}]::varchar[]`,
          f_roles,
        );
        count_query.whereIn('roles.id', f_roles);
      }

      if (f_branches?.length) {
        base_query.havingRaw(
          `jsonb_agg(branches.id::varchar) \\?| array[${f_branches
            .map(() => '?')
            .join(',')}]::varchar[]`,
          f_branches,
        );
        count_query.whereIn('branches.id', f_branches);
      }

      if (f_province_cities?.length) {
        base_query.havingRaw(
          `jsonb_agg(province_city.id::varchar) \\?| array[${f_province_cities
            .map(() => '?')
            .join(',')}]::varchar[]`,
          f_province_cities,
        );
        count_query.whereIn('province_city.id', f_province_cities);
      }

      if (f_districts?.length) {
        base_query.havingRaw(
          `jsonb_agg(districts.id::varchar) \\?| array[${f_districts
            .map(() => '?')
            .join(',')}]::varchar[]`,
          f_districts,
        );
        count_query.whereIn('districts.id', f_districts);
      }

      const result = await base_query
        .clone()
        .groupBy('users.id', 'sales.id')
        .select(
          'users.id as user_id',
          'users.created_at as created_at',
          'users.full_name as full_name',
          'users.raw_phone_number as raw_phone_number',
          'users.last_login as last_login',
          'users.status as status',
          'sales.id as sales_id',
          'sales.sell_price_from as sell_price_from',
          'sales.sell_price_to as sell_price_to',
          'sales.rent_price_from as rent_price_from',
          'sales.rent_price_to as rent_price_to',
          knex.raw('jsonb_agg(DISTINCT roles.role) as role_type'),
          knex.raw(
            'jsonb_agg(Distinct districts_translation.title) as districts',
          ),
          knex.raw(
            'jsonb_agg(DISTINCT province_city_translation.title) as province_city',
          ),
          knex.raw('jsonb_agg(DISTINCT roles.title) as roles'),
          knex.raw('jsonb_agg(DISTINCT branches.title) as branches'),
        )
        .limit(limit)
        .offset(offset)
        .orderBy('users.created_at', 'desc');

      const {count} = await count_query
        .clone()
        .countDistinct('users.id')
        .first();

      return {result, count};
    } catch (error) {
      console.log('getAccountsManagement', error);
    }
  };

  getAccounts = async (data) => {
    const {keyword, limit = 20, offset, raw_phone_number, branch_id} = data;

    let base_query = knex('users')
      .leftJoin('sales', 'users.id', 'sales.user_id')
      .whereNot({
        'users.status': Constants.STATUS_ENUM.DELETED,
      })
      .where((q) =>
        q
          .whereNot({
            'sales.status': Constants.STATUS_ENUM.DELETED,
          })
          .orWhere({
            'sales.id': null,
          }),
      )
      .innerJoin('users_roles', 'users.id', 'users_roles.user_id')
      .innerJoin('roles', 'users_roles.role_id', 'roles.id')
      .leftJoin('sale_branch', 'sales.id', 'sale_branch.sale_id')
      .whereNot('roles.type', Constants.ROLES_TYPE_ENUM.SUPER_ADMIN);

    if (keyword) {
      base_query.where((q) =>
        q
          .where('users.full_name', 'ilike', `%${keyword.trim()}%`)
          .orWhere('users.raw_phone_number', 'ilike', `%${keyword.trim()}%`),
      );
    }

    if (branch_id) {
      base_query.where('sale_branch.branch_id', branch_id);
    }

    if (raw_phone_number) {
      base_query.where('users.raw_phone_number', raw_phone_number.trim());
    }

    let count_query = base_query.clone();

    const result = await base_query
      .clone()
      .groupBy('users.id', 'sales.id')
      .select(
        'users.id as user_id',
        'users.full_name as full_name',
        'users.raw_phone_number as raw_phone_number',
      )
      .limit(limit)
      .offset(offset)
      .orderBy('users.created_at', 'desc');

    const {count} = await count_query.clone().countDistinct('users.id').first();

    return {result, count};
  };

  checkUserNameExistByEmail = async ({user_id, raw_phone_number, email}) => {
    try {
      const response = await knex('users')
        .where((whereQuery) => {
          if (email) {
            whereQuery.where('username', email);
          }
          if (raw_phone_number) {
            whereQuery.where('raw_phone_number', raw_phone_number);
          }
          if (user_id) {
            whereQuery.whereNot('id', user_id);
          }
        })
        .first();
      if (!response) {
        return {is_duplicate: false};
      }
      return {is_duplicate: true};
    } catch (error) {
      console.log(error);
      return false;
    }
  };

  getListRoles = async (role, getAll) => {
    return knex('roles')
      .where((whereQuery) => {
        whereQuery
          .where('status', Constants.STATUS_ENUM.ACTIVE)
          .whereNot('type', Constants.ROLES_TYPE_ENUM.SUPER_ADMIN);

        if (getAll === 'false' && role === 'admin') {
          whereQuery.whereNot('role', role);
        }
      })
      .select('id', 'title', 'role')
      .orderBy('title', 'asc');
  };

  getListBranches = async () => {
    return knex({b: 'branches'})
      .joinRaw(
        `left join lateral (select bd.branch_id as branch_id,
            jsonb_build_object('province', bd.province_id, 'districts',
            jsonb_agg(bd.district_id)) as province_district
            from branch_district bd
                group by bd.branch_id, bd.province_id) as bd on b.id = bd.branch_id`,
      )
      .where({
        status: Constants.STATUS_ENUM.ACTIVE,
      })
      .select(
        'b.id',
        'b.title',
        knex.raw(
          `CASE
                WHEN bd.branch_id is not null then jsonb_agg(distinct bd.province_district)
                else '[]'::jsonb END  as permission_districts`,
        ),
      )
      .groupBy('b.id', 'b.title', 'bd.branch_id')
      .orderBy('title', 'asc');
  };

  insertAccount = async (data, user_id) => {
    const {
      branch_id,
      districts,
      email,
      full_name,
      raw_phone_number,
      role,
      sell_price_range,
      rent_price_range,
    } = data;

    try {
      await knex.transaction(async (trx) => {
        const response = await trx('users')
          .insert({
            username: email,
            full_name,
            raw_phone_number,
            password: Constants.DEFAULT_PASSWORD,
            status: Constants.STATUS_ENUM.ACTIVE,
            creator_id: user_id,
          })
          .returning(['id']);

        const {id} = response[0];

        const insert_role_res = await trx('users_roles').insert({
          user_id: id,
          role_id: role,
        });

        const get_role_res = await trx('roles')
          .where({
            status: Constants.STATUS_ENUM.ACTIVE,
            id: role,
          })
          .select('id', 'title', 'role')
          .first();

        if (get_role_res?.role === Constants.ROLES_CONSTANT.ROLES.ROLE_SALES) {
          const insert_sales = await trx('sales')
            .insert({
              user_id: id,
              sell_price_from: sell_price_range?.[0] ?? null,
              sell_price_to: sell_price_range?.[1] ?? null,
              rent_price_from: rent_price_range?.[0] ?? null,
              rent_price_to: rent_price_range?.[1] ?? null,
              status: Constants.STATUS_ENUM.ACTIVE,
              type: ROLE_ENUM.SALE,
            })
            .returning(['id']);

          const {id: sale_id} = insert_sales[0];

          const insert_sale_branch = await trx('sale_branch').insert({
            sale_id,
            branch_id: branch_id,
          });

          let insertDataSalesDistrict = districts.map((district_id) => {
            return {
              sale_id,
              districts_id: district_id,
            };
          });

          const insert_sale_district = await trx('sale_district')
            .insert(insertDataSalesDistrict)
            .returning(['sale_id', 'districts_id']);
        } else if (
          get_role_res?.role === Constants.ROLES_CONSTANT.ROLES.ROLE_ADMIN
        ) {
          const insert_sales = await trx('sales')
            .insert({
              user_id: id,
              type: ROLE_ENUM.ADMIN,
              status: Constants.STATUS_ENUM.ACTIVE,
            })
            .returning(['id']);
          const {id: sale_id} = insert_sales[0];
          await trx('sale_branch').insert({
            sale_id,
            branch_id: branch_id,
          });
        }
      });

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };
  getAccountById = async (id, userInfo) => {
    const {role} = userInfo;

    if (role === ROLE_ENUM.SUPER_ADMIN || role === ROLE_ENUM.ADMIN) {
      try {
        let is_editable = false;
        let base_query = knex('users')
          .leftJoin('sales', 'users.id', 'sales.user_id')
          .where({
            'users.id': id,
          })
          .whereNot({
            'users.status': Constants.STATUS_ENUM.DELETED,
          })
          .where((q) =>
            q
              .whereNot({
                'sales.status': Constants.STATUS_ENUM.DELETED,
              })
              .orWhere({
                'sales.id': null,
              }),
          )
          .innerJoin('users_roles', 'users.id', 'users_roles.user_id')
          .innerJoin('roles', 'users_roles.role_id', 'roles.id')
          .leftJoin('sale_branch', 'sales.id', 'sale_branch.sale_id')
          .leftJoin('branches', 'branches.id', 'sale_branch.branch_id')
          .leftJoin('sale_district', 'sales.id', 'sale_district.sale_id')
          .leftJoin('districts', 'sale_district.districts_id', 'districts.id')
          .leftJoin(
            'districts_translation',
            'districts_translation.district_id',
            'districts.id',
          )
          .leftJoin(
            'province_city',
            'districts.province_city_id',
            'province_city.id',
          )
          .leftJoin(
            'province_city_translation',
            'province_city_translation.province_city_id',
            'province_city.id',
          );

        const result = await base_query
          .clone()
          .groupBy('users.id')
          .groupBy('sales.id', 'roles.id')
          .select(
            'users.id as user_id',
            'users.created_at as created_at',
            'users.full_name as full_name',
            'users.username as email',
            'users.raw_phone_number as raw_phone_number',
            'users.last_login as last_login',
            'users.status as status',
            'sales.id as sales_id',
            'sales.sell_price_from as sell_price_from',
            'sales.sell_price_to as sell_price_to',
            'sales.rent_price_from as rent_price_from',
            'sales.rent_price_to as rent_price_to',
            'roles.role as role_type',
            knex.raw(
              'jsonb_agg(DISTINCT districts_translation.id) as districts',
            ),
            knex.raw(
              'jsonb_agg(DISTINCT province_city_translation.id) as province_city',
            ),
            knex.raw('jsonb_agg(DISTINCT roles.id) as roles'),
            knex.raw('jsonb_agg(DISTINCT branches.id) as branch'),
          )
          .first();

        if (
          role === ROLE_ENUM.SUPER_ADMIN ||
          (role === ROLE_ENUM.ADMIN && result?.role_type === 'sale')
        ) {
          is_editable = true;
        }

        return {...result, is_editable: is_editable};
      } catch (error) {
        console.error(error);
        return false;
      }
    } else {
      return 'forbidden';
    }
  };

  updateAccount = async ({
    id,
    email,
    raw_phone_number,
    full_name,
    role,
    branch_id,
    districts,
    sell_price_range,
    rent_price_range,
    status,
  }) => {
    try {
      await knex.transaction(async (trx) => {
        const edit_users = await trx('users').where('id', id).update({
          username: email,
          full_name,
          raw_phone_number,
          status,
        });

        const edit_roles = await trx('users_roles')
          .where('user_id', id)
          .update({
            role_id: role,
          });

        const get_role_res = await trx('roles')
          .where({
            status: Constants.STATUS_ENUM.ACTIVE,
            id: role,
          })
          .select('id', 'title', 'role')
          .first();

        if (get_role_res?.role === Constants.ROLES_CONSTANT.ROLES.ROLE_SALES) {
          const edit_sales = await trx('sales')
            .where('user_id', id)
            .update({
              sell_price_from: sell_price_range?.[0] ?? null,
              sell_price_to: sell_price_range?.[1] ?? null,
              rent_price_from: rent_price_range?.[0] ?? null,
              rent_price_to: rent_price_range?.[1] ?? null,
              status: Constants.STATUS_ENUM.ACTIVE,
            })
            .returning(['id']);

          const {id: sale_id} = edit_sales[0];

          await trx('sale_branch').where('sale_id', sale_id).update({
            branch_id: branch_id,
          });

          await trx('sale_district').where('sale_id', sale_id).del();

          let insertDataSalesDistrict = districts.map((district_id) => {
            return {
              sale_id,
              districts_id: district_id,
            };
          });

          await trx('sale_district')
            .insert(insertDataSalesDistrict)
            .returning(['sale_id', 'districts_id']);
        } else if (
          get_role_res?.role === Constants.ROLES_CONSTANT.ROLES.ROLE_ADMIN
        ) {
          const getSaleId = await trx('sales')
            .select('id')
            .where('user_id', id)
            .first();
          await trx('sale_branch').where('sale_id', getSaleId?.id).update({
            branch_id: branch_id,
          });
        }
      });

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  updateLastLogin = async ({username}) => {
    try {
      const res = await knex.transaction(async (trx) => {
        const edit_users = await trx('users')
          .where('username', username)
          .update({
            last_login: dayjs(),
          });
      });

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  updateStatusById = async ({status, id}, user_role) => {
    try {
      let response;
      if (
        user_role === ROLE_ENUM.SUPER_ADMIN ||
        user_role === ROLE_ENUM.ADMIN
      ) {
        if (user_role === ROLE_ENUM.ADMIN && id) {
          const checkIsRoleAdmin = await knex('users')
            .select('users.id')
            .innerJoin('users_roles', 'users.id', 'users_roles.user_id')
            .innerJoin('roles', 'users_roles.role_id', 'roles.id')
            .where('users.id', id)
            .whereNot('roles.role', ROLE_ENUM.ADMIN)
            .whereNot('roles.role', ROLE_ENUM.SUPER_ADMIN)
            .first();

          if (!checkIsRoleAdmin?.id) {
            return 'forbidden';
          }
        }
        response = await knex('users').where('id', id).update({
          status: status,
        });
      } else {
        return 'forbidden';
      }

      if (_.isUndefined(response)) {
        return false;
      }
      return response;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  updatePasswordById = async ({id, password}, user_role) => {
    const bytes = CryptoJS.AES.decrypt(password, Constants.SECRET_KEY_DECRYPT);
    const passwordRaw = bytes.toString(CryptoJS.enc.Utf8);
    const passwordHash = Security.hashPassword(passwordRaw);
    try {
      if (
        user_role === ROLE_ENUM.SUPER_ADMIN ||
        user_role === ROLE_ENUM.ADMIN
      ) {
        if (user_role === ROLE_ENUM.ADMIN && id) {
          const checkIsRoleAdmin = await knex('users')
            .select('users.id')
            .innerJoin('users_roles', 'users.id', 'users_roles.user_id')
            .innerJoin('roles', 'users_roles.role_id', 'roles.id')
            .where('users.id', id)
            .whereNot('roles.role', ROLE_ENUM.ADMIN)
            .whereNot('roles.role', ROLE_ENUM.SUPER_ADMIN)
            .first();

          if (!checkIsRoleAdmin?.id) {
            return 'forbidden';
          }
        }
        const response = await knex('users').where('id', id).update({
          password: passwordHash,
          update_password: new Date(),
        });
        if (_.isUndefined(response)) {
          return false;
        }
        return response;
      }
    } catch (error) {
      console.error(error);
      return false;
    }
  };
}

module.exports = new AccountService();
