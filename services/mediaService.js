const BaseService = require('./baseService');
const knexPG = require('../db/connectKnex');
const _ = require('lodash');
const Common = require('../common/common');

class MediaService extends BaseService {
  insertMedia = async (data) => {
    const {path, extension, title, cdn_path} = data;

    const response = await knexPG('media')
      .insert({
        path: path,
        extension: extension,
        title: title,
        cdn_path: cdn_path,
        status: 1,
      })
      .returning(['id', 'path', 'cdn_path']);

    if (!response) {
      return false;
    }
    return response[0];
  };
  insertMultipleMedia = async (data) => {
    const newDataInsert = data.map((value) => ({
      path: value.path,
      extension: value.extension,
      title: value.title,
      status: 1,
    }));
    const response = await knexPG('media')
      .insert(newDataInsert)
      .returning(['id', 'path']);
    if (!response) {
      return false;
    }
    return response;
  };
}

module.exports = new MediaService();
