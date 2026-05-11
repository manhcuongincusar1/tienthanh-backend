const BaseService = require('./baseService');
const knexPg = require('../db/connectKnex');
const _ = require('lodash');
const Common = require('../common/common');

class BranchService extends BaseService {
  getBranchesList = async ({
    province_city_id,
    district_id,
    ward_id,
    status,
    keyword,
    ids = [],
    limit = 10,
    offset = 0,
  }) => {
    let baseQuery = knexPg('branches').whereNot('branches.status', -1);

    baseQuery = Common.buildWhereQuery(baseQuery, 'branches', {
      province_city_id,
      district_id,
      ward_id,
    });

    if (keyword) {
      baseQuery = baseQuery.where(function () {
        this.orWhereILike('branches.code', `%${keyword}%`)
          .orWhereILike('branches.address', `%${keyword}%`)
          .orWhereILike('branches.title', `%${keyword}%`)
          .orWhereILike('branches.tax', `%${keyword}%`);
      });
    }
    if (!_.isUndefined(ids) && !_.isEmpty(ids) && _.isArray(ids)) {
      baseQuery = baseQuery.whereIn('branches.id', ids);
    }

    if (!_.isUndefined(status)) {
      baseQuery = baseQuery.where('branches.status', Number(status));
    }

    const response = await baseQuery
      .clone()
      .select(
        'branches.id',
        'branches.address',
        'branches.tax',
        'branches.code',
        'branches.title',
        'branches.created_at',
        'branches.status',
        'province_city.title as province_city_title',
        'province_city.id as province_city_id',
        'districts.title as district_title',
        'districts.id as district_id',
        'wards.title as ward_title',
        'wards.id as ward_id',
        knexPg.raw('count(DISTINCT sale_branch_sub.sale_id) as amount_sale'),
        knexPg.raw(
          `CASE
           WHEN bd.branch_id is not null then jsonb_agg(distinct bd.province_district)
        else '[]'::jsonb END  as permission_districts`,
        ),
      )
      .leftJoin(
        'province_city',
        'province_city.id',
        'branches.province_city_id',
      )
      .leftJoin('districts', 'districts.id', 'branches.district_id')
      .joinRaw(
        "left join lateral (select sale_branch.sale_id , sale_branch.branch_id from sale_branch left join sales on sales.id = sale_branch.sale_id where sales.status = 1 and sales.type = 'sale') as sale_branch_sub on branches.id = sale_branch_sub.branch_id",
      )
      .joinRaw(
        `left join lateral (select bd.branch_id as branch_id,
                    jsonb_build_object('province', bd.province_id, 'districts',
                                       jsonb_agg(bd.district_id)) as province_district
                    from branch_district bd
                    group by bd.branch_id, bd.province_id) as bd on branches.id = bd.branch_id`,
      )
      .leftJoin('wards', 'wards.id', 'branches.ward_id')
      .groupBy(
        'branches.id',
        'province_city.id',
        'districts.id',
        'wards.id',
        'branches.code',
        'bd.branch_id',
      )
      .orderBy('branches.code', 'asc')
      .limit(limit)
      .offset(offset)
      .catch((err) => console.log(err));

    const {count} = await baseQuery.clone().countDistinct('id').first();

    if (!response || !count) {
      return false;
    }

    return {branches_list: response, count: count};
  };
  deleteBranchById = async (id) => {
    const response = await knexPg('branches')
      .where('id', id)
      .update('status', -1);
    if (!response) {
      return false;
    }
    return response;
  };
  updateBranchById = async ({
    code,
    address,
    title,
    province_city_id,
    district_id,
    ward_id,
    permission_province,
    permission_districts,
    tax,
    status,
    id,
  }) => {
    const response = await knexPg('branches').where('id', id).update({
      code,
      address,
      title,
      province_city_id,
      district_id,
      ward_id,
      tax,
      status,
    });
    await this.insertBranchDistricts({
      branch_id: id,
      province_id: permission_province,
      district_ids: permission_districts,
    });
    if (_.isUndefined(response)) {
      return false;
    }
    return response;
  };
  createBranch = async ({
    address,
    title,
    province_city_id,
    district_id,
    ward_id,
    tax,
    status,
  }) => {
    const count = await knexPg('branches').count('id').first();
    if (_.isUndefined(count) && !_.isArray(count)) {
      return false;
    }
    const countBranches = count && (Number(count?.count) + 1).toString();
    let codeNew = [];
    for (let i = 0; i < 4 - countBranches.length; i++) {
      codeNew.push('0');
    }

    const response = await knexPg('branches')
      .insert({
        code: `CN${[...codeNew, ...countBranches].join('')}`,
        address,
        title,
        province_city_id,
        district_id,
        ward_id,
        tax,
        status,
      })
      .returning(['id', 'code']);

    if (_.isUndefined(response)) {
      return false;
    }
    return response;
  };
  updateStatusById = async (id, status) => {
    const response = await knexPg('branches').where('id', id).update({
      status: status,
    });
    if (_.isUndefined(response)) {
      return false;
    }
    return response;
  };
  checkDuplicateCodeTax = async ({tax}) => {
    let baseQuery = knexPg('branches');

    const response = await baseQuery.where('tax', tax).first();
    if (_.isUndefined(response)) {
      return false;
    }
    return response;
  };

  insertBranchDistricts = async (dataPermissions) => {
    const {branch_id, province_id, district_ids} = dataPermissions;
    if (
      !_.isUndefined(branch_id) &&
      !_.isUndefined(province_id) &&
      !_.isUndefined(district_ids) &&
      !_.isEmpty(district_ids)
    ) {
      let listInsert = [];
      _.each(district_ids, (district_id) => {
        listInsert.push({branch_id, province_id, district_id});
      });
      try {
        await knexPg.transaction(async (trx) => {
          await knexPg('branch_district')
            .where({
              branch_id,
            })
            .del()
            .transacting(trx);
          await knexPg('branch_district').insert(listInsert).transacting(trx);
        });
      } catch (e) {
        return false;
      }

      return true;
    }
  };
}

module.exports = new BranchService();
