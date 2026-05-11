const BaseService = require('./baseService');
const knexPG = require('../db/connectKnex');
const _ = require('lodash');
const Constants = require('../common/constants');
const ROLE_ENUM = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  SALE: 'sale',
};
class SaleService extends BaseService {
  getSaleList = async () => {
    const response = await knexPG('customers')
      .where('customers.status', Constants.STATUS_ENUM.ACTIVE)
      .innerJoin('users', 'users.id', 'customers.creator_id')
      .where('users.status', Constants.STATUS_ENUM.ACTIVE)
      .select('users.full_name', 'users.id', 'users.raw_phone_number')
      .groupBy('users.id');

    if (!response) {
      return false;
    }
    return response;
  };

  checkRangePriceSell = async (sell_price = 0, sale_id) => {
    let baseQuery = knexPG('sales')
      .where('status', Constants.STATUS_ENUM.ACTIVE)
      .where('user_id', sale_id)
      .where('sell_price_from', '<=', sell_price);
    if (sell_price) {
      baseQuery = baseQuery.where('sell_price_to', '>=', sell_price);
    }
    const response = await baseQuery.first();
    if (!response) {
      return false;
    }
    return true;
  };
  checkIsSale = async (id) => {
    const response = await knexPG('sales')
      .where('user_id', id)
      .where('status', Constants.STATUS_ENUM.ACTIVE)
      .first();

    if (!response) {
      return false;
    }
    return true;
  };
  getSaleInfo = async (id) => {
    const isValidSale = await knexPG('sales')
      .where('sales.user_id', id)
      .where('sales.status', Constants.STATUS_ENUM.ACTIVE)
      .where('sales.type', ROLE_ENUM.SALE)
      .first();

    const response = await knexPG('sales')
      .where('sales.user_id', id)
      .where('sales.status', Constants.STATUS_ENUM.ACTIVE)
      .where('sales.type', ROLE_ENUM.SALE)
      .innerJoin('sale_branch', 'sales.id', 'sale_branch.sale_id')
      .innerJoin('sale_district', 'sales.id', 'sale_district.sale_id')
      .innerJoin('districts', 'districts.id', 'sale_district.districts_id')
      .select(
        'sales.sell_price_from',
        'sales.sell_price_to',
        'sales.rent_price_from',
        'sales.rent_price_to',
        'sale_branch.branch_id',
        knexPG.raw(
          'jsonb_agg(DISTINCT sale_district.districts_id) as districts_id',
        ),
        'districts.province_city_id',
      )
      .groupBy(
        'sales.sell_price_from',
        'sales.sell_price_to',
        'sales.rent_price_from',
        'sales.rent_price_to',
        'sale_branch.branch_id',
        'districts.province_city_id',
      )
      .first();

    if (!isValidSale && !response) {
      return false;
    }
    return {...response, is_sale: !!isValidSale};
  };
}

module.exports = new SaleService();
