const BaseService = require('./baseService');
const _ = require('lodash');
const Constants = require('../common/constants');
const knexPg = require('../db/connectKnex');
const realEstateDetailsRepo = require('./repositories/realEstateDetailsRepo');
const realEstateHistoryRepo = require('./repositories/realEstateHistoryRepo');
const Common = require('../common/common');
const customerService = require('./customerService');
const brokerService = require('./brokerService');
const realEstateStatusService = require('./realEstateStatusService');
const realEstateHistoricalService = require('./realEstateHistoricalService');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
// dayjs.tz.setDefault(Constants.DEFAULT_TIMEZONE);
const CUSTOMER_TYPE_ENUM = {
  SELL: 1,
  BUY: 2,
};

class RealEstateService extends BaseService {
  /**
   *
   * @param data
   * @param {Object} sort
   * @param {String} auth_id
   * @param {Boolean} isAll
   * @returns {Promise<boolean|{count: number, realEstateList: T}>}
   */

  generateWhereQueryListFlowPermission = (permission, type) => {
    let stringQuery = [];

    if (permission.sell_price_to || permission.rent_price_to) {
      stringQuery.push(
        `re.price <= '${
          type == 1
            ? permission.sell_price_to || 0
            : permission.rent_price_to || 0
        }' and re.price >= '${
          type == 1
            ? permission.sell_price_from || 0
            : permission.rent_price_from || 0
        }'`,
      );
    }
    if (permission.districts_id && permission.districts_id.length > 0) {
      stringQuery.push(`re.district_id in (${permission.districts_id})`);
    }
    if (permission.province_city_id) {
      stringQuery.push(
        `re.province_city_id = '${permission.province_city_id}'`,
      );
    }

    return !_.isEmpty(stringQuery)
      ? stringQuery.join(' and ')
      : 're.id is not null';
  };

  getList = async (data, sort = {}, auth_id, isAll = false) => {
    const {
      limit,
      offset = 0,
      status,
      type,
      keyword,
      realEstateStatus,
      categoryId,
      from_price = 0,
      to_price,
      creatorId,
      user_id,
      province,
      district,
      ward,
      street,
      subscribeId,
      location,
      myRecord,
      permissionInfo,
      real_estate_id,
      branch_id,
      direction,
    } = data;

    let statusArr = status
      ? status
      : [Constants.STATUS_ENUM.ACTIVE, Constants.STATUS_ENUM.PENDING];
    try {
      let baseQuery = knexPg
        .from({re: 'real_estate'})
        .leftJoin({reb: 'real_estate_branch'}, 're.id', 'reb.real_estate_id')
        .leftJoin({rec: 'real_estate_category'}, (builder) => {
          builder
            .on('rec.id', '=', 're.category_id')
            .onIn('rec.status', [Constants.STATUS_ENUM.ACTIVE]);
        })
        .leftJoin({res: 'real_estate_status'}, (builder) => {
          builder
            .on('res.id', '=', 're.real_estate_status_id')
            .onIn('res.status', [Constants.STATUS_ENUM.ACTIVE]);
        })
        .leftJoin({pc: 'province_city'}, (builder) => {
          builder.on('pc.id', '=', 're.province_city_id');
        })
        .leftJoin({pct: 'province_city_translation'}, (builder) => {
          builder.on('pc.id', '=', 'pct.province_city_id');
        })
        .leftJoin({d: 'districts'}, (builder) => {
          builder.on('d.id', '=', 're.district_id');
        })
        .leftJoin({dt: 'districts_translation'}, (builder) => {
          builder.on('d.id', '=', 'dt.district_id');
        })
        .leftJoin({w: 'wards'}, (builder) => {
          builder.on('w.id', '=', 're.ward_id');
        })
        .leftJoin({wt: 'wards_translation'}, (builder) => {
          builder.on('w.id', '=', 'wt.ward_id');
        })
        .leftJoin({str: 'streets'}, (builder) => {
          builder.on('str.id', '=', 're.street_id');
        })
        .leftJoin({strt: 'streets_translation'}, (builder) => {
          builder.on('str.id', '=', 'strt.street_id');
        })
        .leftJoin({u: 'users'}, (builder) => {
          builder.on('u.id', '=', 're.creator_sale_id');
        })
        .leftJoin({re_sub: 'real_estate_subscribe'}, (builder) => {
          builder
            .on('re.id', '=', 're_sub.real_estate_id')
            .onIn('re_sub.sale_id', [auth_id]);
        })
        .leftJoin({c: 'customers'}, (builder) => {
          builder.on('c.id', '=', 're.sale_id');
        })
        .leftJoin({cp: 'customer_phones'}, (builder) => {
          builder.on('cp.id', '=', 're.saler_phone_id');
        })
        .leftJoin({brokers: 'brokers'}, (builder) => {
          builder.on('brokers.id', '=', 're.broker_id');
        })
        .leftJoin({broker_phones: 'broker_phones'}, (builder) => {
          builder.on('broker_phones.id', '=', 're.broker_phone_id');
        })
        .where((builder) => {
          builder.whereIn('re.status', statusArr);
        })
        .where('re.type', Number(type))
        .where('re.price', '>=', from_price)
        .andWhere('re.status', Constants.STATUS_ENUM.ACTIVE);

      if (!_.isUndefined(branch_id)) {
        baseQuery.andWhere('reb.branch_id', branch_id);
      }
      if (permissionInfo && permissionInfo.is_sale) {
        const stringQueryFlowPermission =
          this.generateWhereQueryListFlowPermission(permissionInfo, type);
        baseQuery = baseQuery.whereRaw(
          `case when re.creator_sale_id = ?
            then re.id is not null
            else ${stringQueryFlowPermission} end`,
          user_id || auth_id,
        );
      }

      if (keyword) {
        const keywordSearch = `%${keyword?.toString()?.trim()}%`;

        baseQuery = baseQuery.where((builder) => {
          builder
            .orWhereILike('re.address', keywordSearch)
            .orWhereRaw(
              `re.full_address @@ plainto_tsquery('${keywordSearch}')`,
            )
            .orWhereILike('re.code', keywordSearch);
        });
      }

      if (real_estate_id && real_estate_id?.length > 0) {
        baseQuery = baseQuery.whereIn('re.id', real_estate_id);
      }

      Common.buildWhereQuery(baseQuery, 're', {
        type,
        real_estate_status_id: realEstateStatus,
        category_id: categoryId,
        creator_sale_id: creatorId,
        province_city_id: province,
        district_id: district,
        ward_id: ward,
        street_id: street,
        location: location,
        direction: direction,
      });

      if (to_price) {
        baseQuery = baseQuery.where('re.price', '<=', to_price);
      }
      if (subscribeId) {
        baseQuery = baseQuery.where((builder) => {
          builder.where('re_sub.sale_id', '=', subscribeId);
        });
      }
      let listQuery = baseQuery.clone().distinct();
      if (!isAll) {
        listQuery.limit(_.toNumber(limit)).offset(offset);
      }
      listQuery = listQuery
        .clone()
        .distinct()
        .column([
          {
            id: 're.id',
            code: 're.code',
            address: 're.address',
            brokerage_fees: 're.brokerage_fees',
            category_title: 'rec.title',
            real_estate_status_id: 'res.id',
            real_estate_status: 'res.title',
            real_estate_status_color: 'res.color',
            location: 're.location',
            direction: 're.direction',
            province_city: 'pct.title',
            district: 'dt.title',
            ward: 'wt.title',
            street: 'strt.title',
            price: 're.price',
            creator: 'u.full_name',
            creator_sale_id: 're.creator_sale_id',
            sale_full_name: 'c.full_name',
            sale_phone: 'cp.phone_number',
            broker_full_name: 'brokers.full_name',
            broker_phone_number: 'broker_phones.phone_number',
            creator_phone: 'u.raw_phone_number',
            created_date: 're.created_at',
            modified_date: 're.modification_at',
            status: 're.status',
            type: 're.type',
            agency: 're.agency',
            is_subscribe: knexPg.raw('re_sub.sale_id IS NOT NULL'),
          },
        ]);

      if (sort && !_.isEmpty(sort)) {
        const KEY = {
          created_date: 'created_at',
          modified_date: 'modification_at',
          price: 'price',
        };
        const value = {
          descend: 'desc',
          ascend: 'asc',
        };
        let sort_key;
        let sort_value;
        Object.entries(sort).forEach((item) => {
          sort_key = KEY[item[0]];
          sort_value = value[item[1]];
        });
        listQuery = listQuery.orderBy(`re.${sort_key}`, sort_value);
      } else {
        listQuery = listQuery.orderBy('re.created_at', 'desc');
      }

      let response = await listQuery.then(async (res) => {
        if (res) {
          return await Promise.all(
            _.map(res, async (realEstate) => {
              const responseDetail = await realEstateDetailsRepo.findByRealEstateId(
                realEstate.id,
              );
              if (
                permissionInfo &&
                permissionInfo.is_sale &&
                realEstate?.creator_sale_id !== auth_id
              ) {
                const {
                  sale_full_name,
                  sale_phone,
                  broker_full_name,
                  broker_phone_number,
                } = realEstate;

                return {
                  ...realEstate,
                  detail: responseDetail ? responseDetail : {},
                  sale_full_name: sale_full_name
                    ? `${sale_full_name?.slice(0, 1)}*****`
                    : '',
                  sale_phone: sale_phone
                    ? `${sale_phone?.slice(0, 1)}*****`
                    : '',
                  broker_full_name: `${broker_full_name?.slice(0, 1)}*****`,
                  broker_phone_number: `${broker_phone_number?.slice(
                    0,
                    1,
                  )}*****`,
                };
              } else {
                return {
                  ...realEstate,
                  detail: responseDetail ? responseDetail : {},
                };
              }
            }),
          );
        }
      });
      const {count} = await baseQuery.clone().countDistinct('re.id').first();

      if (!response || !count) {
        return false;
      }
      return {realEstateList: response, count: _.toNumber(count)};
    } catch (e) {
      console.error('get list real estate', e.message);
      return false;
    }
  };

