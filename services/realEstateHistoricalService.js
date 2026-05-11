const BaseService = require('./baseService');
const postgresqlConnect = require('../db/postgresql');
const _ = require('lodash');
const Constants = require('../common/constants');
const knexPg = require('../db/connectKnex');
const Common = require('../common/common');
const dayjs = require('dayjs');

class RealEstateHistoricalService extends BaseService {
  /**
   * Insert Historical
   * @param {Record<String, any>} data
   * @param {String} creator_id
   * @returns {Promise<T|boolean>}
   */
  insertHistorical = async (trx, data, creator_id) => {
    return await knexPg('real_estate_historical')
      .insert({
        meta_data: data,
        creator_id,
      })
      .returning('id')
      .transacting(trx)
      .then(async (res) => {
        if (res[0]) {
          return res[0].id;
        }
      })
      .catch((err) => {
        console.log(err);
        return false;
      });
  };
}

module.exports = new RealEstateHistoricalService();
