const BaseService = require("./baseService");
const knexPG = require('../db/connectKnex');
const Constants = require("../common/constants");
const Validator = require('jsonschema').Validator;
const {mailQueueSchema} = require('../validation');
const MAIL_STATUS_ENUM = {
    FAIL: 0, WAITING: 1, SENDING: 2, SUCCESS: 3
}

class MailService extends BaseService {
    validator;

    constructor() {
        super();
        this.validator = new Validator();
    }

    /**
     * Get List Waiting Mail Queue
     * @param data
     * @returns {Promise<void>}
     */
    getListWaitingMailQueue = async (data) => {
        return knexPG.column(['id', 'to_mail', 'subject', 'content']).select().from('mail_queue').where(function () {
            this.where('process_status', MAIL_STATUS_ENUM.WAITING)
        }).limit(30);
    }

    /**
     * Get List Waiting Mail Queue
     * @param data
     * @returns {Promise<void>}
     */
    getListSendingMailToCheck = async (data) => {
        return knexPG.column(['id', 'to_mail', 'subject', 'content']).select().from('mail_queue')
            .where('process_status', MAIL_STATUS_ENUM.SENDING).andWhereRaw("modification_date < NOW() - INTERVAL '10 minutes'");
    }

    /**
     * create Mail to send
     * @param toMail
     * @param subject
     * @param content
     */
    createMail = async ({toMail, subject, content}) => {
        const resultValid = this.validator.validate({
            to_mail: toMail, subject, content
        }, mailQueueSchema.MailQueueSchema);
        if (!resultValid.valid) {
            return resultValid.errors[0].stack;
        }
        const result = await knexPG.insert({
            to_mail: toMail, subject, content, process_status: MAIL_STATUS_ENUM.WAITING
        }, ['id']).into('mail_queue')

        return result;
    }

    /**
     * Update Mail Queue
     * @param {Object} dataWhere
     * @param {Object} dataUpdate
     * @returns {Promise<void>}
     */
    updateMail = async (dataWhere, dataUpdate) => {
        const {listId} = dataWhere;
        const result = await knexPG("mail_queue").where(function () {
            this.whereIn('id', listId)
        }).update(dataUpdate, ['id'])
        return result;
    }

}

module.exports = {
    MAIL_STATUS_ENUM, mailService: new MailService()
};