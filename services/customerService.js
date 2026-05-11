const BaseService = require('./baseService');
const knexPG = require('../db/connectKnex');
const Common = require('../common/common');
const Constants = require('../common/constants');
const _ = require('lodash');
const dayjs = require('dayjs');

const CUSTOMER_TYPE_ENUM = {
  SELL_RENT: 1,
  BUY_RENT: 2,
};

class CustomService extends BaseService {
  getCustomerListSellRent = async (params, permissionInfo, user_id) => {
    const {
      province_city_id,
      creator_sale_id,
      keyword,
      district_id,
      real_estate_status,
      range_price_from = 0,
      range_price_to,
      offset,
      limit,
      sorter,
      branch_id,
    } = params;

    let baseQuery = knexPG('customers')
      .where('customers.status', Constants.STATUS_ENUM.ACTIVE)
      .whereRaw(
        `("customers"."type" != ? or "customers"."type" is null)`,
        CUSTOMER_TYPE_ENUM.BUY_RENT,
      )
      .leftJoin({real_estate: 'real_estate'}, (builder) => {
        builder
          .on('real_estate.sale_id', '=', 'customers.id')
          .onIn('real_estate.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .joinRaw(
        'left join lateral (select sale_id, jsonb_agg(DISTINCT real_estate.type) as real_estate_type from real_estate where real_estate.status = 1 group by sale_id)real_estate_sub on real_estate_sub.sale_id = customers.id',
      );

    baseQuery = Common.buildWhereQuery(baseQuery, 'real_estate', {
      province_city_id:
        province_city_id && province_city_id.map((value) => Number(value)),
      district_id: district_id && district_id.map((value) => Number(value)),
    });

    if (real_estate_status) {
      const real_estate_status_new =
        real_estate_status === 3 ? null : real_estate_status;

      baseQuery = baseQuery.where('real_estate.type', real_estate_status_new);
    }

    if (range_price_to) {
      baseQuery = baseQuery.where('real_estate.price', '<=', range_price_to);
    }
    if (permissionInfo) {
      baseQuery = baseQuery.where('customers.creator_id', user_id);
    } else if (creator_sale_id) {
      baseQuery = baseQuery.whereIn('customers.creator_id', creator_sale_id);
    }
    if (!_.isUndefined(branch_id) && !_.isEmpty(branch_id)) {
      baseQuery.where('customers.branch_id', branch_id);
    }
    if (range_price_from) {
      baseQuery = baseQuery.where('real_estate.price', '>=', range_price_from);
    }
    baseQuery = baseQuery
      .leftJoin({cp_main: 'customer_phones'}, (builder) => {
        builder.on('cp_main.customer_id', '=', 'customers.id');
      })
      .leftJoin({cp_sub: 'customer_phones'}, (builder) => {
        builder.on('cp_sub.customer_id', '=', 'customers.id');
      })
      .leftJoin('users', 'users.id', 'customers.creator_id')
      .select(
        'customers.full_name as full_name',
        'users.full_name as creator_sale_name',
        'cp_main.phone_number as phone_number',
        'customers.created_at',
        'customers.id as customer_id',
        'real_estate_sub.real_estate_type',
      )
      .groupBy(
        'customers.id',
        'users.full_name',
        'cp_main.phone_number',
        'cp_main.is_main',
        'customers.created_at',
        'real_estate_sub.real_estate_type',
      );
    if (!_.isEmpty(sorter)) {
      let sorter_key;
      let sorter_value;
      _.each(sorter, (value, key) => {
        sorter_key = key;
        sorter_value = value ? 'asc' : 'desc';
      });
      if (sorter_key && sorter_value) {
        baseQuery = baseQuery.orderBy(`customers.${sorter_key}`, sorter_value);
      }
    } else {
      baseQuery = baseQuery.orderBy('customers.created_at', 'desc');
    }

    if (!_.isUndefined(keyword)) {
      baseQuery = baseQuery.where((whereQuery) => {
        whereQuery
          .whereILike('customers.full_name', `%${keyword}%`)
          .orWhereILike('cp_sub.phone_number', `%${keyword}%`)
          .orWhereILike('cp_main.phone_number', `%${keyword}%`);
      });
    }

    baseQuery = baseQuery.having('cp_main.is_main', '=', true);

    const response = await baseQuery.clone().limit(limit).offset(offset);

    const count = await baseQuery.clone();
    if (!response) {
      return false;
    } else {
      return {customer_list: response, count: count.length};
    }
  };

  getTransactionHistory = async ({
    sale_id,
    creator_sale_id,
    role,
    offset,
    limit,
    sorter,
  }) => {
    let baseQuery = knexPG('real_estate')
      .where('real_estate.status', 1)
      .where('real_estate.sale_id', sale_id);
    if (role === 'sale') {
      baseQuery = baseQuery.where(
        'real_estate.creator_sale_id',
        creator_sale_id,
      );
    }

    baseQuery = baseQuery
      .leftJoin('users', 'users.id', 'real_estate.creator_sale_id')
      .leftJoin(
        'province_city',
        'province_city.id',
        'real_estate.province_city_id',
      )
      .leftJoin('districts', 'districts.id', 'real_estate.district_id')
      .leftJoin('wards', 'wards.id', 'real_estate.ward_id')
      .leftJoin('streets', 'streets.id', 'real_estate.street_id')
      .leftJoin(
        'real_estate_status',
        'real_estate.real_estate_status_id',
        'real_estate_status.id',
      )
      .select(
        'real_estate.id',
        'real_estate.address',
        'real_estate.created_at',
        'real_estate.status',
        'real_estate_status.title as real_estate_status_title',
        'real_estate_status.color as real_estate_status_color',
        'province_city.title as province_city_title',
        'districts.title as district_title',
        'wards.title as ward_title',
        'streets.title as street_title',
        'users.full_name as creator_sale_name',
        'users.raw_phone_number as creator_sale_phone',
        'real_estate.real_estate_status_id as real_estate_status_id',
        'real_estate.type as type',
      );

    if (sorter && !_.isEmpty(sorter)) {
      let sorter_key;
      let sorter_value;

      _.each(sorter, (value, key) => {
        sorter_key = key;
        sorter_value = value ? 'asc' : 'desc';
      });
      if (sorter_key && sorter_value) {
        baseQuery = baseQuery.orderBy(sorter_key, sorter_value);
      }
    } else {
      baseQuery = baseQuery.orderBy('real_estate.created_at', 'desc');
    }

    const response = await baseQuery.clone().offset(offset).limit(limit);
    const count = await baseQuery.clone();

    if (!response) {
      return false;
    } else {
      return {list: response, count: count.length};
    }
  };

  getCustomerSellRentInfoByIdType = async (customer_id) => {
    let baseQuery = knexPG('customers')
      .where('customers.id', customer_id)
      .leftJoin(
        'customer_phones',
        'customers.id',
        'customer_phones.customer_id',
      );
    const response = await baseQuery
      .clone()
      .where('customer_phones.is_main', true)
      .select(
        'customers.full_name',
        'customer_phones.phone_number',
        'customers.goodwill',
      )
      .first();
    const phoneList = await baseQuery
      .clone()
      .where('customer_phones.is_main', false)
      .select('customer_phones.phone_number');
    if (!response) {
      return false;
    }

    return {
      data: response,
      phone_list: phoneList.map((value) => value.phone_number),
    };
  };

  getCustomerBuyRentInfoById = async (customer_id, userInfo) => {
    const isAccessible = await this.checkAccessibilityCustomer(
      customer_id,
      userInfo,
    );

    if (!isAccessible) {
      return 'forbidden';
    }
    let baseQuery = knexPG('customers')
      .where('customers.id', customer_id)
      .leftJoin(
        'customer_phones',
        'customers.id',
        'customer_phones.customer_id',
      )
      .leftJoin('users', 'customers.creator_id', 'users.id');
    const response = await baseQuery
      .clone()
      .where('customer_phones.is_main', true)
      .select(
        'customers.full_name',
        'customer_phones.phone_number',
        'customers.goodwill',
        'users.raw_phone_number as creator_phone',
        'users.full_name as creator_name',
      )
      .first();
    const phoneList = await baseQuery
      .clone()
      .where('customer_phones.is_main', false)
      .select('customer_phones.phone_number');
    if (!response) {
      return false;
    }

    return {
      data: response,
      phone_list: phoneList.map((value) => value.phone_number),
    };
  };

  checkExistPhoneNumber = async (
    {phone_number, customer_id, branch_id, type},
    user_id,
  ) => {
    let response;

    let creator_id = user_id;

    if (customer_id) {
      const response = await knexPG('customers')
        .where('status', Constants.STATUS_ENUM.ACTIVE)
        .where('id', customer_id)
        .select('creator_id')
        .first();
      creator_id = response?.creator_id;
    }
    if (phone_number?.length > 8 && creator_id) {
      response = await knexPG('customers')
        .select(
          'customer_phones.id',
          'customers.creator_id',
          'customers.id as customer_id',
          'customer_phones.phone_number',
        )
        .leftJoin(
          'customer_phones',
          'customers.id',
          'customer_phones.customer_id',
        )
        .where(function (whereQuery) {
          whereQuery
            .where('customers.status', Constants.STATUS_ENUM.ACTIVE)
            .where('customers.creator_id', creator_id)
            .where('customer_phones.phone_number', phone_number)
            .where('customers.branch_id', branch_id)
            .where('customers.type', type);
          if (customer_id) {
            whereQuery.whereNot('customers.id', customer_id);
          }
        })
        .catch((err) => {
          console.log(err);
        });
    }

    if (!response) {
      return false;
    }
    return {is_duplicate: response?.length > 0 ? true : false};
  };

  getListPhoneNumber = async (phone_number, user_id, branch_id) => {
    const response = await knexPG('customer_phones')
      .where('customer_phones.status', Constants.STATUS_ENUM.ACTIVE)
      .whereRaw(
        `("customers"."type" != ? or "customers"."type" is null)`,
        CUSTOMER_TYPE_ENUM.BUY_RENT,
      )
      .whereILike('customer_phones.phone_number', `%${phone_number}%`)
      .leftJoin('customers', 'customers.id', 'customer_phones.customer_id')
      .where({
        'customers.creator_id': user_id,
        'customers.branch_id': branch_id,
      })
      .select(
        'customer_phones.phone_number',
        'customers.id',
        'customers.full_name',
        'customers.creator_id',
        'customer_phones.status',
      );

    if (!response) {
      return false;
    }
    return response;
  };

  checkAccessibilityCustomer = async (id, userInfo) => {
    const {user_id, permissionInfo} = userInfo;
    if (permissionInfo) {
      if (id && user_id) {
        const response = await knexPG('customers')
          .select('id')
          .where('status', Constants.STATUS_ENUM.ACTIVE)
          .where('id', id)
          .where('creator_id', user_id)
          .first();
        return !!response?.id;
      } else {
        return false;
      }
    } else {
      return true;
    }
  };

  getCustomerSellRentInfoById = async (id, userInfo) => {
    let response;
    const isAccessible = await this.checkAccessibilityCustomer(id, userInfo);
    if (!isAccessible) {
      return 'forbidden';
    }
    if (id) {
      let baseQuery = knexPG('customers')
        .leftJoin(
          'customer_phones',
          'customer_phones.customer_id',
          'customers.id',
        )
        .where('customers.status', Constants.STATUS_ENUM.ACTIVE)
        .where('customers.id', id);
      const customerInfo = await baseQuery
        .clone()
        .select(
          'customers.full_name',
          'customer_phones.phone_number',
          'customer_phones.id as phone_number_id',
        )
        .where('customer_phones.is_main', true)
        .first();
      const phoneSubNumberList = await baseQuery
        .clone()
        .select(
          'customer_phones.phone_number',
          'customer_phones.id',
          'customer_phones.status',
        )
        .where('customer_phones.is_main', false)
        .where('customer_phones.status', Constants.STATUS_ENUM.ACTIVE);
      let newPhoneNumberSubList = [];

      if (phoneSubNumberList) {
        for await (const phone_number_item of phoneSubNumberList) {
          const isUsingInRealEstate = await knexPG('real_estate')
            .select('real_estate.id')
            .where('real_estate.saler_phone_id', phone_number_item?.id)
            .first();

          if (isUsingInRealEstate) {
            newPhoneNumberSubList.push({
              ...phone_number_item,
              is_delete: false,
            });
          } else {
            newPhoneNumberSubList.push({
              ...phone_number_item,
              is_delete: true,
            });
          }
        }
      }

      if (customerInfo) {
        response = {
          customer_data: customerInfo,
          phone_number_sub_list: newPhoneNumberSubList,
        };
      }
    }

    if (!response) {
      return false;
    }
    return response;
  };

  updateCustomerSellRentById = async (dataUpdate, customer_id) => {
    const {full_name, phone_number, phone_number_sub_list} = dataUpdate;
    let response;
    if (full_name && phone_number && customer_id) {
      response = await knexPG
        .transaction(async function (trx) {
          await knexPG('customers')
            .transacting(trx)
            .update({full_name: full_name})
            .where('customers.id', customer_id)
            .returning('customers.id');

          await knexPG('customer_phones')
            .transacting(trx)
            .where('customer_phones.customer_id', customer_id)
            .where('customer_phones.is_main', true)
            .update({phone_number: phone_number})
            .returning('customer_phones.customer_id');

          if (
            phone_number_sub_list?.length > 0 &&
            _.isArray(phone_number_sub_list)
          ) {
            phone_number_sub_list.forEach(async (phone_number_item) => {
              if (
                phone_number_item &&
                phone_number_item?.id &&
                phone_number_item.status !== 0
              ) {
                await knexPG('customer_phones')
                  .transacting(trx)
                  .where('customer_phones.id', phone_number_item.id)
                  .update({
                    phone_number: phone_number_item.phone_number,
                    status: phone_number_item.status,
                  })
                  .returning('customer_phones.customer_id')
                  .catch((err) => {
                    console.log(err);
                  });
              } else if (
                phone_number_item?.phone_number &&
                (phone_number_item.status === 0 || !phone_number_item.status)
              ) {
                await knexPG('customer_phones')
                  .transacting(trx)
                  .insert({
                    phone_number: phone_number_item.phone_number,
                    customer_id: customer_id,
                    is_main: false,
                    status: Constants.STATUS_ENUM.ACTIVE,
                  })
                  .returning('customer_phones.customer_id')
                  .catch((err) => {
                    console.log(err);
                  });
              }
            });
          }
        })
        .then(() => {
          return customer_id;
        })
        .catch((error) => {
          console.log(error);
          return false;
        });
    }

    if (!response) {
      return false;
    }
    return response;
  };

  updateCustomerPhoneSub = async (
    trx,
    {customer_id, phone_number_new, phone_number_prev},
  ) => {
    const insertPhoneValue = phone_number_new?.map((value) => ({
      is_main: false,
      status: Constants.STATUS_ENUM.ACTIVE,
      customer_id: customer_id,
      phone_number: value,
    }));

    let response = false;
    if (!_.isUndefined(phone_number_prev) && phone_number_prev.length > 0) {
      response = await knexPG('customer_phones')
        .where('customer_phones.customer_id', customer_id)
        .whereIn('phone_number', phone_number_prev)
        .transacting(trx)
        .del();
    }
    if (!_.isUndefined(insertPhoneValue) && insertPhoneValue.length > 0) {
      response = await trx
        .insert(insertPhoneValue)
        .into('customer_phones')
        .returning('customer_id');
    }

    if (!response) {
      return false;
    }
    return {customer_id: customer_id};
  };

  insertCustomerWhenNotExist = async (trx, dataInsert) => {
    try {
      const {full_name, phone_number, branch_id, creator_id, type} = dataInsert;
      let response;
      if (full_name && phone_number && branch_id && creator_id) {
        const checkExistCustomerByPhoneNumber =
          await this.checkIsExistCustomerByPhoneNumber({
            phone_number,
            creator_id,
            branch_id,
            type,
          });

        if (checkExistCustomerByPhoneNumber?.customer_id) {
          response = checkExistCustomerByPhoneNumber;
        } else {
          const insertedCustomerId = await this.insertCustomer(trx, {
            is_main_phone_number: true,
            full_name,
            phone_number,
            branch_id,
            creator_id,
          });

          if (insertedCustomerId) {
            response = insertedCustomerId;
          }
        }
      }
      return response;
    } catch (error) {
      throw error;
    }
  };

  checkIsExistCustomerByPhoneNumber = async (dataCustomer) => {
    const {phone_number, creator_id, branch_id, type} = dataCustomer;
    let response;
    if (phone_number && creator_id && branch_id) {
      response = await knexPG('customers')
        .select(
          'customers.id as customer_id',
          'customer_phones.id as customer_phone_id',
        )
        .leftJoin(
          'customer_phones',
          'customer_phones.customer_id',
          'customers.id',
        )
        .where(function () {
          this.where('customers.status', Constants.STATUS_ENUM.ACTIVE)
            .where('customer_phones.status', Constants.STATUS_ENUM.ACTIVE)
            .where('customers.branch_id', branch_id)
            .where('customers.creator_id', creator_id)
            .where('customer_phones.phone_number', phone_number)
            .where('customers.type', type);
        })
        .first()
        .then((res) => {
          if (res) {
            return res;
          }
          return false;
        })
        .catch((err) => {
          console.log(err);
          return false;
        });
    }

    if (!response) {
      return false;
    }

    return response;
  };

  insertCustomer = async (trx, dataInsert) => {
    try {
      const {
        is_main_phone_number,
        full_name,
        phone_number,
        branch_id,
        creator_id,
      } = dataInsert;

      const response = await trx
        .insert(
          {
            full_name: full_name,
            branch_id: branch_id,
            creator_id: creator_id,
            status: Constants.STATUS_ENUM.ACTIVE,
            type: CUSTOMER_TYPE_ENUM.SELL_RENT,
          },
          'id',
        )
        .into('customers')
        .then(async function (customerIds) {
          return trx
            .insert(
              {
                customer_id: customerIds[0]?.id,
                is_main: is_main_phone_number,
                phone_number: phone_number,
                status: Constants.STATUS_ENUM.ACTIVE,
              },
              ['customer_id', 'id'],
            )
            .into('customer_phones')
            .then((customerInsertToPhoneIds) => {
              if (customerInsertToPhoneIds[0]) {
                return customerInsertToPhoneIds[0];
              }
              return false;
            });
        });

      return {
        customer_id: response?.customer_id,
        customer_phone_id: response?.id,
      };
    } catch (error) {
      throw error;
    }
  };

  insertCustomerBuyRent = async (data) => {
    const {
      phone_number_main,
      phone_number_sub,
      full_name,
      goodwill,
      user_id,
      data_demand,
      created_at,
      branch_id,
    } = data;
    let response;
    response = await knexPG
      .transaction(async (trx) => {
        const responseInsertCustomers = await trx
          .insert({
            full_name: full_name,
            goodwill: goodwill,
            creator_id: user_id,
            status: Constants.STATUS_ENUM.ACTIVE,
            type: CUSTOMER_TYPE_ENUM.BUY_RENT,
            created_at: created_at
              ? new Date(created_at).toISOString()
              : new Date(),
            branch_id: branch_id,
          })
          .into('customers')
          .returning('id');
        await trx
          .insert({
            is_main: true,
            status: Constants.STATUS_ENUM.ACTIVE,
            customer_id: responseInsertCustomers?.[0]?.id,
            phone_number: phone_number_main,
          })
          .into('customer_phones')
          .returning('customer_id');

        if (!_.isUndefined(phone_number_sub)) {
          await this.updateCustomerPhoneSub(trx, {
            customer_id: responseInsertCustomers?.[0]?.id,
            phone_number_new: phone_number_sub,
          });
        }

        if (!_.isEmpty(data_demand)) {
          const customerDemandInsert = data_demand.map((item) => ({
            type: item.type,
            customer_id: responseInsertCustomers?.[0]?.id,
            price_from: item.price_from,
            price_to: item.price_to,
            districts_id: item.districts_id,
            province_city_id: item.province_city_id,
            note: item.note,
            uses: item.uses,
            status: Constants.STATUS_ENUM.ACTIVE,
            created_at: item.created_at
              ? new Date(item.created_at).toISOString()
              : new Date(),
          }));

          await trx
            .insert(customerDemandInsert)
            .into('customer_demands')
            .returning('customer_id');
        }
        return responseInsertCustomers?.[0]?.id;
      })
      .then((insertedId) => {
        return insertedId;
      })
      .catch((error) => {
        console.log('Insert customer buy rent error:', error);
      });

    if (!response) {
      return false;
    }
    return response;
  };

  getCustomerBuyRent = async (params, permissionInfo, user_id) => {
    const {
      offset,
      limit,
      province_city_id,
      districts_id,
      demand_type,
      creator_sale_id,
      goodwill,
      price_to,
      keyword,
      sorter,
      price_from,
      branch_id,
    } = params;

    let baseQuery = knexPG('customers')
      .where('customers.status', Constants.STATUS_ENUM.ACTIVE)
      .leftJoin({cp_main: 'customer_phones'}, (builder) => {
        builder
          .on('cp_main.customer_id', '=', 'customers.id')
          .onIn('cp_main.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .leftJoin({cp_sub: 'customer_phones'}, (builder) => {
        builder
          .on('cp_sub.customer_id', '=', 'customers.id')
          .onIn('cp_sub.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .leftJoin({cd: 'customer_demands'}, (builder) => {
        builder
          .on('cd.customer_id', '=', 'customers.id')
          .onIn('cd.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .leftJoin({u: 'users'}, (builder) => {
        builder
          .on('u.id', '=', 'customers.creator_id')
          .onIn('u.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .where('customers.type', CUSTOMER_TYPE_ENUM.BUY_RENT);

    baseQuery = Common.buildWhereQuery(baseQuery, 'cd', {
      province_city_id,
      districts_id,
      type: demand_type,
    });
    if (permissionInfo) {
      baseQuery = baseQuery.where('customers.creator_id', user_id);
    } else if (creator_sale_id && !_.isEmpty(creator_sale_id)) {
      baseQuery = baseQuery.whereIn('customers.creator_id', creator_sale_id);
    }
    if (goodwill) {
      baseQuery = baseQuery.where(
        'customers.goodwill',
        !!(Number(goodwill) - 1),
      );
    }
    if (branch_id) {
      baseQuery = baseQuery.where('customers.branch_id', branch_id);
    }
    if (price_from) {
      baseQuery = baseQuery.where('cd.price_from', '>=', price_from);
    }
    if (price_to) {
      baseQuery = baseQuery.where('cd.price_from', '<=', price_to);
    }

    if (!_.isUndefined(keyword)) {
      const keywordIlike = `%${keyword}%`;
      baseQuery = baseQuery.whereRaw(
        `("customers"."full_name" ilike '${keywordIlike}' or "cp_main"."phone_number" ilike '${keywordIlike}' or "cp_sub"."phone_number" ilike '${keywordIlike}')`,
      );
    }
    baseQuery = baseQuery.having('cp_main.is_main', '=', true);

    baseQuery = baseQuery
      .select(
        'customers.full_name',
        'customers.id',
        'cp_main.phone_number',
        'customers.goodwill',
        knexPG.raw('jsonb_agg(DISTINCT cd.type) as demand_type'),
        'customers.created_at',
        'u.full_name as creator_sale_name',
      )
      .groupBy(
        'customers.id',
        'customers.full_name',
        'cp_main.phone_number',
        'u.id',
        'cp_main.is_main',
      );
    if (!_.isEmpty(sorter)) {
      let sorter_key;
      let sorter_value;
      _.each(sorter, (value, key) => {
        sorter_key = key;
        sorter_value = value ? 'asc' : 'desc';
      });
      if (sorter_key && sorter_value) {
        baseQuery = baseQuery.orderBy(`customers.${sorter_key}`, sorter_value);
      }
    } else {
      baseQuery = baseQuery.orderBy('customers.created_at', 'desc');
    }

    const response = await baseQuery.clone().offset(offset).limit(limit);

    const count = await baseQuery.clone();
    if (!response) {
      return false;
    }
    return {customer_list: response, count: count.length};
  };

  getDemandBuyRentByCustomerId = async (params, customer_id) => {
    const {offset, limit, sorter, type} = params;
    let baseQuery = knexPG('customer_demands')
      .where('customer_demands.customer_id', customer_id)
      .where('customer_demands.status', Constants.STATUS_ENUM.ACTIVE)
      .leftJoin('districts', 'customer_demands.districts_id', 'districts.id');
    if (type) {
      baseQuery = baseQuery.where('customer_demands.type', type);
    }
    const countQuery = baseQuery.clone();
    if (sorter && !_.isEmpty(sorter)) {
      let sorter_key;
      let sorter_value;
      _.each(sorter, (value, key) => {
        sorter_key = key;
        sorter_value = value === 'descend' ? 'desc' : 'asc';
      });
      baseQuery = baseQuery.orderBy(
        `customer_demands.${sorter_key}`,
        sorter_value,
      );
    } else {
      baseQuery = baseQuery.orderBy('customer_demands.created_at', 'desc');
    }

    const response = await baseQuery
      .clone()
      .select(
        'customer_demands.price_from',
        'customer_demands.price_to',
        'customer_demands.type',
        'customer_demands.note',
        'customer_demands.uses',
        'customer_demands.province_city_id',
        'customer_demands.districts_id',
        'districts.title as district_title',
        'customer_demands.status',
        'customer_demands.created_at',
        'customer_demands.id',
      )
      .groupBy(
        'customer_demands.id',
        'districts.id',
        'customer_demands.created_at',
      )
      .offset(offset)
      .limit(limit);
    const {count} = await countQuery
      .clone()
      .select(knexPG.raw('count(distinct(customer_demands.id)) as count'))
      .first();
    if (!response) {
      return false;
    }
    return {list: response, count: count || 10};
  };

  updateCustomerDemand = async (data) => {
    const data_demand = data;
    const {
      province_city_id,
      districts_id,
      uses,
      note,
      price_from,
      customer_id,
      price_to,
      type,
      id,
    } = data_demand;

    const isExist = await knexPG('customer_demands')
      .where('id', id)
      .select('id')
      .first();
    let response;
    if (isExist) {
      response = await knexPG('customer_demands')
        .where('id', id)
        .update({
          province_city_id,
          districts_id,
          uses,
          note,
          price_from: price_from || null,
          price_to: price_to || null,
          type,
        })
        .returning('id');
    } else {
      response = await knexPG('customer_demands')
        .insert({
          province_city_id,
          districts_id,
          uses,
          note,
          price_from,
          price_to,
          type,
          customer_id,
          status: Constants.STATUS_ENUM.ACTIVE,
        })
        .returning('id');
    }
    if (!response) {
      return false;
    }
    return response;
  };

  deleteCustomerDemand = async (id) => {
    const response = await knexPG('customer_demands')
      .where('id', id)
      .del()
      .returning('id');
    if (!response) {
      return false;
    }
    return response;
  };

  updateCustomerBuyRent = async (data, permissionInfo, user_id) => {
    const {
      id,
      full_name,
      phone_number_main,
      phone_number_prev,
      phone_number_new,
      goodwill,
    } = data;
    let response;
    response = await knexPG
      .transaction(async (trx) => {
        const responseUpdateCustomer = await knexPG('customers')
          .where('id', id)
          .update({
            full_name,
            goodwill,
          })
          .returning(['id', 'creator_id'])
          .transacting(trx);
        const responseUpdateCustomerFirstCreator =
          responseUpdateCustomer?.[0]?.creator_id;
        const handleCheckIsCreatorBuyUserId = () => {
          return (
            responseUpdateCustomerFirstCreator &&
            permissionInfo &&
            responseUpdateCustomerFirstCreator !== user_id
          );
        };

        if (handleCheckIsCreatorBuyUserId()) {
          throw 'User can not edit customer';
        }

        await knexPG('customer_phones')
          .where('customer_id', id)
          .where('is_main', true)
          .update({phone_number: phone_number_main})
          .returning('customer_id')
          .transacting(trx);

        if (!_.isEmpty(phone_number_new) || !_.isEmpty(phone_number_prev)) {
          await this.updateCustomerPhoneSub(trx, {
            customer_id: id,
            phone_number_new: phone_number_new,
            phone_number_prev: phone_number_prev,
          });
        }

        return id;
      })
      .then((res) => {
        return res;
      })
      .catch((err) => {
        console.log('Update customer buy rent', err);
      });

    if (!response) {
      return false;
    }
    return response;
  };

  baseQueryListCustomerReport = (params) => {
    const {
      end_day,
      start_day,
      price_from_sell = 0,
      price_to_sell,
      price_from_rent = 0,
      price_to_rent,
      creator_sale,
      branch_id,
    } = params;

    let baseQuery = knexPG('customers')
      .innerJoin(
        'customer_demands',
        'customer_demands.customer_id',
        'customers.id',
      )
      .joinRaw(
        'left join lateral (select demand.price_from as price_from_sell, demand.id,demand.type ,demand.price_to as price_to_sell  from customer_demands as demand)demand_sell on customer_demands.id = demand_sell.id and demand_sell.type=1',
      )
      .joinRaw(
        'left join lateral (select demand.price_from as price_from_rent , demand.id,demand.type ,demand.price_to as price_to_rent from customer_demands as demand)demand_rent on customer_demands.id = demand_rent.id and demand_rent.type = 2',
      )
      .innerJoin('users', 'customers.creator_id', 'users.id')
      .innerJoin(
        'customer_phones',
        'customer_phones.customer_id',
        'customers.id',
      )
      .where('customer_phones.is_main', true)
      .whereNot('customer_demands.type', null);
    if (price_from_sell) {
      baseQuery = baseQuery.whereRaw(
        `case when demand_sell.type = 1 and demand_sell.type is not null then demand_sell.price_from_sell >= ? else demand_sell.type is null end`,
        price_from_sell,
      );
      if (!price_from_rent && !price_to_rent) {
        baseQuery = baseQuery.whereNot('demand_sell.id', null);
      }
    }
    if (price_to_sell) {
      baseQuery = baseQuery.whereRaw(
        `case when demand_sell.type = 1 and demand_sell.type is not null then demand_sell.price_to_sell <= ? else demand_sell.type is null end`,
        price_to_sell,
      );
      if (!price_from_rent && !price_to_rent) {
        baseQuery = baseQuery.whereNot('demand_sell.id', null);
      }
    }

    if (price_from_rent) {
      baseQuery = baseQuery.whereRaw(
        `case when demand_rent.type = 2 and demand_rent.type is not null then demand_rent.price_from_rent >= ? else demand_rent.type is null end`,
        price_from_rent,
      );
      if (!price_from_sell && !price_to_sell) {
        baseQuery = baseQuery.whereNot('demand_rent.id', null);
      }
    }
    if (price_to_rent) {
      baseQuery = baseQuery.whereRaw(
        `case when demand_rent.type = 2 and demand_rent.type is not null then demand_rent.price_to_rent <= ? else demand_rent.type is null end`,
        price_to_rent,
      );
      if (!price_from_sell && !price_to_sell) {
        baseQuery = baseQuery.whereNot('demand_rent.id', null);
      }
    }

    if (branch_id) {
      baseQuery = baseQuery.where('customers.branch_id', branch_id);
    }

    if (start_day && end_day) {
      const {f_start_day, f_end_day} = Common.convertDateToLocalTimeIOSString(
        start_day,
        end_day,
      );
      baseQuery = baseQuery
        .where(
          knexPG.raw('?? >= ?', ['customer_demands.created_at', f_start_day]),
        )
        .where(
          knexPG.raw('?? < ?', ['customer_demands.created_at', f_end_day]),
        );
    }

    if (creator_sale && !_.isEmpty(creator_sale)) {
      baseQuery = baseQuery.whereIn('customers.creator_id', creator_sale);
    }
    return baseQuery;
  };

  getListCustomerReport = async (params) => {
    const {
      offset,
      limit,
      end_day,
      start_day,
      price_from_sell,
      price_to_sell,
      price_from_rent,
      price_to_rent,
      creator_sale,
      branch_id,
      sort,
    } = params;
    let countQuery;

    let baseQuery = this.baseQueryListCustomerReport({
      end_day,
      start_day,
      price_from_sell,
      price_to_sell,
      price_from_rent,
      price_to_rent,
      creator_sale,
      branch_id,
    });

    countQuery = baseQuery.clone();
    baseQuery = baseQuery
      .select(
        'customers.full_name',
        'customer_phones.phone_number',
        'users.full_name as sale_full_name',
        'customer_demands.created_at',
        'demand_sell.price_from_sell',
        'demand_sell.price_to_sell',
        'demand_rent.price_from_rent',
        'demand_rent.price_to_rent',
        'customer_demands.type',
      )
      .groupBy(
        'customers.id',
        'customer_phones.phone_number',
        'customer_demands.id',
        'users.full_name',
        'demand_sell.price_from_sell',
        'demand_sell.price_to_sell',
        'demand_rent.price_from_rent',
        'demand_rent.price_to_rent',
      );

    if (sort && !_.isEmpty(sort)) {
      let sort_key;
      let sort_value;
      let sort_value_enum = {
        ascend: 'asc',
        descend: 'desc',
      };
      if (sort.price_from_sell) {
        Object.entries(sort).forEach((item) => {
          sort_key = item[0];
          sort_value = sort_value_enum[item[1]];
        });

        baseQuery = baseQuery.orderBy(`demand_sell.${sort_key}`, sort_value);
      } else if (sort.price_from_rent) {
        Object.entries(sort).forEach((item) => {
          sort_key = item[0];
          sort_value = sort_value_enum[item[1]];
        });
        baseQuery = baseQuery.orderBy(`demand_rent.${sort_key}`, sort_value);
      } else {
        Object.entries(sort).forEach((item) => {
          sort_key = item[0];
          sort_value = sort_value_enum[item[1]];
        });

        baseQuery = baseQuery.orderBy(
          `customer_demands.${sort_key}`,
          sort_value,
        );
      }
    } else {
      baseQuery = baseQuery.orderBy('customer_demands.created_at', 'desc');
    }
    const response = await baseQuery.clone().offset(offset).limit(limit);

    const {count} = await countQuery
      .clone()
      .select(knexPG.raw('count(distinct(customer_demands.id)) as count'))
      .first();

    if (!response) {
      return false;
    }
    return {list_data: response, count: count};
  };

  getListCustomerDataReport = async (params) => {
    const {
      end_day,
      start_day,
      creator_sale,
      price_from_sell,
      price_to_sell,
      price_from_rent,
      price_to_rent,
      branch_id,
    } = params;

    let baseQuery = this.baseQueryListCustomerReport({
      end_day,
      start_day,
      creator_sale,
      price_from_sell,
      price_to_sell,
      price_from_rent,
      price_to_rent,
      branch_id,
    });

    const response = await baseQuery
      .clone()
      .whereNot('customers.id', null)
      .whereNot('customer_demands.id', null)
      .select(
        knexPG.raw('count(distinct(customer_demands.id)) as value'),
        knexPG.raw(
          "to_char(date(customers.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY') as month",
        ),
        'customer_demands.type as title',
      )
      .groupBy(
        'customer_demands.type',
        knexPG.raw(
          "to_char(date(customers.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY')",
        ),
      );

    if (!response) {
      return false;
    }
    return response;
  };

  checkExistCustomerByPhone = async (params, customerInsertedList) => {
    try {
      const {phone_number, user_id, branch_id, type} = params;
      let resultCheckExistCustomer;

      if (_.isArray(customerInsertedList) && customerInsertedList.length > 0) {
        const resultCheckExistCustomerByParams = customerInsertedList?.find(
          (customer) => {
            return (
              customer.phone_number === phone_number &&
              customer.user_id === user_id &&
              customer.branch_id === branch_id
            );
          },
        );

        if (
          resultCheckExistCustomerByParams?.saler_id &&
          resultCheckExistCustomerByParams?.saler_phone_id
        ) {
          resultCheckExistCustomer = {
            saler_id: resultCheckExistCustomerByParams?.saler_id,
            saler_phone_id: resultCheckExistCustomerByParams?.saler_phone_id,
          };
        }
      }

      if (!resultCheckExistCustomer && phone_number && user_id && branch_id) {
        const isExistPhoneNumber = await knexPG('customers')
          .select(
            'customers.id as saler_id',
            'customer_phones.id as saler_phone_id',
          )
          .leftJoin(
            'customer_phones',
            'customers.id',
            'customer_phones.customer_id',
          )
          .where(function (whereQuery) {
            whereQuery
              .where('customers.status', Constants.STATUS_ENUM.ACTIVE)
              .where('customer_phones.status', Constants.STATUS_ENUM.ACTIVE)
              .where('customers.creator_id', user_id)
              .where('customer_phones.phone_number', phone_number)
              .where('customers.branch_id', branch_id)
              .where('customers.type', type);
          })
          .first();

        if (isExistPhoneNumber?.saler_id) {
          resultCheckExistCustomer = isExistPhoneNumber;
        }
      }
      return resultCheckExistCustomer;
    } catch (error) {
      console.log(error);
    }
  };

  insertCustomerSellRentWhenAssignRealEstate = async (trx, dataInsert) => {
    try {
      let customerInserted;
      const {full_name, phone_number, user_id, branch_id} = dataInsert;
      if (!full_name || !phone_number || !user_id || !branch_id) return false;
      customerInserted = await knexPG('customers')
        .insert(
          {
            status: Constants.STATUS_ENUM.ACTIVE,
            full_name: full_name,
            branch_id: branch_id,
            creator_id: user_id,
            type: CUSTOMER_TYPE_ENUM.SELL_RENT,
          },
          ['id'],
        )
        .transacting(trx);
      if (customerInserted) {
        const response = await knexPG('customer_phones')
          .insert(
            {
              status: Constants.STATUS_ENUM.ACTIVE,
              is_main: true,
              phone_number: phone_number,
              customer_id: customerInserted?.[0]?.id,
            },
            ['id', 'customer_id'],
          )
          .transacting(trx);
        customerInserted = {
          saler_id: response?.[0]?.customer_id,
          saler_phone_id: response?.[0]?.id,
        };
      } else {
        customerInserted = false;
      }
      return customerInserted;
    } catch (error) {
      throw error;
    }
  };
}

module.exports = new CustomService();
