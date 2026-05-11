const axios = require("axios")

/**
 *
 * @param {String} url
 * @param {Object=} config
 * @returns {Promise<AxiosResponse<any>>}
 */
const httpGet = (url, config) => {
    return axios.get(url, config)
}

const httpPost = (url, data, config) => {
    return axios.post(url, data, config)
}

module.exports = {
    httpGet,
    httpPost
}
