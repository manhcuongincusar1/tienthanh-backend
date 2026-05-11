module.exports = {
  GeneratedPadCode: (prefix, key, length = 7) => {
    return prefix + String(key + 1).padStart(length, '0');
  },

  /**
   *
   * @param {String} prefix
   * @param {String|Number} key
   * @param {Number} length
   * @returns {string}
   * @constructor
   */
  GeneratedCode: (prefix, key, length = 6) => {
    return prefix + String(key).padStart(length, '0');
  },
};
