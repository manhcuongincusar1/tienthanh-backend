const Constants = require("../common/constants");
const env = process.env.NODE_ENV || 'development';
const setting = {
    development: {
        port : 3002,
        slash: '/',		//if Windows, change this to "\\" & NOT submit to server
        secret: Constants.SECRET_JWT,		//session secret
        pwd_extension: 'Eng',
        captchaExpiresIn: 15 * 60,
        token: {
            secret: Constants.SECRET_JWT,		//session secret
            expiresIn: 30 * 24 * 3600, //seconds
        },
        user: {
            defaultPassword: '123qwe',
        },
        databases: {
            postgres: process.env.POSTGRES_URL ? process.env.POSTGRES_URL : 'postgresql://tita:123qwe@0.0.0.0:5432/tita',
            mongoDB: process.env.MONGODB_URL ? process.env.MONGODB_URL : 'mongodb://localhost:27017/tita'
        },
    },
    production: {
        port : 3002,
        slash: '/',		//if Windows, change this to "\\" & NOT submit to server
        secret: Constants.SECRET_JWT,		//session secret
        pwd_extension: 'Eng',
        captchaExpiresIn: 15 * 60,
        token: {
            secret: Constants.SECRET_JWT,		//session secret
            expiresIn: 30 * 24 * 3600, //seconds
        },
        user: {
            defaultPassword: '123qwe',
        },
        databases: {
            postgres: process.env.POSTGRES_URL ? process.env.POSTGRES_URL : 'postgresql://tita:123qwe@0.0.0.0:5432/tita',
            mongoDB: process.env.MONGODB_URL ? process.env.MONGODB_URL : 'mongodb://localhost:27017/tita'
        }

    }
};

module.exports = function(mode) {
    return setting[env] || setting.development;
}