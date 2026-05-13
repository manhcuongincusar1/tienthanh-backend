// 8,242 rows. Junction. 45 orphan real_estate_id → skip.
const run = require('./lib/runScript');
const {junction} = require('./lib/batch');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  await idMap.warmup('real_estate');
  await idMap.warmup('branches');
  return junction({
    legacyTable: 'real_estate_branch',
    targetTable: 'real_estate_branch',
    conflictCols: ['real_estate_id', 'branch_id'],
    batchSize: 1000,
    mapRow: async (r) => {
      const real_estate_id = r.real_estate_id ? await idMap.get('real_estate', r.real_estate_id) : null;
      const branch_id = r.branch_id ? await idMap.get('branches', r.branch_id) : null;
      if (!real_estate_id || !branch_id) return null;
      return {real_estate_id, branch_id};
    },
  });
});
