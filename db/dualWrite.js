/**
 * Sprint 1 Task 09 — Dual-write + shadow-read wrapper.
 *
 * MỤC ĐÍCH (lưu lại cho lần migration tiếp theo):
 *
 *   Khi đổi storage backend (vd Mongo → PG, hoặc PG → DynamoDB), pattern an toàn là:
 *     1. Dual-write: ghi cả 2 backend cùng lúc trong transition window.
 *     2. Shadow read: đọc backend mới (PRIMARY), so song song với backend cũ,
 *        log diff. Response trả PRIMARY → user không thấy chậm.
 *     3. Sau khi diff rate < target (DECISIONS B3: 0.05% / 0.5%) qua ≥ 7 ngày,
 *        flip DB_PRIMARY và xoá hoàn toàn backend cũ.
 *
 *   Lần migration S1 này đã hoàn tất — wrapper giữ làm tham chiếu, KHÔNG dùng
 *   trong code path hiện tại (chỉ PG sau cutover).
 *
 * USAGE (template cho lần sau):
 *
 *   const dual = require('./db/dualWrite');
 *
 *   const result = await dual.read({
 *     name: 'getSetting',           // tag dùng cho metric diff
 *     primary: () => pgImpl(),       // backend mới
 *     shadow:  () => mongoImpl(),    // backend cũ (để so sánh)
 *   });
 *
 *   await dual.write({
 *     name: 'updateSetting',
 *     primary: () => pgImpl(data),
 *     secondary: () => mongoImpl(data),  // best-effort, không throw
 *   });
 */
const _ = require('lodash');

const DB_PRIMARY = process.env.DB_PRIMARY || 'pg';
// Set 'true' để bật shadow-read. Default tắt sau cutover.
const ENABLE_SHADOW_READ = process.env.ENABLE_SHADOW_READ === 'true';
// Set 'true' để bật dual-write (ghi cả secondary, không throw nếu fail).
const ENABLE_DUAL_WRITE = process.env.ENABLE_DUAL_WRITE === 'true';

/**
 * Normalize 2 results trước khi so sánh: bỏ field thường khác giữa 2 backend
 * (_id, ObjectId hex, timestamps có precision khác).
 */
function normalize(value) {
  if (_.isArray(value)) {
    return value.map(normalize);
  }
  if (_.isPlainObject(value)) {
    const cleaned = _.omit(value, ['_id', '__v']);
    return _.mapValues(cleaned, (v) => {
      if (v instanceof Date) return v.toISOString().slice(0, 19);
      return normalize(v);
    });
  }
  return value;
}

async function read({name, primary, shadow}) {
  const primaryResult = await primary();
  if (ENABLE_SHADOW_READ && shadow) {
    // Fire-and-forget — không await để không làm chậm response.
    Promise.resolve()
      .then(() => shadow())
      .then((shadowResult) => {
        const same = _.isEqual(normalize(primaryResult), normalize(shadowResult));
        if (!same) {
          console.warn('shadow_diff', JSON.stringify({name, primary: primaryResult, shadow: shadowResult}));
        }
      })
      .catch((err) => console.warn('shadow_read_error', name, err?.message));
  }
  return primaryResult;
}

async function write({name, primary, secondary}) {
  const primaryResult = await primary();
  if (ENABLE_DUAL_WRITE && secondary) {
    try {
      await secondary();
    } catch (err) {
      console.warn('dual_write_secondary_fail', name, err?.message);
    }
  }
  return primaryResult;
}

module.exports = {
  read,
  write,
  normalize,
  DB_PRIMARY,
  ENABLE_SHADOW_READ,
  ENABLE_DUAL_WRITE,
};
