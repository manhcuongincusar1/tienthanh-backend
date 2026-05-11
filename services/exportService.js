const BaseService = require('./baseService');
const _ = require('lodash');
const knexPg = require('../db/connectKnex');
const Common = require('../common/common');
const EXPORT_STATUS_ENUM = {
  FAIL: 0,
  CHECKING: 1,
  EXECUTION: 2,
  SUCCESS: 3,
};

class ExportService extends BaseService {
  insertExportRequest = async (data, auth_id) => {
    try {
      const {type, branch_id} = data;
      const insertExportQueue = await knexPg('export_queue')
        .insert({
          meta_data: data,
          type: type,
          user_id: auth_id,
          status: EXPORT_STATUS_ENUM.CHECKING,
          branch_id: branch_id,
        })
        .returning('id');

      return insertExportQueue;
    } catch (e) {
      console.error(e.message);
      return false;
    }
  };

  exportUpdate = async (dataWhere, dataUpdate) => {
    const {listId} = dataWhere;
    const result = await knexPg('export_queue')
      .where(function () {
        this.whereIn('id', listId);
      })
      .update(dataUpdate, ['id']);
    return result;
  };

  getListExportQueue = async (data = {}, permissionInfo, user_id) => {
    const {
      limit,
      offset,
      status,
      type,
      start_day,
      end_day,
      keyword,
      sort,
      branch_id,
    } = data;

    try {
      let baseQuery = knexPg.from({eq: 'export_queue'});
      Common.buildWhereQuery(baseQuery, 'eq', {
        type,
        status,
      });

      if (!_.isUndefined(keyword)) {
        baseQuery.whereILike('eq.file_name', `%${keyword}%`);
      }

      if (!_.isUndefined(branch_id)) {
        baseQuery.where('eq.branch_id', branch_id);
      }

      if (!_.isUndefined(start_day)) {
        const {f_start_day} = Common.convertDateToLocalTimeIOSString(start_day);
        baseQuery.where(function () {
          this.where(knexPg.raw('?? >= ?', ['eq.created_at', f_start_day]));
        });
      }

      if (!_.isUndefined(end_day)) {
        const {f_end_day} = Common.convertDateToLocalTimeIOSString(
          undefined,
          end_day,
        );
        baseQuery.where(function () {
          this.where(knexPg.raw('?? < ?', ['eq.created_at', f_end_day]));
        });
      }
      if (permissionInfo) {
        baseQuery = baseQuery.where('eq.user_id', user_id);
      }

      let listQuery = baseQuery
        .clone()
        .column([
          'eq.id',
          'file_path',
          'u.full_name',
          'file_name',
          'eq.created_at',
          'eq.status',
          'eq.type',
        ])
        .leftJoin({u: 'users'}, 'eq.user_id', 'u.id')
        .groupBy(
          'eq.id',
          'eq.file_path',
          'u.full_name',
          'eq.file_name',
          'eq.created_at',
          'eq.status',
          'eq.type',
        )
        .limit(_.toNumber(limit))
        .offset(offset);

      if (!_.isEmpty(sort)) {
        let sortRaw = '';
        _.each(sort, (direction, keyItem) => {
          switch (direction) {
            case 'descend':
              sortRaw += `eq.${keyItem} DESC`;
              break;
            default:
              sortRaw += `eq.${keyItem} ASC`;
          }
        });
        listQuery.orderByRaw(sortRaw);
      } else {
        listQuery.orderBy('eq.created_at', 'desc');
      }
      const response = await listQuery;
      const {count} = await baseQuery.clone().countDistinct('eq.id').first();
      if (!response || !count) {
        return false;
      }

      return {exportList: response, count: _.toNumber(count)};
    } catch (e) {
      console.error(e.message);
      return false;
    }
  };

  getListWaitingExportQueue = async () => {
    const isExportExcuting = await knexPg
      .select('id')
      .from('export_queue')
      .where(function () {
        this.where('status', EXPORT_STATUS_ENUM.EXECUTION);
      })
      .first();
    if (isExportExcuting?.id) {
      return [];
    }
    return knexPg
      .select()
      .from('export_queue')
      .where(function () {
        this.where('status', EXPORT_STATUS_ENUM.CHECKING);
      })
      .orderBy('created_at')
      .limit(1);
  };
}

module.exports = {
  EXPORT_STATUS_ENUM,
  exportService: new ExportService(),
};
