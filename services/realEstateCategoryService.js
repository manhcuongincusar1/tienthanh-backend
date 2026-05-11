const BaseService = require('./baseService');
const _ = require('lodash');
const knexPg = require('../db/connectKnex');
const Constants = require('../common/constants');
const Common = require('../common/common');
const {GeneratedCode} = require('../utils');

class RealEstateCategoryService extends BaseService {
  /**
   * Get List Status
   * @param {Object} data
   * @returns {Promise<*>}
   */
  getList = async (data) => {
    const {limit, offset, status, type, isEditableRe, isDefault, keyword} =
      data;
    const statusArr = status
      ? status
      : [Constants.STATUS_ENUM.ACTIVE, Constants.STATUS_ENUM.PENDING];
    try {
      let baseQuery = knexPg({rec: 'real_estate_category'})
        .where((builder) => {
          builder.whereIn('rec.status', statusArr);
        })
        .leftJoin({re: 'real_estate'}, (builder) => {
          builder.on('rec.id', '=', 're.category_id');
        });

      if (keyword) {
        const keywordSearch = `%${keyword}%`;
        baseQuery = baseQuery.where((builder) => {
          builder
            .orWhereILike('rec.code', keywordSearch)
            .orWhereILike('rec.title', keywordSearch);
        });
      }

      Common.buildWhereQuery(baseQuery, 'rec', {
        type,
        is_editable_re: isEditableRe,
        is_default: isDefault,
      });

      const response = await baseQuery
        .clone()
        .columns([
          {
            id: 'rec.id',
            code: 'rec.code',
            title: 'rec.title',
            status: 'rec.status',
            listRE: knexPg.count('re'),
          },
        ])
        .orderBy('rec.code', 'asc')
        .limit(limit)
        .offset(offset)
        .groupBy('rec.id', 'rec.title', 'rec.code', 'rec.status');
      const {count} = await baseQuery.clone().countDistinct('rec.id').first();
      if (!response || !count) {
        return false;
      }
      return {realEstateCategoryList: response, count: _.toNumber(count)};
    } catch (e) {
      console.error(e.message);
      return false;
    }
  };

  /**
   *
   * @param {Object} data
   * @returns {Promise<*>}
   */
  insertOne = async (data) => {
    const {title, status} = data;
    const statusNes = status ? status : Constants.STATUS_ENUM.ACTIVE;
    try {
      const {count} = await knexPg('real_estate_category').count('id').first();

      if (_.isUndefined(count)) {
        return false;
      }
      const response = await knexPg('real_estate_category')
        .insert({
          code: GeneratedCode('DM', count, 2),
          title,
          status: statusNes,
        })
        .returning(['id', 'code']);
      if (_.isUndefined(response)) {
        return false;
      }
      return response;
    } catch (e) {
      console.error(e.message);
      return false;
    }
  };

  detailOne = async (id) => {
    const statusNes = [
      Constants.STATUS_ENUM.ACTIVE,
      Constants.STATUS_ENUM.PENDING,
    ];
    try {
      const result = await knexPg('real_estate_category')
        .where({
          id,
        })
        .whereIn('status', statusNes)
        .first();
      if (_.isUndefined(result)) {
        return false;
      }
      return result;
    } catch (e) {
      console.error(e.message);
      return false;
    }
  };

  /**
   * Update Data
   * @param {Number} id
   * @param {Object} data
   * @returns {Promise<*>}
   */
  updateOne = async (id, data) => {
    const {title, status} = data;
    const statusNes = [
      Constants.STATUS_ENUM.ACTIVE,
      Constants.STATUS_ENUM.PENDING,
    ];
    try {
      const dataUpdate = {
        title,
        status,
      };
      const result = await knexPg('real_estate_category')
        .where({
          id,
        })
        .whereIn('status', statusNes)
        .update(dataUpdate)
        .returning(['id', 'code']);
      if (_.isUndefined(result)) {
        return {status: false, result: 'Không thể cập nhật vui lòng thử lại'};
      }
      return {status: true, result};
    } catch (e) {
      console.error(e.message);
      return false;
    }
  };

  deleteOne = async (id) => {
    try {
      const result = await knexPg('real_estate_category')
        .where({
          id,
        })
        .update({
          status: Constants.STATUS_ENUM.DELETED,
        })
        .returning(['id', 'code']);
      if (_.isUndefined(result)) {
        return false;
      }
      return result;
    } catch (e) {
      console.error(e.message);
      return false;
    }
  };
  checkDuplicateRealEstateCategory = async (title, current_category_id) => {
    try {
      let baseQuery = knexPg('real_estate_category')
        .whereRaw(
          "LOWER(Replace(title,' ', '')) = ?",
          title.replace(/ /g, '').toLowerCase(),
        )
        .whereNot('status', Constants.STATUS_ENUM.DELETED);

      if (current_category_id) {
        baseQuery = baseQuery.whereNot('id', current_category_id);
      }
      const response = await baseQuery
        .select('id', knexPg.raw("replace(title,' ', '')"))
        .first();

      if (_.isUndefined(response)) {
        return false;
      }
      return response;
    } catch (error) {
      console.error(error.message);
      return false;
    }
  };
}

module.exports = new RealEstateCategoryService();
