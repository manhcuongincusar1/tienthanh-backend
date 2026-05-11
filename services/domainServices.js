const BaseService = require('./baseService');
const _ = require('lodash');
const knexPg = require('../db/connectKnex');

class DomainServices extends BaseService {

  /**
   * Get Domain Information
   * @param domain
   * @returns {Promise<boolean|awaited Knex.QueryBuilder<TRecord, TResult>>}
   */
  getDomainInfo = async (domain) => {
    const response = await knexPg('domain_setting')
        .where('domain_title', domain).first();
    if (!response) {
      return false;
    }
    return response;
  };
}

module.exports = new DomainServices();
