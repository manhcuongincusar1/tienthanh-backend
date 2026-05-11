const {notificationService, NOTIFICATION_STATUS_ENUM} = require('../services/notificationService');
const realEstateService = require('../services/realEstateService');
const subscriptionService = require('../services/subscriptionService');
const _ = require('lodash');
const dayjs = require('dayjs');
const webPush = require('web-push');
const Constants = require('../common/constants');
const {ceil} = require("lodash/math");

/**
 *
 * @param currentPage
 * @param real_estate_id
 * @param limit
 * @returns {Promise<{listSubscribe: *|Knex.QueryBuilder<any, DeferredKeySelection<any, never>[]>, count: *}>}
 */
const getDataForSubscription = async (currentPage, real_estate_id, limit) => {
    const offset = limit * currentPage - limit;
    return realEstateService.getRealEstateSubscribe(real_estate_id, limit, offset);
};

const sendNotifications = async (listSubscribe = [], {
    code,
    previous_status_title,
    next_status_title
}) => {
    if (listSubscribe) {
        let sale_id = [];
        listSubscribe.map((item) => {
            sale_id.push(item.sale_id);
        });
        const listSubscription = await subscriptionService.getListSubscription(
            sale_id,
        );
        if (listSubscription) {
            listSubscription.map((item) => {
                // PG knex trả JSONB sẵn dạng object; Mongo cũ có thể trả string → handle cả 2.
                const pushSubscription = typeof item?.info === 'string'
                    ? JSON.parse(item.info)
                    : item?.info;
                webPush.sendNotification(
                    pushSubscription,
                    JSON.stringify({
                        title: 'Thông báo từ Công ty BĐS Tiến Thành',
                        text: `BĐS với mã ${code} được chuyển từ trạng thái ${previous_status_title} sang trạng thái ${next_status_title}`,
                        image: 'download.png',
                        url: `${Constants?.FO_DOMAIN_URL}/real-estate-sell/list`,
                    }),
                )
                    .catch(async (err) => {
                        if (err.body) {
                            await subscriptionService.deleteSubscriptionByEnpoint(
                                item.auth,
                            );
                        }
                    });
            });
        }
    }
}

async function sendNotificationQueue() {
    const listNotificationQueue = await notificationService.getListWaitingNotificationQueue({});
    if (!_.isEmpty(listNotificationQueue)) {
        const listId = _.values(
            _.mapValues(listNotificationQueue, (notificationData) => {
                return notificationData.id;
            }),
        );
        await notificationService.updateNotification(
            {listId},
            {
                status: NOTIFICATION_STATUS_ENUM.SENDING,
                modification_at: dayjs().utc(),
            },
        );
        _.each(listNotificationQueue, async (notificationData) => {
            let limit = 100, offset = 0;
            const {id, real_estate_id, infodata} = notificationData;
            const {listSubscribe, count} = await realEstateService.getRealEstateSubscribe(real_estate_id, limit, offset);
            const totalPage = ceil(count / limit);
            if (listSubscribe) {
                await sendNotifications(listSubscribe, infodata);
            }

            if (totalPage > 1) {
                for (let i = 2; i <= totalPage; i++) {
                    const {listSubscribe, count} = await getDataForSubscription(
                        i,
                        real_estate_id,
                        limit,
                    );
                    await sendNotifications(listSubscribe, infodata);
                }
            }

            await notificationService.updateNotification(
                {listId: [id]},
                {
                    status: NOTIFICATION_STATUS_ENUM.SUCCESS,
                    modification_at: dayjs().utc(),
                },
            );
        });
    }
}

module.exports = {sendNotificationQueue};
