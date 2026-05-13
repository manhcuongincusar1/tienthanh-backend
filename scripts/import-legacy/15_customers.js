// 5,577 rows. FK: creator_id → users, branch_id → branches.
const run = require('./lib/runScript');
const {transform} = require('./lib/batch');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  await idMap.warmup('users');
  await idMap.warmup('branches');

  return transform({
    legacyTable: 'customers',
    targetTable: 'customers',
    batchSize: 500,
    mapRow: async (r) => {
      const creator_id = r.creator_id ? await idMap.get('users', r.creator_id) : null;
      const branch_id = r.branch_id ? await idMap.get('branches', r.branch_id) : null;
      return {
        full_name: r.full_name,
        address: r.address,
        status: r.status,
        creator_id,
        goodwill: r.goodwill,
        type: r.type,
        branch_id,
        business_status: r.business_status,
        is_share_info: r.is_share_info ?? false,
        share_info_update_at: r.share_info_update_at,
        customers_alias: r.customers_alias,
        created_at: r.created_at,
        modification_at: r.modification_at,
      };
    },
  });
});
