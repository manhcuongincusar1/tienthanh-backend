const BaseService = require('./baseService');
const _ = require('lodash');
const knexPg = require('../db/connectKnex');
const Constants = require('../common/constants');
const Common = require('../common/common');
const {GeneratedCode} = require('../utils');

class RealEstateService extends BaseService {
  /**
   * Get List Status
   * @param {Object} data
   * @returns {Promise<*>}
   */
  getList = async (data) => {
    const {limit, offset, status, type, isEditableRe, isDefault, keyword} =
      data;
    const statusArr = status ? status : [Constants.STATUS_ENUM.ACTIVE];
    try {
      let baseQuery = knexPg('real_estate_status').where((builder) => {
        builder.whereIn('status', statusArr);
      });

      if (keyword) {
        const keywordSearch = `%${keyword}%`;
        baseQuery = baseQuery.where((builder) => {
          builder
            .orWhereILike('code', keywordSearch)
            .orWhereILike('title', keywordSearch);
        });
      }
      Common.buildWhereQuery(baseQuery, 'real_estate_status', {
        type: type ? Number(type) : undefined,
        is_editable_re: isEditableRe,
        is_default: isDefault,
      });
      const response = await baseQuery
        .clone()
        .orderBy('id', 'asc')
        .limit(limit)
        .offset(offset);
      const {count} = await baseQuery.clone().countDistinct('id').first();
      if (!response || !count) {
        return false;
      }
      return {realEstateStatusList: response, count: _.toNumber(count)};
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
    const {
      title,
      isEditableRe,
      isDefault,
      isAllowDuplicate,
      type,
      status,
      color,
    } = data;
    const statusNes = status ? status : Constants.STATUS_ENUM.ACTIVE;
    try {
      const {count} = await knexPg('real_estate_status').count('id').first();

      const {hasDefault} = await knexPg
        .count('id', {as: 'hasDefault'})
        .from('real_estate_status')
        .where({
          type,
          is_default: true,
          status: Constants.STATUS_ENUM.ACTIVE,
        })
        .first();
      if (_.isUndefined(count)) {
        return false;
      }
      if (_.toNumber(hasDefault) > 0) {
        await knexPg('real_estate_status')
          .where({
            is_default: true,
            type,
          })
          .update({
            is_default: false,
          });
      }
      const response = await knexPg('real_estate_status')
        .insert({
          code: GeneratedCode('TT', count, 2),
          title: title.trim(),
          is_editable_re: isEditableRe,
          is_default: isDefault,
          is_allow_duplicate: isAllowDuplicate,
          type,
          status: statusNes,
          color,
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
      const result = await knexPg('real_estate_status')
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
    const {
      title,
      isEditableRe,
      isDefault,
      isShowInternal,
      isAllowDuplicate,
      type,
      status,
      color,
    } = data;
    const statusNes = [
      Constants.STATUS_ENUM.ACTIVE,
      Constants.STATUS_ENUM.PENDING,
    ];
    try {
      const {hasDefault} = await knexPg
        .count('id', {as: 'hasDefault'})
        .from('real_estate_status')
        .where({
          type,
          is_default: true,
          status: Constants.STATUS_ENUM.ACTIVE,
        })
        .whereNot({
          id,
        })
        .first();

      if (
        _.toNumber(hasDefault) > 0 &&
        !_.isUndefined(isDefault) &&
        isDefault
      ) {
        await knexPg('real_estate_status')
          .where({
            is_default: true,
            type,
          })
          .update({
            is_default: false,
          });
      } else if (
        _.toNumber(hasDefault) === 0 &&
        !_.isUndefined(isDefault) &&
        !isDefault
      ) {
        return {
          status: false,
          result:
            'Tình trạng này được chọn làm giá trị Default nên không thể sửa.',
        };
      }

      const dataUpdate = {
        title: title?.trim(),
        type,
        status: status,
      };
      if (!_.isUndefined(isDefault)) {
        dataUpdate.is_default = isDefault;
        dataUpdate.status = Constants.STATUS_ENUM.ACTIVE;
      }
      if (!_.isUndefined(isEditableRe)) {
        dataUpdate.is_editable_re = isEditableRe;
      }
      if (!_.isUndefined(isAllowDuplicate)) {
        dataUpdate.is_allow_duplicate = isAllowDuplicate;
      }
      if (!_.isUndefined(isShowInternal)) {
        dataUpdate.is_show_internal = isShowInternal;
      }
      if (!_.isUndefined(color)) {
        dataUpdate.color = color;
      }
      const result = await knexPg('real_estate_status')
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
      const result = await knexPg('real_estate_status')
        .where({
          id,
        })
        .update({
          status: Constants.STATUS_ENUM.DELETED,
          is_default: false,
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
  getDefaultRealEstateStatus = async () => {
    try {
      const result = await knexPg('real_estate_status')
        .where('is_default', true)
        .select('id', 'title')
        .first();
      if (_.isUndefined(result)) {
        return false;
      }
      return result;
    } catch (error) {
      console.error(e.message);
      return false;
    }
  };
  checkExistRealEstateStatus = async (title, current_status_id) => {
    try {
      let baseQuery = knexPg('real_estate_status')
        .whereRaw(
          "LOWER(Replace(title,' ', '')) = ?",
          title.replace(/ /g, '').toLowerCase(),
        )
        .where('status', Constants.STATUS_ENUM.ACTIVE);

      if (current_status_id) {
        baseQuery = baseQuery.whereNot('id', current_status_id);
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

module.exports = new RealEstateService();
