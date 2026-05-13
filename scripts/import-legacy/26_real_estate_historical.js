// 12,111 rows. FK: creator_id → users.
// meta_data JSONB: chứa snapshot toàn bộ entity tại thời điểm + listPath images.
// KHÔNG rewrite listPath ở đây — chỉ giữ raw legacy JSONB.
const run = require('./lib/runScript');
const {transform} = require('./lib/batch');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  await idMap.warmup('users');
  return transform({
    legacyTable: 'real_estate_historical',
    targetTable: 'real_estate_historical',
    batchSize: 500,
    mapRow: async (r) => {
      const creator_id = r.creator_id ? await idMap.get('users', r.creator_id) : null;
      return {
        meta_data: r.meta_data,
        creator_id,
        created_at: r.created_at,
      };
    },
  });
});
