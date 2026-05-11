const MailQueueSchema = {
    id: "/MailQueue",
    type: "object",
    properties: {
        to_mail: {
            type: "string",
            required: true,
        },
        subject: {
            type: "string",
            required: true,
        },
        content: {
            type: "string",
        }
    }
}

module.exports = {
    MailQueueSchema,
}
