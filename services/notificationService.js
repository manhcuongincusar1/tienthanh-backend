const BaseService = require("./baseService");
const knexPG = require('../db/connectKnex');
const Constants = require("../common/constants");
const Validator = require('jsonschema').Validator;
const {mailQueueSchema} = require('../validation');
const NOTIFICATION_STATUS_ENUM = {
    FAIL: 0, WAITING: 1, SENDING: 2, SUCCESS: 3
}

class NotificationService extends BaseService {
    validator;

    constructor() {
        super();
        this.validator = new Validator();
    }

    /**
     * Get List Waiting Notification Queue
     * @param data
     * @returns {Promise<void>}
     */
    getListWaitingNotificationQueue = async (data) => {
        return knexPG.column(['id', 'real_estate_id', 'infodata', 'status']).select().from('notification_queue').where(function () {
            this.where('status', NOTIFICATION_STATUS_ENUM.WAITING)
        }).limit(30);
    }

    /**
     * create Notification
     * @param realEstateId
     * @param infoData
     * @returns {Promise<awaited Knex.QueryBuilder<{}, DeferredKeySelection.ReplaceBase<TResult, {}>>>}
     */
    createNotification = async ({realEstateId, infoData}) => {
        const result = await knexPG.insert({
            real_estate_id: realEstateId, status: NOTIFICATION_STATUS_ENUM.WAITING, infodata: infoData
        }, ['id']).into('notification_queue')

        return result;
    }

    /**
     * Update Notification Queue
     * @param {Object} dataWhere
     * @param {Object} dataUpdate
     * @returns {Promise<void>}
     */
    updateNotification = async (dataWhere, dataUpdate) => {
        const {listId} = dataWhere;
        const result = await knexPG("notification_queue").where(function () {
            this.whereIn('id', listId)
        }).update(dataUpdate, ['id']);
        return result;
    }

}

module.exports = {
    NOTIFICATION_STATUS_ENUM, notificationService: new NotificationService()
};