  insertRealEstate = async (mainData, detailData) => {
    const {
      address,
      saler_phone_number,
      saler_full_name,
      price,
      category_title,
      creator_sale_id,
      province_city_title,
      district_title,
      street_title,
      ward_title,
      type,
      duplicate,
      previous_real_estate_status,
      full_name,
      note_change,
      is_internal,
      created_at,
      broker_full_name,
      broker_phone_number,
      branch_id,
    } = mainData;

    try {
      let {real_estate_status_id} = mainData;
      let detailRealEstateInsertedId;
      let historyRealEstateInsertedId;
      let thisRealEstateService = this;
      const full_address_update_history = `${address}, ${street_title}, ${ward_title}, ${district_title}, ${province_city_title}`;
      const full_address = `${address} ${street_title} ${ward_title} ${district_title} ${province_city_title}`;

      if (!duplicate && _.isUndefined(real_estate_status_id)) {
        const real_estate_status_new =
          await realEstateStatusService.getDefaultRealEstateStatus();
        if (real_estate_status_new) {
          real_estate_status_id = real_estate_status_new.id;
        }
      } else if (duplicate) {
        real_estate_status_id = null;
      }

      const resultInsertedRealEstateId = await knexPg.transaction(
        async function (trx) {
          const checkExistSale =
            await customerService.insertCustomerWhenNotExist(trx, {
              full_name: saler_full_name,
              phone_number: saler_phone_number,
              creator_id: creator_sale_id,
              branch_id: branch_id,
              type: CUSTOMER_TYPE_ENUM.SELL,
            });

          const checkExistBroker = await brokerService.insertBrokerWhenNotExist(
            trx,
            {
              full_name: broker_full_name,
              phone_number: broker_phone_number,
              branch_id: branch_id,
              creator_id: creator_sale_id,
            },
          );

          let response;
          if (checkExistSale || checkExistBroker) {
            const codeRealEstate =
              await thisRealEstateService.generateCodeRealEstate();
            if (codeRealEstate) {
              await thisRealEstateService
                .insertMainDataRealEstate(trx, {
                  ...mainData,
                  code: codeRealEstate,
                  full_address: full_address,
                  saler_phone_id: checkExistSale?.customer_phone_id,
                  sale_id: checkExistSale?.customer_id,
                  broker_id: checkExistBroker?.broker_id,
                  broker_phone_id: checkExistBroker?.broker_phone_id,
                  type,
                  is_internal: is_internal ?? is_internal,
                  created_at: created_at
                    ? new Date(created_at).toISOString()
                    : new Date(),
                  real_estate_status_id: real_estate_status_id,
                })
                .then(async (insertedRealEstateId) => {
                  if (insertedRealEstateId) {
                    // Detail + history tham gia cùng `trx` để rollback atomic.
                    detailRealEstateInsertedId =
                      await thisRealEstateService.insertDetailDataRealEstate(
                        {
                          ...detailData,
                          real_estate_id: insertedRealEstateId,
                          branch_id: branch_id,
                        },
                        trx,
                      );
                    const created_at_new = created_at
                      ? new Date(created_at)
                      : new Date();
                    historyRealEstateInsertedId =
                      await thisRealEstateService.insertHistoryRealEstateToMongoDB(
                        {
                          real_estate_id: insertedRealEstateId,
                          created_at: created_at_new?.toISOString(),
                          next_real_estate_status: real_estate_status_id
                            ? {
                                id: real_estate_status_id,
                                title: previous_real_estate_status,
                              }
                            : null,
                          price: price,
                          status: Constants.STATUS_ENUM.ACTIVE,
                          creator_full_name: full_name,
                          full_address: full_address_update_history,
                          category_title: category_title,
                          real_estate_type: type,
                          note_change: real_estate_status_id
                            ? note_change
                            : Constants.LABEL_NOTE_REAL_ESTATE_DUPLICATE,
                          is_internal: is_internal,
                          branch_id: branch_id,
                        },
                        trx,
                      );

                    response = insertedRealEstateId;
                    return insertedRealEstateId;
                  }
                })
                .then(trx.commit)
                .catch(async (error) => {
                  // PG transaction rollback đảm bảo atomic — không cần xoá thủ công.
                  // Detail + history đã tham gia trx → rollback dọn hết.
                  console.error('Insert real_estate failed, rollback:', error);
                  await trx.rollback();
                });

              return response;
            } else {
              return false;
            }
          }
        },
      );

      return resultInsertedRealEstateId;
    } catch (error) {
      console.log('Insert real estate error:', error);
    }
  };
  generateCodeRealEstate = async () => {
    const {count} = await knexPg('real_estate').count().first();
    if (count) {
      const item = [...(Number(count) + 1).toString()];
      let code = [];
      for (let i = 0; i < 8 - item.length; i++) {
        code.push(0);
      }
      const codeNew = [...code, ...item].join('');
      return codeNew;
    }
    return undefined;
  };
  insertMainDataRealEstate = async (trx, mainData) => {
    const {
      address,
      agency,
      goodwill,
      brokerage_fees,
      price,
      sale_id,
      creator_sale_id,
      category_id,
      real_estate_status_id,
      province_city_id,
      parent_real_estate_id,
      district_id,
      street_id,
      ward_id,
      location,
      code,
      full_address,
      saler_phone_id,
      type,
      is_internal,
      created_at,
      broker_id,
      broker_phone_id,
      branch_id,
      direction,
    } = mainData;

    try {
      const response = await trx
        .insert({
          address,
          agency,
          goodwill,
          broker_id,
          broker_phone_id,
          brokerage_fees,
          price,
          sale_id,
          creator_sale_id,
          status: Constants.STATUS_ENUM.ACTIVE,
          category_id,
          real_estate_status_id,
          province_city_id,
          parent_real_estate_id,
          district_id,
          street_id,
          ward_id,
          location,
          code,
          full_address,
          saler_phone_id,
          type,
          direction,
          is_internal: is_internal ?? is_internal,
          created_at: created_at
            ? new Date(created_at).toISOString()
            : new Date(),
        })
        .into('real_estate')
        .returning('id')
        .then(async (res) => {
          if (res[0]) {
            return res[0].id;
          }
        });

      if (response) {
        await trx
          .insert({
            branch_id: branch_id,
            real_estate_id: response,
          })
          .into('real_estate_branch');
      }

      return response;
    } catch (error) {
      throw error;
    }
  };
  insertDetailDataRealEstate = async (detailData, trx) => {
    return realEstateDetailsRepo.insertDetail(
      {
        ...detailData,
        status: Constants.STATUS_ENUM.ACTIVE,
      },
      trx,
    );
  };

  // Tên giữ "ToMongoDB" cho backward-compat callsite, nhưng ghi vào PG.
  insertHistoryRealEstateToMongoDB = async (historyData, trx) => {
    return realEstateHistoryRepo.insertHistory(historyData, trx);
  };

