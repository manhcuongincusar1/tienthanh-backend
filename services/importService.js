const BaseService = require('./baseService');
const _ = require('lodash');
const knexPg = require('../db/connectKnex');
const Common = require('../common/common');
const IMPORT_STATUS_ENUM = {
  FAIL: 0,
  CHECKING: 1,
  EXECUTION: 2,
  SUCCESS: 3,
};

const REAL_LOCATION = {
  facede: 1,
  alley_moto: 2,
  alley_car: 3,
};

const REAL_LOCATION_ENUM = {
  [REAL_LOCATION.facede]: 'Mặt tiền',
  [REAL_LOCATION.alley_moto]: 'Hẻm xe máy',
  [REAL_LOCATION.alley_car]: 'Hẻm xe hơi',
};

const DIRECTION_ENUM = {
  west: 'Tây',
  north_west: 'Tây Bắc',
  north: 'Bắc',
  north_east: 'Đông Bắc',
  east: 'Đông',
  south_east: 'Đông Nam',
  south: 'Nam',
  south_west: 'Tây Nam',
};

class ImportService extends BaseService {
  /**
   *
   * @param data
   * @param auth_id
   * @param file_path
   * @returns {Promise<boolean|Knex.QueryBuilder<{user_id, status: number}, SafePartial<{user_id, status: number}>[]>>}
   */
  insertImportRequest = async (
    fileName,
    auth_id,
    file_path,
    dataRealEstate,
  ) => {
    try {
      const {type, branch_id} = dataRealEstate;
      if (fileName && branch_id && type && auth_id) {
        const insertImportQueue = await knexPg('import_queue')
          .insert({
            file_name: fileName,
            file_path,
            user_id: auth_id,
            status: IMPORT_STATUS_ENUM.CHECKING,
            branch_id: branch_id,
            type,
          })
          .returning('id');
        return insertImportQueue;
      }
      return false;
    } catch (e) {
      console.error(e.message);
      return false;
    }
  };

  importUpdate = async (dataWhere, dataUpdate) => {
    const {listId} = dataWhere;
    const result = await knexPg('import_queue')
      .where(function () {
        this.whereIn('id', listId);
      })
      .update(dataUpdate, ['id']);
    return result;
  };

  getListImportQueue = async (data = {}) => {
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
      let baseQuery = knexPg.from({iq: 'import_queue'});

      Common.buildWhereQuery(baseQuery, 'iq', {
        type,
        status,
      });

      if (!_.isUndefined(keyword)) {
        baseQuery.whereILike('iq.file_name', `%${keyword}%`);
      }

      if (!_.isUndefined(branch_id)) {
        baseQuery.where('iq.branch_id', branch_id);
      }

      if (!_.isUndefined(start_day)) {
        const {f_start_day} = Common.convertDateToLocalTimeIOSString(start_day);
        baseQuery.where(function () {
          this.where(knexPg.raw('?? >= ?', ['iq.created_at', f_start_day]));
        });
      }

      if (!_.isUndefined(end_day)) {
        const {f_end_day} = Common.convertDateToLocalTimeIOSString(
          undefined,
          end_day,
        );
        baseQuery.where(function () {
          this.where(knexPg.raw('?? < ?', ['iq.created_at', f_end_day]));
        });
      }
      let listQuery = baseQuery
        .clone()
        .column([
          'iq.id',
          'iq.error_file_path',
          'u.full_name',
          'iq.file_name',
          'iq.file_path',
          'iq.note',
          'iq.error_file_name',
          'iq.created_at',
          'iq.status',
          'iq.type',
          'iq.info',
        ])
        .leftJoin({u: 'users'}, 'iq.user_id', 'u.id')
        .groupBy(
          'iq.id',
          'iq.error_file_path',
          'u.full_name',
          'iq.file_name',
          'iq.file_path',
          'iq.note',
          'iq.error_file_name',
          'iq.created_at',
          'iq.status',
          'iq.type',
          'iq.info',
          'iq.created_at',
        )
        .limit(_.toNumber(limit))
        .offset(offset);
      if (!_.isEmpty(sort)) {
        let sortRaw = '';
        _.each(sort, (direction, keyItem) => {
          switch (direction) {
            case 'descend':
              sortRaw += `iq.${keyItem} DESC`;
              break;
            default:
              sortRaw += `iq.${keyItem} ASC`;
          }
        });
        listQuery.orderByRaw(sortRaw);
      } else {
        listQuery.orderBy('iq.created_at', 'desc');
      }

      const response = await listQuery;

      const {count} = await baseQuery.clone().countDistinct('iq.id').first();
      if (!response || !count) {
        return false;
      }
      return {exportList: response, count: _.toNumber(count)};
    } catch (e) {
      console.error(e.message);
      return false;
    }
  };

  getListWaitingImportQueue = async () => {
    return knexPg
      .select('*')
      .from('import_queue')
      .where(function () {
        this.where('status', IMPORT_STATUS_ENUM.CHECKING);
      })
      .orderBy('created_at')
      .first();
  };

  getListExecImportQueue = async () => {
    return knexPg
      .select()
      .from('import_queue')
      .where(function () {
        this.where('status', IMPORT_STATUS_ENUM.EXECUTION);
      })
      .orderBy('created_at');
  };

  getListExecutingImportQueue = async () => {
    const response = await knexPg('import_queue')
      .select('modification_date')
      .where('status', IMPORT_STATUS_ENUM.EXECUTION);

    if (!response) {
      return false;
    }
    return response;
  };
  getOneExecImportQueue = async () => {
    return knexPg
      .select()
      .from('import_queue')
      .where(function () {
        this.where('status', IMPORT_STATUS_ENUM.EXECUTION);
      })
      .orderBy('created_at')
      .first();
  };

  /**
   *
   * @param data
   * @returns {Promise<void>}
   */
  insertErrorsMessage = async (data = {}) => {
    const [row] = await knexPg('import_errors')
      .insert({
        import_id: data.import_id ?? null,
        error_data: data,
        created_at: knexPg.fn.now(),
      })
      .returning(['id']);
    return row;
  };
}

module.exports = {
  IMPORT_STATUS_ENUM,
  importService: new ImportService(),
  REAL_LOCATION,
  REAL_LOCATION_ENUM,
  DIRECTION_ENUM,
};
