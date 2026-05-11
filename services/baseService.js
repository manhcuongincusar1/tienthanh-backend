/**
 * Base class cho tất cả service.
 * Sau S1 cutover: chỉ còn helper utility — không còn Mongo connection.
 */
class BaseService {
  wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

module.exports = BaseService;