  checkDuplicateRealEstate = async (data) => {
    const {
      province_city_id,
      district_id,
      street_id,
      ward_id,
      type,
      address,
      real_estate_status_id,
      real_estate_id,
      branch_id,
    } = data;
    let response;

    let baseQuery = knexPg('real_estate').leftJoin(
      'real_estate_branch',
      'real_estate_branch.real_estate_id',
      'real_estate.id',
    );
    if (province_city_id && district_id && street_id && ward_id) {
      baseQuery = Common.buildWhereQuery(baseQuery, 'real_estate', {
        type,
        province_city_id,
        district_id,
        street_id,
        ward_id,
        status: Constants.STATUS_ENUM.ACTIVE,
      });

      if (real_estate_status_id) {
        baseQuery = baseQuery.where(
          'real_estate_status_id',
          real_estate_status_id,
        );
      }

      if (branch_id) {
        baseQuery = baseQuery.where('real_estate_branch.branch_id', branch_id);
      }
      if (real_estate_id) {
        baseQuery = baseQuery.whereNot('real_estate.id', real_estate_id);
      }

      response = await baseQuery
        .select(
          'real_estate.real_estate_status_id',
          'real_estate.id',
          'real_estate.creator_sale_id',
          'real_estate.address',
        )
        .whereRaw(
          'LOWER(real_estate.address) = ?',
          address.toString().toLowerCase(),
        )
        .orderBy('real_estate.created_at', 'desc')
        .first()
        .then(async (resRealEstate) => {
          if (resRealEstate && !real_estate_status_id) {
            return {is_duplicate: true};
          } else if (resRealEstate) {
            const response = await knexPg('real_estate_status')
              .where('status', Constants.STATUS_ENUM.ACTIVE)
              .where('id', resRealEstate.real_estate_status_id)
              .select('is_allow_duplicate')
              .first()
              .then((res) => {
                if (res.is_allow_duplicate) {
                  return {
                    is_duplicate: false,
                  };
                } else {
                  return {is_duplicate: true};
                }
              });
            return response;
          }

          return {is_duplicate: false};
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

  updateRealEstate = async (mainData, detailData, real_estate_id, userInfo) => {
    const {
      address,
      saler_phone_number,
      saler_full_name,
      price,
      category_title,
      province_city_title,
      district_title,
      street_title,
      ward_title,
      type,
      duplicate,
      next_status,
      previous_status,
      is_internal,
      creator_id,
      branch_id,
      broker_phone_number,
      broker_full_name,
    } = mainData;
    try {
      const thisRealEstateService = this;
      const {permissionInfo, full_name, user_id} = userInfo;
      const {status: status_check_real_estate, is_editable} =
        await this.checkCurrentStatusRealEstateBeforeAction(
          real_estate_id,
          permissionInfo,
          user_id,
        );

      if (status_check_real_estate === 'valid' && is_editable) {
        let {real_estate_status_id} = mainData;
        let full_address_update_history = `${address}, ${street_title}, ${ward_title}, ${district_title}, ${province_city_title}`;

        let full_address = `${address} ${street_title} ${ward_title} ${district_title} ${province_city_title}`;
        if (duplicate) {
          real_estate_status_id = null;
        }

        const isValidRealEstateId =
          await thisRealEstateService.checkIsValidRealEstateToUpdate(
            real_estate_id,
            type,
          );
        if (isValidRealEstateId) {
          let insertedRealEstateHistoryId;
          await knexPg.transaction(async (trx) => {
            const checkExistSale =
              await customerService.insertCustomerWhenNotExist(trx, {
                full_name: saler_full_name,
                phone_number: saler_phone_number,
                creator_id: creator_id,
                branch_id: branch_id,
                type: CUSTOMER_TYPE_ENUM.SELL,
              });

            const checkExistBroker =
              await brokerService.insertBrokerWhenNotExist(trx, {
                full_name: broker_full_name,
                phone_number: broker_phone_number,
                branch_id: branch_id,
                creator_id: creator_id,
              });

            const detailBeforeUpdate = await this.getRealEstateById(
              real_estate_id,
            );
            const detailDataBefore = detailBeforeUpdate?.detail;
            await realEstateHistoricalService.insertHistorical(
              trx,
              detailBeforeUpdate,
              creator_id,
            );

            if (
              next_status &&
              previous_status &&
              next_status !== previous_status
            ) {
              const created_at_new = new Date();
              insertedRealEstateHistoryId = await thisRealEstateService
                .insertRealEstateHistoryChangeStatus({
                  real_estate_id: real_estate_id,
                  created_at: created_at_new?.toISOString(),
                  previous_real_estate_status: previous_status,
                  next_real_estate_status: _.isEmpty(next_status)
                    ? null
                    : next_status,
                  creator_full_name: full_name,
                  price: price,
                  real_estate_type: type,
                  full_address: full_address_update_history,
                  category_title: category_title,
                  is_internal: is_internal || false,
                  status: Constants.STATUS_ENUM.ACTIVE,
                  branch_id: branch_id,
                  note_change:
                    _.isEmpty(next_status) &&
                    Constants.LABEL_NOTE_REAL_ESTATE_DUPLICATE,
                })
                .catch(async (err) => {
                  // Rollback detail (PG): restore previous snapshot. Trx rollback dọn history.
                  console.error('insertRealEstateHistoryChangeStatus failed:', err);
                  if (detailDataBefore) {
                    await realEstateDetailsRepo.updateByRealEstateId(
                      real_estate_id,
                      detailDataBefore,
                      trx,
                    );
                  }
                });
            }

            await thisRealEstateService.updateDetailRealEstate(
              detailData,
              real_estate_id,
            );
            await thisRealEstateService
              .updateMainDataRealEstate(
                trx,
                {
                  ...mainData,
                  full_address: full_address,
                  real_estate_status_id: real_estate_status_id || null,
                  sale_id: checkExistSale?.customer_id,
                  saler_phone_id: checkExistSale?.customer_phone_id,
                  broker_phone_id: checkExistBroker?.broker_phone_id,
                  broker_id: checkExistBroker?.broker_id,
                },
                real_estate_id,
              )
              .then(async () => {
                await trx.commit();
              })
              .catch(async (err) => {
                console.error('updateMainDataRealEstate failed, rollback trx:', err);
                // PG trx.rollback() đã dọn history + detail trong cùng transaction.
                // Vẫn gọi rollback explicit (callsite cũ giữ).
                if (insertedRealEstateHistoryId) {
                  await realEstateHistoryRepo.deleteOneById(
                    insertedRealEstateHistoryId,
                    trx,
                  );
                }
                await thisRealEstateService.rollbackUpdateDetailRealEstate(
                  detailBeforeUpdate,
                  real_estate_id,
                  trx,
                );
                await trx.rollback();
              });
          });
        }
        return 'success';
      } else {
        return status_check_real_estate;
      }
    } catch (error) {
      console.log('Update real estate error:', error);
    }
  };

  checkIsValidRealEstateToUpdate = async (real_estate_id, type) => {
    try {
      const response = await knexPg('real_estate')
        .select('id')
        .where('id', real_estate_id)
        .where('status', Constants.STATUS_ENUM.ACTIVE)
        .where('type', type)
        .first();
      return response?.id;
    } catch (error) {
      console.log('Check is valid real estate to update error:', error);
    }
  };

  updateDetailRealEstate = async (detailData, real_estate_id, trx) => {
    try {
      await realEstateDetailsRepo.updateByRealEstateId(
        real_estate_id,
        detailData,
        trx,
      );
    } catch (error) {
      console.log('Update detail real estate error:', error);
    }
  };

  updateMainDataRealEstate = async (trx, mainData, real_estate_id) => {
    const {
      address,
      agency,
      goodwill,
      brokerage_fees,
      price,
      category_id,
      real_estate_status_id,
      sale_id,
      saler_phone_id,
      broker_phone_id,
      broker_id,
      province_city_id,
      district_id,
      street_id,
      ward_id,
      type,
      location,
      parent_real_estate_id,
      full_address,
      is_internal,
      direction,
    } = mainData;
    try {
      await knexPg('real_estate')
        .where('id', real_estate_id)
        .update({
          address,
          agency,
          goodwill,
          brokerage_fees,
          price,
          category_id,
          real_estate_status_id,
          sale_id,
          saler_phone_id,
          broker_phone_id,
          broker_id,
          province_city_id,
          district_id,
          street_id,
          ward_id,
          type,
          location,
          direction,
          parent_real_estate_id,
          full_address: full_address,
          is_internal,
        })
        .transacting(trx);
    } catch (error) {
      console.log('Update main data error', error);
    }
  };

  insertRealEstateHistoryChangeStatus = async (dataInsert, trx) => {
    try {
      return await realEstateHistoryRepo.insertHistory(dataInsert, trx);
    } catch (error) {
      console.log('Insert real estate history error');
    }
  };

  getCreatorIdRealEstateById = async (real_estate_id) => {
    const response = await knexPg('real_estate')
      .select('id', 'creator_sale_id')
      .where('status', Constants.STATUS_ENUM.ACTIVE)
      .where('id', real_estate_id)
      .first();
    return response?.creator_sale_id;
  };

  checkCurrentStatusRealEstateBeforeAction = async (
    real_estate_id,
    permissionInfo,
    creator_id,
  ) => {
    let status = 'valid';
    let isEditRealEstate = false;
    const isDeletedRealEstate = await this.checkIsDeletedRealEstate(
      real_estate_id,
    );

    if (!isDeletedRealEstate) {
      if (creator_id && permissionInfo) {
        isEditRealEstate = await this.checkIsEditRealEstate(
          creator_id,
          real_estate_id,
          permissionInfo,
        ).then((response) => {
          status = response ? status : 'forbidden';
          return response;
        });
      } else {
        isEditRealEstate = true;
      }

      const isDuplicateRealEstate = await this.checkIsDuplicateRealEstate(
        real_estate_id,
      ).then((response) => {
        status = response ? 'duplicate' : status;
        return response;
      });

      isEditRealEstate = isEditRealEstate && !isDuplicateRealEstate;
    } else {
      status = 'delete';
    }

    return {status: status, is_editable: isEditRealEstate};
  };

  rollbackUpdateDetailRealEstate = async (beforeData, real_estate_id, trx) => {
    try {
      if (!beforeData) return;
      await realEstateDetailsRepo.updateByRealEstateId(
        real_estate_id,
        beforeData,
        trx,
      );
    } catch (error) {
      console.log('roll back update detail real estate', error);
    }
  };

  checkIsEditRealEstate = async (
    creator_id,
    real_estate_id,
    permissionInfo,
  ) => {
    try {
      if (permissionInfo) {
        const response = await knexPg('real_estate')
          .select('id')
          .where(function (whereQuery) {
            whereQuery
              .where('status', Constants.STATUS_ENUM.ACTIVE)
              .where('id', real_estate_id)
              .where('creator_sale_id', creator_id);
          })
          .first();

        if (!response) {
          return false;
        }
        return true;
      }
      return true;
    } catch (error) {
      console.log(error);
    }
  };

  checkIsDuplicateRealEstate = async (real_estate_id) => {
    try {
      if (real_estate_id) {
        const response = await knexPg('real_estate')
          .select('id')
          .where(function (whereQuery) {
            whereQuery
              .where('status', Constants.STATUS_ENUM.ACTIVE)
              .where('id', real_estate_id)
              .where('real_estate_status_id', null);
          })
          .first();
        if (!response) {
          return false;
        }
        return true;
      }
      return true;
    } catch (error) {
      console.log(error);
    }
  };

  checkIsDeletedRealEstate = async (real_estate_id) => {
    try {
      if (real_estate_id) {
        const response = await knexPg('real_estate')
          .select('id')
          .where(function (whereQuery) {
            whereQuery
              .where('status', Constants.STATUS_ENUM.DELETED)
              .where('id', real_estate_id);
          })
          .first();
        if (!response) {
          return false;
        }
        return true;
      }
      return true;
    } catch (error) {
      console.log(error);
    }
  };

  getRealEstateById = async (id) => {
    let response = await knexPg({re: 'real_estate'})
      .column([
        {
          id: 're.id',
          address: 're.address',
          type: 're.type',
          category_title: 'rec.title',
          real_estate_status: 'res.title',
          real_estate_status_color: 'res.color',
          real_estate_status_editable: 'res.is_editable_re',
          real_estate_status_show_internal: 'res.is_show_internal',
          province_city: 'pct.title',
          district: 'dt.title',
          ward: 'wt.title',
          street: 'strt.title',
          price: 're.price',
          broker_full_name: 'brokers.full_name',
          broker_phone_number: 'broker_phones.phone_number',
          creator: 'u.full_name',
          creator_phone: 'u.raw_phone_number',
          creator_id: 're.creator_sale_id',
          created_date: 're.created_at',
          modified_date: 're.modification_at',
          status: 're.status',
          goodwill: 're.goodwill',
          is_subscribe: knexPg.raw('re_sub.sale_id IS NOT NULL'),
          code: 're.code',
          province_city_id: 're.province_city_id',
          district_id: 're.district_id',
          ward_id: 're.ward_id',
          street_id: 're.street_id',
          category_id: 're.category_id',
          location: ' re.location',
          direction: ' re.direction',
          real_estate_category_title: 'rec.title',
          real_estate_status_id: 're.real_estate_status_id',
          sale_id: 're.sale_id',
          saler_phone_number: 'c_phones.phone_number',
          brokerage_fees: 're.brokerage_fees',
          agency: 're.agency',
          saler_full_name: 'c.full_name',
          parent_code: 're_parent.code',
          parent_real_estate_id: 're.parent_real_estate_id',
          children_real_estate_id: 're_children.id',
          children_code: 're_children.code',
          is_internal: 're.is_internal',
        },
      ])
      .where('re.status', Constants.STATUS_ENUM.ACTIVE)
      .where('re.id', id)
      .leftJoin({rec: 'real_estate_category'}, (builder) => {
        builder.on('rec.id', '=', 're.category_id');
      })
      .leftJoin({res: 'real_estate_status'}, (builder) => {
        builder
          .on('res.id', '=', 're.real_estate_status_id')
          .onIn('res.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .leftJoin({pc: 'province_city'}, (builder) => {
        builder.on('pc.id', '=', 're.province_city_id');
      })
      .leftJoin({pct: 'province_city_translation'}, (builder) => {
        builder.on('pc.id', '=', 'pct.province_city_id');
      })
      .leftJoin({d: 'districts'}, (builder) => {
        builder.on('d.id', '=', 're.district_id');
      })
      .leftJoin({dt: 'districts_translation'}, (builder) => {
        builder.on('d.id', '=', 'dt.district_id');
      })
      .leftJoin({w: 'wards'}, (builder) => {
        builder.on('w.id', '=', 're.ward_id');
      })
      .leftJoin({wt: 'wards_translation'}, (builder) => {
        builder.on('w.id', '=', 'wt.ward_id');
      })
      .leftJoin({str: 'streets'}, (builder) => {
        builder.on('str.id', '=', 're.street_id');
      })
      .leftJoin({strt: 'streets_translation'}, (builder) => {
        builder.on('str.id', '=', 'strt.street_id');
      })
      .leftJoin({u: 'users'}, (builder) => {
        builder.on('u.id', '=', 're.creator_sale_id');
      })
      .leftJoin({c: 'customers'}, (builder) => {
        builder
          .on('c.id', '=', 're.sale_id')
          .onIn('c.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .leftJoin({c_phones: 'customer_phones'}, (builder) => {
        builder
          .on('c_phones.id', '=', 're.saler_phone_id')
          .onIn('c_phones.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .leftJoin({brokers: 'brokers'}, (builder) => {
        builder
          .on('brokers.id', '=', 're.broker_id')
          .onIn('brokers.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .leftJoin({broker_phones: 'broker_phones'}, (builder) => {
        builder
          .on('broker_phones.id', '=', 're.broker_phone_id')
          .onIn('broker_phones.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .leftJoin({re_sub: 'real_estate_subscribe'}, (builder) => {
        builder.on('re.id', '=', 're_sub.real_estate_id');
      })
      .leftJoin({re_parent: 'real_estate'}, (builder) => {
        builder
          .on('re_parent.id', '=', 're.parent_real_estate_id')
          .onIn('re_parent.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .leftJoin({re_children: 'real_estate'}, (builder) => {
        builder
          .on('re_children.parent_real_estate_id', '=', 're.id')
          .onIn('re_children.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .first()
      .catch(function (error) {
        return false;
      });

    if (!response) {
      return false;
    }

    const responseDetail = await realEstateDetailsRepo.findByRealEstateId(id);
    if (!response) {
      return false;
    }

    response.detail = responseDetail;

    return {
      ...response,
      district_id: {
        value: response?.district_id,
        label: response?.district,
        key: response?.district_id,
      },
      province_city_id: {
        value: response?.province_city_id,
        label: response?.province_city,
        key: response?.province_city_id,
      },
      ward_id: {
        value: response?.ward_id,
        label: response?.ward,
        key: response?.ward_id,
      },
      street_id: {
        value: response?.street_id,
        label: response?.street,
        key: response?.street_id,
        title: response?.street,
      },
      category_id: {
        value: response?.category_id,
        key: response?.category_id,
        label: response?.category_title,
      },
    };
  };

  subscribeRealEstate = async (data, isSubscribe = true) => {
    const {realEstate, saleId} = data;
    try {
      if (isSubscribe) {
        const insertSubscribe = await knexPg('real_estate_subscribe').insert({
          real_estate_id: realEstate,
          sale_id: saleId,
        });

        if (_.isUndefined(insertSubscribe)) {
          return {status: false, result: ''};
        }
        return insertSubscribe;
      } else {
        const deleteSubscribe = await knexPg('real_estate_subscribe')
          .where({
            real_estate_id: realEstate,
            sale_id: saleId,
          })
          .del();
        if (_.isUndefined(deleteSubscribe)) {
          return false;
        }
        return deleteSubscribe;
      }
    } catch (e) {
      console.error(e.message);
      return false;
    }
  };

  getHistoryRealEstateStatus = async (id) => {
    try {
      const response = await realEstateHistoryRepo.aggregateHistoryByRealEstateId(
        id,
      );
      if (!response) {
        return false;
      }
      return response;
    } catch (error) {
      console.log(error);
    }
  };

  getStreetExist = async (id) => {
    const response = await knexPg('real_estate')
      .select('street_id')
      .groupBy('street_id');
    if (!response) {
      return false;
    }
    return response;
  };

  updateHistoryCloneRealEstate = async (
    id,
    {realEstateStatus, full_name, note, branch_id},
    trx,
  ) => {
    const created_at_new = new Date();
    const inserted = await realEstateHistoryRepo.insertHistory(
      {
        real_estate_id: id,
        created_at: created_at_new,
        previous_real_estate_status: realEstateStatus,
        creator_full_name: full_name,
        note_change: note,
        branch_id,
      },
      trx,
    );
    return inserted || false;
  };

  baseQueryRealEstateReport = (params) => {
    const {
      type,
      price_from = 0,
      price_to,
      district_ids,
      province_city_ids,
      real_estate_status_ids,
      end_day,
      start_day,
      ward_ids,
      branch_id,
    } = params;
    let baseQuery = knexPg
      .from({re: 'real_estate'})
      .where('re.status', Constants.STATUS_ENUM.ACTIVE)
      .whereNot('re.real_estate_status_id', null)
      .leftJoin({reb: 'real_estate_branch'}, (builder) => {
        builder.on('re.id', '=', 'reb.real_estate_id');
      })
      .leftJoin({rec: 'real_estate_category'}, (builder) => {
        builder
          .on('rec.id', '=', 're.category_id')
          .onIn('rec.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .leftJoin({pc: 'province_city'}, (builder) => {
        builder
          .on('pc.id', '=', 're.province_city_id')
          .onIn('pc.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .leftJoin({pct: 'province_city_translation'}, (builder) => {
        builder
          .on('pc.id', '=', 'pct.province_city_id')
          .onIn('pct.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .leftJoin({d: 'districts'}, (builder) => {
        builder
          .on('d.id', '=', 're.district_id')
          .onIn('d.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .leftJoin({dt: 'districts_translation'}, (builder) => {
        builder
          .on('d.id', '=', 'dt.district_id')
          .onIn('dt.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .leftJoin({w: 'wards'}, (builder) => {
        builder
          .on('w.id', '=', 're.ward_id')
          .onIn('w.status', [Constants.STATUS_ENUM.ACTIVE]);
      })
      .leftJoin({wt: 'wards_translation'}, (builder) => {
        builder
          .on('w.id', '=', 'wt.ward_id')
          .onIn('wt.status', [Constants.STATUS_ENUM.ACTIVE]);
      });
    baseQuery = Common.buildWhereQuery(baseQuery, 're', {
      ward_id: ward_ids,
      district_id: district_ids,
      province_city_id: province_city_ids,
      real_estate_status_id: real_estate_status_ids,
    });

    if (start_day && end_day) {
      const {f_start_day, f_end_day} = Common.convertDateToLocalTimeIOSString(
        start_day,
        end_day,
      );

      baseQuery = baseQuery
        .where(knexPg.raw('?? >= ?', ['re.created_at', f_start_day]))
        .where(knexPg.raw('?? < ?', ['re.created_at', f_end_day]));
    }
    if (price_to) {
      baseQuery = baseQuery.where('re.price', '<=', price_to);
    }
    if (type) {
      baseQuery = baseQuery.where('re.type', type);
    }
    if (branch_id) {
      baseQuery = baseQuery.where('reb.branch_id', branch_id);
    }

    baseQuery = baseQuery.where('re.price', '>=', price_from);
    return baseQuery;
  };
  getListRealEstateReport = async (params) => {
    const {
      type,
      price_from = 0,
      price_to,
      district_ids,
      province_city_ids,
      ward_ids,
      start_day,
      end_day,
      branch_id,
      offset,
      limit,
      sorter,
      real_estate_status_ids,
    } = params;
    console.info('list', performance.now());

    let baseQuery = this.baseQueryRealEstateReport({
      type,
      price_from,
      price_to,
      district_ids,
      province_city_ids,
      real_estate_status_ids,
      ward_ids,
      start_day,
      branch_id,
      end_day,
    });

    baseQuery = baseQuery
      .select(
        're.created_at',
        're.price',
        'rec.title as category_title',
        'pct.title as province_city_title',
        'dt.title as district_title',
        'wt.title as ward_title',
        're.address',
      )
      .groupBy(
        're.id',
        'pct.title',
        'wt.title',
        'dt.title',
        'rec.title',
        're.address',
      );
    if (sorter && !_.isEmpty(sorter)) {
      let sort_key;
      let sort_value;
      _.each(sorter, (value, key) => {
        sort_key = `re.${key}`;
        sort_value = value?.replace('end', '');
      });

      baseQuery =
        sort_key && sort_value && baseQuery.orderBy(sort_key, sort_value);
    } else {
      baseQuery = baseQuery.orderBy('re.created_at', 'desc');
    }
    const response = await baseQuery.clone().offset(offset).limit(limit);
    const count = await baseQuery.clone();
    if (!response) {
      return false;
    }
    console.info('list', performance.now());

    return {data: response, count: count.length};
  };
  getListRealEstateDataReport = async (params) => {
    const {
      type,
      province_city_ids,
      district_ids,
      ward_ids,
      price_from,
      price_to,
      start_day,
      end_day,
      category_id,
      type_chart,
      branch_id,
      real_estate_status_ids,
    } = params;

    let baseQuery = knexPg
      .from({re: 'real_estate'})
      .leftJoin({reb: 'real_estate_branch'}, (builder) => {
        builder.on('re.id', '=', 'reb.real_estate_id');
      })
      .where('re.status', Constants.STATUS_ENUM.ACTIVE)
      .whereNot('re.real_estate_status_id', null);

    baseQuery = Common.buildWhereQuery(baseQuery, 're', {
      ward_id: ward_ids,
      district_id: district_ids,
      province_city_id: province_city_ids,
      real_estate_status_id: real_estate_status_ids,
    });
    if (price_from) {
      baseQuery = baseQuery.where('re.price', '>=', price_from);
    }

    if (price_to) {
      baseQuery = baseQuery.where('re.price', '<=', price_to);
    }

    if (type) {
      baseQuery = baseQuery.where('re.type', type);
    }

    if (start_day && end_day) {
      const {f_start_day, f_end_day} = Common.convertDateToLocalTimeIOSString(
        start_day,
        end_day,
      );

      baseQuery = baseQuery
        .where(knexPg.raw('?? >= ?', ['re.created_at', f_start_day]))
        .where(knexPg.raw('?? < ?', ['re.created_at', f_end_day]));
    }
    if (branch_id) {
      baseQuery = baseQuery.where('reb.branch_id', branch_id);
    }
    let response;
    let total;
    console.info(performance.now());
    if (category_id && type_chart === 'pie') {
      switch (category_id) {
        case 'category':
          total = await baseQuery
            .clone()
            .whereNot('re.category_id', null)
            .whereNot('re.category_id', null)
            .whereNot('rec.id', null)
            .leftJoin({rec: 'real_estate_category'}, (builder) => {
              builder
                .on('rec.id', '=', 're.category_id')
                .onIn('rec.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .select(knexPg.raw('count (re.category_id) as total'))
            .first();

          response = await baseQuery
            .clone()
            .whereNot('re.category_id', null)
            .whereNot('rec.id', null)
            .leftJoin({rec: 'real_estate_category'}, (builder) => {
              builder
                .on('rec.id', '=', 're.category_id')
                .onIn('rec.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .select(
              knexPg.raw(
                `round(cast(((count (re.category_id))/${total?.total}::float) * 100 as numeric), 2) as scales`,
              ),
              'rec.title as title',
            )
            .groupBy('re.category_id', 'rec.title');
          break;
        case 'province':
          total = await baseQuery
            .clone()
            .whereNot('re.province_city_id', null)
            .select(knexPg.raw('count (re.province_city_id) as total'))
            .first();
          response = await baseQuery
            .clone()
            .whereNot('re.province_city_id', null)
            .select(
              knexPg.raw(
                `round(cast(((count (re.province_city_id))/${total?.total}::float) * 100 as numeric), 2) as scales`,
              ),
              'pct.title as title',
            )
            .leftJoin({pc: 'province_city'}, (builder) => {
              builder
                .on('pc.id', '=', 're.province_city_id')
                .onIn('pc.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .leftJoin({pct: 'province_city_translation'}, (builder) => {
              builder
                .on('pc.id', '=', 'pct.province_city_id')
                .onIn('pct.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .groupBy('re.province_city_id', 'pct.title');
          break;
        case 'district':
          total = await baseQuery
            .clone()
            .whereNot('re.district_id', null)
            .select(knexPg.raw('count (re.district_id) as total'))
            .first();
          response = await baseQuery
            .clone()
            .whereNot('re.district_id', null)
            .select(
              knexPg.raw(
                `round(cast(((count (re.district_id))/${total?.total}::float) * 100 as numeric), 2) as scales`,
              ),
              knexPg.raw(`CONCAT(dt.title ,' ,', pct.title) as title`),
            )
            .leftJoin({d: 'districts'}, (builder) => {
              builder
                .on('d.id', '=', 're.district_id')
                .onIn('d.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .leftJoin({dt: 'districts_translation'}, (builder) => {
              builder
                .on('d.id', '=', 'dt.district_id')
                .onIn('dt.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .leftJoin({pc: 'province_city'}, (builder) => {
              builder
                .on('pc.id', '=', 're.province_city_id')
                .onIn('pc.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .leftJoin({pct: 'province_city_translation'}, (builder) => {
              builder
                .on('pc.id', '=', 'pct.province_city_id')
                .onIn('pct.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .groupBy('re.district_id', 'dt.title', 'pct.title');
          break;
        case 'ward':
          total = await baseQuery
            .clone()
            .whereNot('re.ward_id', null)
            .select(knexPg.raw('count (re.ward_id) as total'))
            .first();
          response = await baseQuery
            .clone()
            .whereNot('re.ward_id', null)
            .select(
              knexPg.raw(
                `round(cast(((count (re.district_id))/${total?.total}::float) * 100 as numeric), 2) as scales`,
              ),
              knexPg.raw(`CONCAT(wt.title ,' ,', dt.title) as title`),
            )
            .leftJoin({w: 'wards'}, (builder) => {
              builder
                .on('w.id', '=', 're.ward_id')
                .onIn('w.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .leftJoin({wt: 'wards_translation'}, (builder) => {
              builder
                .on('w.id', '=', 'wt.ward_id')
                .onIn('wt.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .leftJoin({d: 'districts'}, (builder) => {
              builder
                .on('d.id', '=', 're.district_id')
                .onIn('d.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .leftJoin({dt: 'districts_translation'}, (builder) => {
              builder
                .on('d.id', '=', 'dt.district_id')
                .onIn('dt.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .groupBy('re.ward_id', 'wt.title', 'dt.title');
          break;
        case 'price':
          total = await baseQuery
            .clone()
            .whereNot('re.id', null)
            .select(knexPg.raw('count (re.id) as total'))
            .first();
          response = await baseQuery
            .clone()
            .whereNot('re.id', null)
            .select(
              knexPg.raw(
                `round(cast((count(re.price) filter (where re.price >= '${Constants.GROUP_PRICE.p1_10.price_from}' and re.price <= '${Constants.GROUP_PRICE.p1_10.price_to}')/${total?.total}::float)*100 as numeric), 2)  as ${Constants.GROUP_PRICE.p1_10.label} `,
              ),
              knexPg.raw(
                `round(cast((count(re.price) filter (where re.price > '${Constants.GROUP_PRICE.p10_15.price_from}' and re.price <= '${Constants.GROUP_PRICE.p10_15.price_to}')/${total?.total}::float)*100 as numeric), 2)  as ${Constants.GROUP_PRICE.p10_15.label} `,
              ),
              knexPg.raw(
                `round(cast((count(re.price) filter (where re.price > '${Constants.GROUP_PRICE.p15_20.price_from}' and re.price <= '${Constants.GROUP_PRICE.p15_20.price_to}')/${total?.total}::float)*100 as numeric), 2)  as ${Constants.GROUP_PRICE.p15_20.label} `,
              ),
              knexPg.raw(
                `round(cast((count(re.price) filter (where re.price > '${Constants.GROUP_PRICE.p20_50.price_from}' and re.price <= '${Constants.GROUP_PRICE.p20_50.price_to}')/${total?.total}::float)*100 as numeric), 2)  as ${Constants.GROUP_PRICE.p20_50.label} `,
              ),
              knexPg.raw(
                `round(cast((count(re.price) filter (where re.price > '${Constants.GROUP_PRICE.p50.price_from}')/${total?.total}::float)*100 as numeric), 2)  as ${Constants.GROUP_PRICE.p50.label} `,
              ),
            )
            .first();
          break;
        default:
          break;
      }
    } else if (category_id && type_chart === 'column') {
      switch (category_id) {
        case 'category':
          response = await baseQuery
            .clone()
            .whereNot('rec.id', null)
            .whereNot('re.category_id', null)
            .select(
              knexPg.raw('count(re.category_id) as value'),
              knexPg.raw(
                "to_char(date(re.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY') as month",
              ),
              'rec.title as title',
            )
            .leftJoin({rec: 'real_estate_category'}, (builder) => {
              builder
                .on('rec.id', '=', 're.category_id')
                .onIn('rec.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .groupBy(
              're.category_id',
              'rec.title',
              knexPg.raw(
                "to_char(date(re.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY')",
              ),
            );
          break;
        case 'province':
          response = await baseQuery
            .clone()
            .whereNot('re.province_city_id', null)
            .select(
              knexPg.raw('count(re.province_city_id) as value'),
              knexPg.raw(
                "to_char(date(re.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY') as month",
              ),
              'pct.title as title',
            )
            .leftJoin({pc: 'province_city'}, (builder) => {
              builder
                .on('pc.id', '=', 're.province_city_id')
                .onIn('pc.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .leftJoin({pct: 'province_city_translation'}, (builder) => {
              builder
                .on('pc.id', '=', 'pct.province_city_id')
                .onIn('pct.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .groupBy(
              're.province_city_id',
              'pct.title',
              knexPg.raw(
                "to_char(date(re.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY')",
              ),
            );
          break;
        case 'district':
          response = await baseQuery
            .clone()
            .whereNot('re.district_id', null)
            .select(
              knexPg.raw('count(re.district_id) as value'),
              knexPg.raw(
                "to_char(date(re.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY') as month",
              ),
              'dt.title as title',
            )
            .leftJoin({d: 'districts'}, (builder) => {
              builder
                .on('d.id', '=', 're.district_id')
                .onIn('d.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .leftJoin({dt: 'districts_translation'}, (builder) => {
              builder
                .on('d.id', '=', 'dt.district_id')
                .onIn('dt.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .groupBy(
              're.district_id',
              'dt.title',
              knexPg.raw(
                "to_char(date(re.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY')",
              ),
            );
          break;
        case 'ward':
          response = await baseQuery
            .clone()
            .whereNot('re.ward_id', null)
            .select(
              knexPg.raw('count(re.ward_id) as value'),
              knexPg.raw(
                "to_char(date(re.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY') as month",
              ),
              'wt.title as title',
            )
            .leftJoin({w: 'wards'}, (builder) => {
              builder
                .on('w.id', '=', 're.ward_id')
                .onIn('w.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .leftJoin({wt: 'wards_translation'}, (builder) => {
              builder
                .on('w.id', '=', 'wt.ward_id')
                .onIn('wt.status', [Constants.STATUS_ENUM.ACTIVE]);
            })
            .groupBy(
              're.ward_id',
              'wt.title',
              knexPg.raw(
                "to_char(date(re.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY')",
              ),
            );
          break;
        case 'price':
          const response1To10PriceChartData = await baseQuery
            .clone()
            .whereNot('re.id', null)
            .select(
              knexPg.raw(
                `count(re.price) filter (where re.price >= '${Constants.GROUP_PRICE.p1_10.price_from}' and re.price <= '${Constants.GROUP_PRICE.p1_10.price_to}')  as ${Constants.GROUP_PRICE.p1_10.label} `,
              ),
              knexPg.raw(
                "to_char(date(re.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY') as month",
              ),
            )
            .groupBy(
              knexPg.raw(
                "to_char(date(re.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY')",
              ),
            );
          const response10To15PriceChartData = await baseQuery
            .clone()
            .whereNot('re.id', null)
            .select(
              knexPg.raw(
                `count(re.price) filter (where re.price > '${Constants.GROUP_PRICE.p10_15.price_from}' and re.price <= '${Constants.GROUP_PRICE.p10_15.price_to}')  as ${Constants.GROUP_PRICE.p10_15.label} `,
              ),

              knexPg.raw(
                "to_char(date(re.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY') as month",
              ),
            )
            .groupBy(
              knexPg.raw(
                "to_char(date(re.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY')",
              ),
            );
          const response15To20PriceChartData = await baseQuery
            .clone()
            .whereNot('re.id', null)
            .select(
              knexPg.raw(
                `count(re.price) filter (where re.price > '${Constants.GROUP_PRICE.p15_20.price_from}' and re.price <= '${Constants.GROUP_PRICE.p15_20.price_to}')  as ${Constants.GROUP_PRICE.p15_20.label} `,
              ),
              knexPg.raw(
                "to_char(date(re.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY') as month",
              ),
            )
            .groupBy(
              knexPg.raw(
                "to_char(date(re.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY')",
              ),
            );
          const response20To50PriceChartData = await baseQuery
            .clone()
            .whereNot('re.id', null)
            .select(
              knexPg.raw(
                `count(re.price) filter (where re.price > '${Constants.GROUP_PRICE.p20_50.price_from}' and re.price <= '${Constants.GROUP_PRICE.p20_50.price_to}')  as ${Constants.GROUP_PRICE.p20_50.label} `,
              ),
              knexPg.raw(
                "to_char(date(re.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY') as month",
              ),
            )
            .groupBy(
              knexPg.raw(
                "to_char(date(re.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY')",
              ),
            );
          const responseGreater50PriceChartData = await baseQuery
            .clone()
            .whereNot('re.id', null)
            .select(
              knexPg.raw(
                `count(re.price) filter (where re.price > '${Constants.GROUP_PRICE.p50.price_from}')  as ${Constants.GROUP_PRICE.p50.label} `,
              ),
              knexPg.raw(
                "to_char(date(re.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY') as month",
              ),
            )
            .groupBy(
              knexPg.raw(
                "to_char(date(re.created_at at time zone 'Asia/Ho_Chi_Minh'),'MM-YYYY')",
              ),
            );
          response = [
            ...response1To10PriceChartData,
            ...response10To15PriceChartData,
            ...response15To20PriceChartData,
            ...response20To50PriceChartData,
            ...responseGreater50PriceChartData,
          ];
          break;
        default:
          break;
      }
    }
    console.info(performance.now());
    if (!response) {
      return false;
    }
    return {data: response};
  };

  baseQueryChangeStatusRealEstateReport = (params) => {
    const {
      type,
      end_day,
      start_day,
      to_price,
      from_price,
      is_internal,
      branch_id,
    } = params;

    let baseQuery = {
      status: Constants.STATUS_ENUM.ACTIVE,
    };
    if (type) {
      baseQuery = {...baseQuery, real_estate_type: {$eq: type}};
    }

    if (branch_id) {
      baseQuery = {...baseQuery, branch_id: {$eq: branch_id}};
    }

    if (end_day && start_day) {
      const {f_start_day, f_end_day} = Common.convertDateToLocalTime(
        start_day,
        end_day,
      );

      baseQuery = {
        ...baseQuery,
        convertedDate: {
          $gte: f_start_day,
          $lt: f_end_day,
        },
      };
    }

    if (to_price) {
      baseQuery = {
        ...baseQuery,
        price: {$lte: to_price, $gte: from_price || 0, $ne: null},
      };
    } else {
      baseQuery = {
        ...baseQuery,
        price: {$gte: from_price || 0, $ne: null},
      };
    }

    if (is_internal === false || is_internal === true) {
      switch (is_internal) {
        case true:
          baseQuery = {
            ...baseQuery,
            is_internal: true,
          };
          break;
        case false:
          baseQuery = {
            ...baseQuery,
            $or: [{is_internal: false}, {is_internal: null}],
          };
      }
    }
    return baseQuery;
  };
  getChangeStatusRealEstateReportChartData = async (params) => {
    const {
      type,
      end_day,
      start_day,
      to_price,
      from_price,
      is_internal,
      branch_id,
    } = params;

    // Delegate sang repo: SQL CTE thay aggregate pipeline.
    const result = await realEstateHistoryRepo.reportChartData({
      real_estate_type: type,
      start_day,
      end_day,
      price_from: from_price,
      price_to: to_price,
      is_internal,
      branch_id,
    });

    if (!result) {
      return false;
    }
    // Backward-compat: result đã đúng shape [{month, value, id | title}].
    return result;
  };
  getChangeStatusRealEstateReportList = async (params) => {
    const {
      type,
      end_day,
      start_day,
      to_price,
      from_price,
      is_internal,
      branch_id,
      sorter,
      offset,
      limit,
    } = params;

    const result = await realEstateHistoryRepo.reportList(
      {
        real_estate_type: type,
        start_day,
        end_day,
        price_from: from_price,
        price_to: to_price,
        is_internal,
        branch_id,
      },
      {sorter, offset, limit},
    );
    if (!result) {
      return false;
    }
    return result; // { data_list, count }
  };

  changeStatusRealEstate = async () => {
    // Data-fix job: rows có previous_real_estate_status nhưng thiếu next_real_estate_status.
    const rows = await realEstateHistoryRepo.findRowsNeedingStatusFix();
    return Promise.all(
      rows.map((item) => {
        const newReal =
          typeof item.previous_real_estate_status === 'object'
            ? {...item.previous_real_estate_status}
            : {title: item.previous_real_estate_status};
        return realEstateHistoryRepo.updateById(item.id, {
          next_real_estate_status: {...newReal, type: 1},
          previous_real_estate_status: null,
        });
      }),
    );
  };

  getRealEstateSubscribe = async (real_estate_id, limit = 15, offset = 0) => {
    const baseQuery = knexPg('real_estate_subscribe').where(
      'real_estate_id',
      real_estate_id,
    );

    const response = await baseQuery.clone().limit(limit).offset(offset);
    const {count} = await baseQuery.clone().countDistinct('sale_id').first();
    return {
      listSubscribe: response,
      count,
    };
  };

  backupLocation = async () => {
    const locationList = await realEstateDetailsRepo.findManyWithLocation({
      skip: this.offset,
      limit: 1000,
    });

    if (locationList.length > 0) {
      await locationList.forEach(async (item) => {
        if (item?.location && item?.real_estate_id) {
          await knexPg('real_estate')
            .where('id', item.real_estate_id)
            .update({location: Number(item.location)});
        }
      });
      this.offset += 1000;
      await this.backupLocation();
    } else {
      return true;
    }

    return {count: locationList.length, list: locationList};
  };

  listInsertedIdHistoryAssignRealEstate = [];
  customerInsertedListByUserId = [];
  brokerInsertedListByUserId = [];

  assignOneRealEstateToUser = async (trx, dataItem) => {
    try {
      const {
        user_id,
        branch_id,
        real_estate_id,
        broker_phone_number,
        broker_full_name,
        saler_phone_number,
        saler_full_name,
        admin_full_name,
        real_estate_status_id,
        real_estate_status_title,
        next_saler_full_name,
      } = dataItem;
      let salerInsertData;
      let brokerInsertData;

      const is_duplicate_creator_id = await this.checkCreatorIdByUserId({
        real_estate_id: real_estate_id,
        user_id: user_id,
      });

      if (!is_duplicate_creator_id) {
        if (saler_phone_number && saler_full_name && branch_id) {
          const checkExistSale =
            await customerService.checkExistCustomerByPhone(
              {
                user_id: user_id,
                phone_number: saler_phone_number,
                branch_id: branch_id,
                type: CUSTOMER_TYPE_ENUM.SELL,
              },
              this.customerInsertedListByUserId,
            );

          if (checkExistSale?.saler_id) {
            salerInsertData = checkExistSale;
          } else {
            salerInsertData = await customerService
              .insertCustomerSellRentWhenAssignRealEstate(trx, {
                user_id: user_id,
                phone_number: saler_phone_number,
                full_name: saler_full_name,
                branch_id: branch_id,
              })
              .then((res) => {
                this.customerInsertedListByUserId.push({
                  ...res,
                  phone_number: saler_phone_number,
                  user_id: user_id,
                  branch_id: branch_id,
                });
                return res;
              });
          }
        }

        if (broker_phone_number && broker_full_name && branch_id) {
          const checkExistBroker =
            await brokerService.checkIsExistBrokerByPhoneNumber(
              {
                phone_number: broker_phone_number,
                creator_id: user_id,
                branch_id: branch_id,
              },
              this.brokerInsertedListByUserId,
            );

          if (checkExistBroker?.broker_id) {
            brokerInsertData = checkExistBroker;
          } else {
            brokerInsertData = await brokerService
              .insertBrokerWhenAssignRealEstate(trx, {
                user_id: user_id,
                phone_number: broker_phone_number,
                full_name: broker_full_name,
                branch_id: branch_id,
              })
              .then((res) => {
                this.brokerInsertedListByUserId.push({
                  ...res,
                  phone_number: broker_phone_number,
                  user_id: user_id,
                  branch_id: branch_id,
                });
                return res;
              });
          }
        }

        if (salerInsertData || brokerInsertData) {
          let response = await this.updateDataAssignToRealEstate(trx, {
            user_id: user_id,
            broker_id: brokerInsertData?.broker_id,
            broker_phone_id: brokerInsertData?.broker_phone_id,
            saler_id: salerInsertData?.saler_id,
            saler_phone_id: salerInsertData?.saler_phone_id,
            real_estate_id: real_estate_id,
          });

          if (response) {
            const detailBeforeUpdate = await this.getRealEstateById(
              real_estate_id,
            );

            await realEstateHistoricalService.insertHistorical(
              trx,
              detailBeforeUpdate,
              user_id,
            );
            if (!detailBeforeUpdate?.creator) {
              throw 'Get before creator failed';
            }

            const note_change = `Người xử lý: ${detailBeforeUpdate?.creator} -> ${next_saler_full_name}`;
            const insertedIdHistory =
              await this.insertHistoryAssignRealEstateToUser({
                real_estate_id: real_estate_id,
                admin_full_name: admin_full_name,
                real_estate_status_id: real_estate_status_id,
                real_estate_status_title: real_estate_status_title,
                note_change: note_change,
                branch_id: branch_id,
              }).then(() => {
                response = 'success';
              });
            if (insertedIdHistory) {
              this.listInsertedIdHistoryAssignRealEstate.push(
                insertedIdHistory,
              );
            }
          } else {
            throw 'Update data assign to real estate failed';
          }
          return response;
        } else {
          throw 'Missing saler info or broker info';
        }
      } else {
        return real_estate_id;
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  };
  assignMultipleRealEstateToUser = async (dataList, userInfo) => {
    let response;
    const {admin_full_name, permissionInfo} = userInfo;
    for await (const value of dataList) {
      const {status: status_check_real_estate} =
        await this.checkCurrentStatusRealEstateBeforeAction(
          value?.real_estate_id,
          permissionInfo,
        );

      if (status_check_real_estate !== 'valid') {
        return status_check_real_estate;
      }
    }
    const trx = await knexPg.transaction();
    try {
      for await (const value of dataList) {
        await this.assignOneRealEstateToUser(trx, {
          ...value,
          admin_full_name: admin_full_name,
        });
      }
      trx.commit();
      this.resetListDataToRollBackAssign();
      response = 'success';
    } catch (error) {
      console.error('assignRealEstateToUser failed, rollback trx:', error);
      // PG trx.rollback dọn history insert trong cùng transaction — không cần deleteMany.
      trx.rollback();
      this.resetListDataToRollBackAssign();
      response = 'failed';
    }
    return response;
  };
  assignSingleRealEstateToUser = async (dataItem, permissionInfo) => {
    try {
      const {real_estate_id, admin_full_name} = dataItem;

      const {status: status_check_real_estate, is_editable} =
        await this.checkCurrentStatusRealEstateBeforeAction(
          real_estate_id,
          permissionInfo,
        );

      if (status_check_real_estate === 'valid' && is_editable) {
        const trx = await knexPg.transaction();
        const response = await this.assignOneRealEstateToUser(trx, {
          ...dataItem,
          admin_full_name,
        })
          .then(() => {
            return 'success';
          })
          .catch(() => {
            return 'failed';
          });
        if (response === 'failed') {
          // PG trx.rollback dọn history insert; deleteOne cũ thừa.
          this.resetListDataToRollBackAssign();
          trx.rollback();
        } else {
          trx.commit();
          this.resetListDataToRollBackAssign();
        }
        return response;
      } else {
        return status_check_real_estate;
      }
    } catch (error) {
      console.log('Assign single real estate to user:', error);
    }
  };
  resetListDataToRollBackAssign = () => {
    this.listInsertedIdHistoryAssignRealEstate = [];
    this.customerInsertedListByUserId = [];
    this.brokerInsertedListByUserId = [];
  };

  listInsertedIdHistoryConvertRealEstateToDuplicate = [];
  convertRealEstateItemToDuplicate = async (trx, data) => {
    try {
      const {real_estate_id, admin_full_name, creator_id} = data;
      let response;
      const detailBeforeUpdate = await this.getRealEstateById(real_estate_id);
      await realEstateHistoricalService.insertHistorical(
        trx,
        detailBeforeUpdate,
        creator_id,
      );
      await knexPg('real_estate')
        .where('id', real_estate_id)
        .update({real_estate_status_id: null})
        .transacting(trx)
        .then(async () => {
          const insertedId = await realEstateHistoryRepo.insertHistory(
            {
              real_estate_id: real_estate_id,
              created_at: new Date(),
              creator_full_name: admin_full_name,
              note_change: Constants.LABEL_NOTE_REAL_ESTATE_DUPLICATE,
              status: Constants.STATUS_ENUM.ACTIVE,
            },
            trx,
          );
          if (insertedId) {
            this.listInsertedIdHistoryConvertRealEstateToDuplicate?.push(
              insertedId,
            );
            response = 'success';
          }
        })
        .catch((error) => {
          response = 'failed';
          throw error;
        });

      return response;
    } catch (error) {
      throw error;
    }
  };
  convertRealEstateListToDuplicate = async (
    realEstateList,
    userInfo,
    branch_id,
  ) => {
    try {
      let response;

      console.info(performance.now());
      const {admin_full_name, creator_id, permissionInfo} = userInfo;

      for await (const value of realEstateList) {
        const {status: status_check_real_estate} =
          await this.checkCurrentStatusRealEstateBeforeAction(
            value,
            permissionInfo,
          );
        if (status_check_real_estate !== 'valid') {
          return status_check_real_estate;
        }
      }
      try {
        const trx = await knexPg.transaction();
        for await (const value of realEstateList) {
          await this.convertRealEstateItemToDuplicate(trx, {
            real_estate_id: value,
            admin_full_name: admin_full_name,
            creator_id: creator_id,
            branch_id: branch_id,
          });
        }
        this.listInsertedIdHistoryConvertRealEstateToDuplicate = [];
        trx.commit();
        response = 'success';
      } catch (error) {
        // PG trx.rollback dọn history insert tự động — không cần deleteMany Mongo.
        console.error('convertRealEstateListToDuplicate failed:', error);
        trx.rollback();
        this.listInsertedIdHistoryConvertRealEstateToDuplicate = [];
        response = 'failed';
      }

      console.info(performance.now());
      return response;
    } catch (error) {
      console.log(error);
    }
  };
  convertSingleRealEstateToDuplicate = async (
    real_estate_id,
    userInfo,
    branch_id,
  ) => {
    try {
      const {creator_id, admin_full_name, permissionInfo} = userInfo;
      const {status: status_check_real_estate, is_editable} =
        await this.checkCurrentStatusRealEstateBeforeAction(
          real_estate_id,
          permissionInfo,
        );

      if (status_check_real_estate === 'valid' && is_editable) {
        const trx = await knexPg.transaction();
        let response = await this.convertRealEstateItemToDuplicate(trx, {
          real_estate_id,
          admin_full_name,
          creator_id,
          branch_id,
        })
          .then(() => 'success')
          .catch(() => 'failed');

        if (response === 'success') {
          trx.commit();
          this.listInsertedIdHistoryConvertRealEstateToDuplicate = [];
        } else {
          // PG trx.rollback dọn history insert tự động.
          this.listInsertedIdHistoryConvertRealEstateToDuplicate = [];
          trx.rollback();
        }
        return response;
      } else {
        return status_check_real_estate;
      }
    } catch (error) {
      console.log('Convert single real estate to duplicate:', error);
    }
  };

  listUpdatedIdDetailRealEstate = [];
  deleteRealEstateItem = async (trx, data) => {
    try {
      const {real_estate_id, creator_id} = data;
      const detailBeforeUpdate = await this.getRealEstateById(real_estate_id);
      await realEstateHistoricalService.insertHistorical(
        trx,
        detailBeforeUpdate,
        creator_id,
      );
      const response = await knexPg('real_estate')
        .where('id', real_estate_id)
        .update({status: Constants.STATUS_ENUM.DELETED})
        .transacting(trx)
        .then(async () => {
          // Soft-delete detail + tất cả history rows cùng real_estate.
          await realEstateDetailsRepo.updateByRealEstateId(
            real_estate_id,
            {status: Constants.STATUS_ENUM.DELETED},
            trx,
          );
          await (trx || knexPg)('real_estate_history')
            .where('real_estate_id', real_estate_id)
            .update({status: Constants.STATUS_ENUM.DELETED});
          return 'success';
        });
      if (response === 'success') {
        this.listUpdatedIdDetailRealEstate.push(real_estate_id);
      }

      return response;
    } catch (error) {
      console.log(error);
      throw error;
    }
  };
  deleteRealEstateList = async (realEstateList, creator_id) => {
    let response;
    try {
      for await (const value of realEstateList) {
        const isDeletedRealEstate = await this.checkIsDeletedRealEstate(value);
        if (isDeletedRealEstate) {
          return 'delete';
        }
      }
      const trx = await knexPg.transaction();
      try {
        for await (const value of realEstateList) {
          await this.deleteRealEstateItem(trx, {
            real_estate_id: value,
            creator_id: creator_id,
          });
        }
        this.listInsertedIdHistoryConvertRealEstateToDuplicate = [];
        trx.commit();
        response = 'success';
      } catch (error) {
        // PG trx.rollback hoàn nguyên status update trong cùng transaction.
        console.error('deleteRealEstateList failed:', error);
        trx.rollback();
        response = 'failed';
      }
      this.listUpdatedIdDetailRealEstate = [];
      return response;
    } catch (error) {
      console.log('Delete Real Estate List:', error);
      return 'error';
    }
  };

  deleteSingleRealEstate = async (real_estate_id, creator_id) => {
    try {
      const isDeletedRealEstate = await this.checkIsDeletedRealEstate(
        real_estate_id,
      );
      if (isDeletedRealEstate) {
        return 'delete';
      }

      const trx = await knexPg.transaction();

      const response = await this.deleteRealEstateItem(trx, {
        real_estate_id,
        creator_id,
      })
        .then(() => 'success')
        .catch(() => 'failed');

      if (response === 'success') {
        this.listInsertedIdHistoryConvertRealEstateToDuplicate = [];
        trx.commit();
      } else {
        // PG trx.rollback dọn history insert.
        trx.rollback();
        this.listInsertedIdHistoryConvertRealEstateToDuplicate = [];
      }
      return response;
    } catch (error) {
      console.log('Delete single real estate:', error);
    }
  };

  insertHistoryAssignRealEstateToUser = async (dataInsert) => {
    try {
      const {
        real_estate_id,
        admin_full_name,
        real_estate_status_id,
        real_estate_status_title,
        note_change,
        branch_id,
      } = dataInsert;

      const inserted = await realEstateHistoryRepo
        .insertHistory({
          real_estate_id,
          created_at: new Date(),
          next_real_estate_status: {
            id: real_estate_status_id,
            title: real_estate_status_title,
          },
          creator_full_name: admin_full_name,
          note_change,
          status: Constants.STATUS_ENUM.ACTIVE,
          branch_id,
        })
        .catch((err) => {
          console.error('insertHistoryAssignRealEstateToUser failed:', err);
          return null;
        });

      return inserted;
    } catch (error) {
      throw error;
    }
  };
  checkCreatorIdByUserId = async (dataCheck) => {
    const {real_estate_id, user_id} = dataCheck;
    if (!real_estate_id || !user_id) return false;
    const response = await knexPg('real_estate')
      .select('id')
      .where((whereQuery) => {
        whereQuery
          .where('id', real_estate_id)
          .where('creator_sale_id', user_id)
          .where('status', Constants.STATUS_ENUM.ACTIVE);
      })
      .first();

    return !!response?.id;
  };
  updateDataAssignToRealEstate = async (trx, dataAssign) => {
    try {
      const {
        user_id,
        broker_id,
        broker_phone_id,
        saler_phone_id,
        saler_id,
        real_estate_id,
      } = dataAssign;

      const response = await knexPg('real_estate')
        .where('id', real_estate_id)
        .update({
          creator_sale_id: user_id,
          broker_id: broker_id,
          broker_phone_id: broker_phone_id,
          saler_phone_id: saler_phone_id,
          sale_id: saler_id,
        })
        .transacting(trx)
        .returning('id')
        .catch(trx.rollback);
      return response;
    } catch (error) {
      throw error;
    }
  };
}

module.exports = new RealEstateService();
