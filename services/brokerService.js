const BaseService = require('./baseService');
const _ = require('lodash');
const knexPG = require('../db/connectKnex');
const Constants = require('../common/constants');
const Common = require('../common/common');
class BrokerService extends BaseService {
  checkDuplicateBrokerPhoneNumber = async (dataBroker) => {
    try {
      const {phone_number, creator_id, broker_id} = dataBroker;
      let response;
      if (creator_id && phone_number) {
        response = await knexPG('brokers')
          .select('brokers.id')
          .leftJoin('broker_phones', 'brokers.id', 'broker_phones.broker_id')
          .where(function (whereQuery) {
            whereQuery
              .where('brokers.status', Constants.STATUS_ENUM.ACTIVE)
              .where('broker_phones.phone_number', phone_number)
              .where('brokers.creator_id', creator_id);
            if (broker_id) {
              this.whereNot('brokers.id', broker_id);
            }
          })
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
      return {is_duplicate_phone_number: response?.[0] ? true : false};
    } catch (error) {
      console.log(error);
      return false;
    }
  };
  checkBrokerPhoneNumberMatchFullName = async (dataBroker) => {
    try {
      const {phone_number, full_name, creator_id} = dataBroker;
      let response;
      if (phone_number && full_name && creator_id) {
        response = await knexPG('brokers')
          .select('brokers.id')
          .leftJoin('broker_phones', 'brokers.id', 'broker_phones.broker_id')
          .where(function (whereQuery) {
            whereQuery
              .where('brokers.status', Constants.STATUS_ENUM.ACTIVE)
              .where('brokers.creator_id', creator_id)
              .where('brokers.full_name', full_name)
              .where('broker_phones.phone_number', phone_number);
          })
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
      return {is_match: response?.[0] ? true : false};
    } catch (error) {
      console.log(error);
      return false;
    }
  };

  checkIsExistBrokerByPhoneNumber = async (dataBroker, brokerInsertedList) => {
    let resultCheckExistBroker;
    const {phone_number, creator_id, branch_id} = dataBroker;
    if (_.isArray(brokerInsertedList) && brokerInsertedList.length > 0) {
      const resultCheckExistBrokerByParams = brokerInsertedList?.find(
        (broker) => {
          return (
            broker.phone_number === phone_number &&
            broker.user_id === creator_id &&
            broker.branch_id === branch_id
          );
        },
      );

      if (
        resultCheckExistBrokerByParams?.broker_id &&
        resultCheckExistBrokerByParams?.broker_phone_id
      ) {
        resultCheckExistBroker = {
          broker_id: resultCheckExistBrokerByParams?.broker_id,
          broker_phone_id: resultCheckExistBrokerByParams?.broker_phone_id,
        };
      }
    }

    if (!resultCheckExistBroker && phone_number && creator_id && branch_id) {
      resultCheckExistBroker = await knexPG('brokers')
        .select(
          'brokers.id as broker_id',
          'broker_phones.id as broker_phone_id',
        )
        .leftJoin('broker_phones', 'broker_phones.broker_id', 'brokers.id')
        .where(function () {
          this.where('brokers.status', Constants.STATUS_ENUM.ACTIVE)
            .where('brokers.creator_id', creator_id)
            .where('brokers.branch_id', branch_id)
            .where('broker_phones.phone_number', phone_number);
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

    if (!resultCheckExistBroker) {
      return false;
    }

    return resultCheckExistBroker;
  };

  insertBroker = async (trx, dataInsert) => {
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
          },
          'id',
        )
        .into('brokers')
        .then(async function (brokerIds) {
          return trx
            .insert(
              {
                broker_id: brokerIds[0]?.id,
                is_main: is_main_phone_number,
                phone_number: phone_number,
                status: Constants.STATUS_ENUM.ACTIVE,
              },
              ['broker_id', 'id'],
            )
            .into('broker_phones')
            .then(async function (brokerInsertToPhoneIds) {
              if (brokerInsertToPhoneIds[0]) {
                return brokerInsertToPhoneIds[0];
              }
              return false;
            });
        });

      return {broker_id: response?.broker_id, broker_phone_id: response?.id};
    } catch (error) {
      throw error;
    }
  };
  insertBrokerWhenNotExist = async (trx, dataInsert) => {
    try {
      const {full_name, phone_number, branch_id, creator_id} = dataInsert;
      let response;
      if (full_name && phone_number && branch_id && creator_id) {
        const checkExistBrokerByPhoneNumber =
          await this.checkIsExistBrokerByPhoneNumber({
            phone_number,
            creator_id,
            branch_id,
          });

        if (checkExistBrokerByPhoneNumber?.broker_id) {
          response = checkExistBrokerByPhoneNumber;
        } else {
          const insertedBrokerId = await this.insertBroker(trx, {
            is_main_phone_number: true,
            full_name,
            phone_number,
            branch_id,
            creator_id,
          });
          if (insertedBrokerId) {
            response = insertedBrokerId;
          }
        }
      }

      return response;
    } catch (error) {
      throw error;
    }
  };

  getListPhoneNumberByCreatorId = async (creatorId, keyword, branch_id) => {
    try {
      let baseQuery = knexPG('brokers')
        .select('brokers.full_name', 'broker_phones.phone_number', 'brokers.id')
        .leftJoin('broker_phones', 'brokers.id', 'broker_phones.broker_id')
        .where('brokers.status', Constants.STATUS_ENUM.ACTIVE)
        .where('broker_phones.status', Constants.STATUS_ENUM.ACTIVE)
        .where('brokers.creator_id', creatorId)
        .where('brokers.branch_id', branch_id);
      if (keyword) {
        baseQuery = baseQuery.whereILike(
          'broker_phones.phone_number',
          `%${keyword}%`,
        );
      }
      const response = await baseQuery.limit(100);
      if (!response) {
        return false;
      }

      return response;
    } catch (error) {
      console.log(error);
      return false;
    }
  };

  getBrokerList = async (params, permissionInfo) => {
    const {
      offset,
      limit,
      keyword,
      to_price,
      from_price = 0,
      real_estate_type,
      province_city_id,
      district_id,
      sorter,
      branch_id,
      creator_sale_id,
    } = params;

    let baseQuery = knexPG('brokers')
      .leftJoin('broker_phones', 'brokers.id', 'broker_phones.broker_id')
      .leftJoin(
        'broker_phones as broker_phones_sub',
        'brokers.id',
        'broker_phones_sub.broker_id',
      )
      .leftJoin({real_estate: 'real_estate'}, (builder) => {
        builder
          .on('real_estate.broker_id', '=', 'brokers.id')
          .onIn('real_estate.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .joinRaw(
        'left join lateral (select broker_id, jsonb_agg(DISTINCT real_estate.type) as real_estate_type from real_estate where real_estate.status = 1 group by broker_id)real_estate_sub on real_estate_sub.broker_id = brokers.id',
      )
      .leftJoin('users', 'users.id', 'brokers.creator_id')
      .where(function (whereQuery) {
        whereQuery
          .where('brokers.status', Constants.STATUS_ENUM.ACTIVE)
          .where('broker_phones.is_main', '=', true);

        if (keyword) {
          const keywordIlike = `%${keyword}%`;
          whereQuery.whereRaw(
            `("brokers"."full_name" ilike '${keywordIlike}' or "broker_phones"."phone_number" ilike '${keywordIlike}' or "broker_phones_sub"."phone_number" ilike '${keywordIlike}')`,
          );
        }

        if (from_price) {
          whereQuery.where('real_estate.price', '>=', from_price);
        }
        if (to_price) {
          whereQuery.where('real_estate.price', '<=', to_price);
        }
        if (real_estate_type) {
          const real_estate_type_new =
            real_estate_type === 3 ? null : real_estate_type;
          whereQuery.where('real_estate.type', real_estate_type_new);
        }
        if (
          from_price ||
          to_price ||
          real_estate_type === 1 ||
          real_estate_type === 2
        ) {
          whereQuery.where('real_estate.status', Constants.STATUS_ENUM.ACTIVE);
        }
        if (
          creator_sale_id &&
          _.isArray(creator_sale_id) &&
          creator_sale_id.length > 0
        ) {
          whereQuery.whereIn('brokers.creator_id', creator_sale_id);
        }
        if (!_.isUndefined(branch_id) && !_.isEmpty(branch_id)) {
          whereQuery.where('brokers.branch_id', branch_id);
        }
        if (permissionInfo?.is_sale && permissionInfo?.user_id) {
          whereQuery.where('brokers.creator_id', permissionInfo.user_id);
        }
      });

    baseQuery = Common.buildWhereQuery(baseQuery, 'real_estate', {
      province_city_id,
      district_id,
    });

    const countQuery = baseQuery.clone().distinct();

    baseQuery = baseQuery
      .select(
        'brokers.id as broker_id',
        'brokers.created_at',
        'brokers.full_name',
        'users.full_name as creator_full_name',
        'broker_phones.phone_number',
        'real_estate_sub.real_estate_type',
      )
      .groupBy(
        'brokers.id',
        'users.full_name',
        'broker_phones.phone_number',
        'broker_phones.is_main',
        'real_estate_type',
      );

    if (sorter && !_.isEmpty(sorter)) {
      let sorterKey;
      let sorterValue;
      _.each(sorter, (value, key) => {
        sorterKey = key;
        sorterValue = Constants.SORTER_VALUE_ENUM[value];
      });
      baseQuery = baseQuery.orderBy(`brokers.${sorterKey}`, sorterValue);
    } else {
      baseQuery = baseQuery.orderBy('brokers.created_at', 'desc');
    }

    const response = await baseQuery.clone().limit(limit).offset(offset);

    const countResult = await countQuery
      .clone()
      .countDistinct('brokers.id')
      .first();

    if (!response) {
      response;
    }
    return {broker_list: response, count: countResult?.count};
  };

  checkAccessibilityBroker = async (id, userInfo) => {
    const {user_id, permissionInfo} = userInfo;
    if (permissionInfo) {
      if (id && user_id) {
        const response = await knexPG('brokers')
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

  getBrokerById = async (id, userInfo) => {
    const isAccessible = await this.checkAccessibilityBroker(id, userInfo);
    if (!isAccessible) {
      return 'forbidden';
    }
    let response;
    if (id) {
      let baseQuery = knexPG('brokers')
        .leftJoin('broker_phones', 'broker_phones.broker_id', 'brokers.id')
        .where('brokers.status', Constants.STATUS_ENUM.ACTIVE)
        .where('brokers.id', id);
      const brokerInfo = await baseQuery
        .clone()
        .select(
          'brokers.full_name',
          'broker_phones.phone_number',
          'broker_phones.id as phone_number_id',
        )
        .where('broker_phones.is_main', true)
        .first();
      const phoneSubList = await baseQuery
        .clone()
        .select(
          'broker_phones.phone_number',
          'broker_phones.id',
          'broker_phones.status',
        )
        .where('broker_phones.is_main', false)
        .where('broker_phones.status', Constants.STATUS_ENUM.ACTIVE);
      let newPhoneSubList = [];

      if (phoneSubList) {
        for await (const phone_item of phoneSubList) {
          const isUsingInRealEstate = await knexPG('real_estate')
            .select('real_estate.id')
            .where('real_estate.broker_phone_id', phone_item?.id)
            .first();
          if (isUsingInRealEstate) {
            newPhoneSubList.push({...phone_item, is_delete: false});
          } else {
            newPhoneSubList.push({...phone_item, is_delete: true});
          }
        }
      }

      if (brokerInfo)
        response = {
          broker_data: brokerInfo,
          phone_number_sub_list: newPhoneSubList,
        };
    }

    if (!response) {
      return false;
    }
    return response;
  };

  checkExistPhoneNumber = async (params, user_id) => {
    const {broker_id, phone_number} = params;

    let response;
    if (phone_number?.length > 8 && user_id) {
      response = await knexPG('brokers')
        .select('broker_phones.id')
        .leftJoin('broker_phones', 'brokers.id', 'broker_phones.broker_id')
        .where(function (whereQuery) {
          whereQuery
            .where('brokers.status', Constants.STATUS_ENUM.ACTIVE)
            .where('brokers.creator_id', user_id)
            .where('broker_phones.phone_number', phone_number);
          if (broker_id) {
            whereQuery.whereNot('brokers.id', broker_id);
          }
        });
    }

    if (!response) {
      return false;
    }
    return {is_duplicate: response?.length > 0 ? true : false};
  };

  updateBrokerById = async (dataUpdate, id) => {
    const {full_name, phone_number, phone_number_sub_list} = dataUpdate;
    let response;
    if (full_name && phone_number && id) {
      response = await knexPG
        .transaction(async function (trx) {
          await knexPG('brokers')
            .transacting(trx)
            .update({full_name: full_name})
            .where('brokers.id', id)
            .returning('brokers.id');

          await knexPG('broker_phones')
            .transacting(trx)
            .where('broker_phones.broker_id', id)
            .where('broker_phones.is_main', true)
            .update({phone_number: phone_number})
            .returning('broker_phones.broker_id');

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
                await knexPG('broker_phones')
                  .transacting(trx)
                  .where('broker_phones.id', phone_number_item.id)
                  .update({
                    phone_number: phone_number_item.phone_number,
                    status: phone_number_item.status,
                  })
                  .returning('broker_phones.broker_id')
                  .catch((err) => {
                    console.log(err);
                  });
              } else if (
                phone_number_item?.phone_number &&
                (phone_number_item.status === 0 || !phone_number_item.status)
              ) {
                await knexPG('broker_phones')
                  .transacting(trx)
                  .insert({
                    phone_number: phone_number_item.phone_number,
                    broker_id: id,
                    is_main: false,
                    status: Constants.STATUS_ENUM.ACTIVE,
                  })
                  .returning('broker_phones.broker_id')
                  .catch((err) => {
                    console.log(err);
                  });
              }
            });
          }
        })
        .then(() => {
          return id;
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

  getTransactionHistory = async ({
    broker_id,
    creator_sale_id,
    role,
    offset,
    limit,
    sorter,
  }) => {
    let baseQuery = knexPG('real_estate')
      .where('real_estate.status', 1)
      .where('real_estate.broker_id', broker_id);
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
        'real_estate.agency as agency',
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

  insertBrokerWhenAssignRealEstate = async (trx, dataInsert) => {
    try {
      let brokerInserted;
      const {full_name, phone_number, user_id, branch_id} = dataInsert;
      if (!full_name || !phone_number || !user_id || !branch_id) return false;
      brokerInserted = await knexPG('brokers')
        .insert(
          {
            status: Constants.STATUS_ENUM.ACTIVE,
            full_name: full_name,
            branch_id: branch_id,
            creator_id: user_id,
          },
          ['id'],
        )
        .transacting(trx);

      if (brokerInserted) {
        const response = await knexPG('broker_phones')
          .insert(
            {
              status: Constants.STATUS_ENUM.ACTIVE,
              is_main: true,
              phone_number: phone_number,
              broker_id: brokerInserted?.[0]?.id,
            },
            ['id', 'broker_id'],
          )
          .transacting(trx);
        brokerInserted = {
          broker_id: response?.[0]?.broker_id,
          broker_phone_id: response?.[0]?.id,
        };
      } else {
        brokerInserted = false;
      }

      return brokerInserted;
    } catch (error) {
      throw error;
    }
  };

  getSaleListCreatBroker = async () => {
    const response = await knexPG('brokers')
      .where('brokers.status', Constants.STATUS_ENUM.ACTIVE)
      .innerJoin('users', 'users.id', 'brokers.creator_id')
      .where('users.status', Constants.STATUS_ENUM.ACTIVE)
      .select(
        'users.full_name',
        'users.id',
        'users.raw_phone_number as phone_number',
      )
      .groupBy('users.id');

    if (!response) {
      return false;
    }
    return response;
  };
}

module.exports = new BrokerService();
