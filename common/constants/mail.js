let HOST = process.env.MAIL_HOST || "smtp.gmail.com";
let PORT = process.env.MAIL_PORT || 465;
let USERNAME = process.env.MAIL_USERNAME || "devsendmailmpire@gmail.com";
let PASSWORD = process.env.MAIL_PASSWORD || "gbybobtxkwgvqzyw";
const MAIL_CONSTANT = {
    host: HOST,
    port: PORT,
    secure: true, // true for 465, false for other ports
    auth: {
        user: USERNAME, // generated ethereal user
        pass: PASSWORD, // generated ethereal password
    },
};

module.exports = MAIL_CONSTANT;
