const BaseService = require('./baseService');
const _ = require('lodash');
const knexPg = require('../db/connectKnex');

class SubscriptionService extends BaseService {
  /**
   * @returns auth (endpoint) of inserted/updated subscription, or false on fail
   */
  insertNewSubscription = async (userId, data, auth) => {
    const [row] = await knexPg('subscriptions')
      .insert({
        user_id: userId,
        auth,
        info: data,
      })
      .onConflict('auth')
      .merge({
        user_id: userId,
        info: data,
      })
      .returning(['auth']);
    return row?.auth || false;
  };

  getSubscription = async (userId) => {
    const row = await knexPg('subscriptions').where('user_id', userId).first();
    if (!row) {
      return false;
    }
    // Backward-compat shape (Mongo từng trả `userId`, không phải `user_id`).
    return {
      userId: row.user_id,
      auth: row.auth,
      info: row.info,
    };
  };

  getListSubscription = async (sale_id) => {
    const ids = _.isArray(sale_id) ? sale_id : [sale_id];
    if (_.isEmpty(ids)) {
      return [];
    }
    const rows = await knexPg('subscriptions').whereIn('user_id', ids);
    return rows.map((r) => ({
      userId: r.user_id,
      auth: r.auth,
      info: r.info,
    }));
  };

  deleteSubscriptionByEnpoint = async (auth) => {
    const rows = await knexPg('subscriptions')
      .where('auth', auth)
      .del()
      .returning(['id', 'auth']);
    if (!rows || !rows.length) {
      return false;
    }
    return rows[0];
  };
}

module.exports = new SubscriptionService();
