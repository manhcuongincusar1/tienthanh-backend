// 49 rows. Junction sale + branch.
const run = require('./lib/runScript');
const {junction} = require('./lib/batch');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  await idMap.warmup('sales');
  await idMap.warmup('branches');
  return junction({
    legacyTable: 'sale_branch',
    targetTable: 'sale_branch',
    conflictCols: ['sale_id', 'branch_id'],
    mapRow: async (r) => {
      const sale_id = r.sale_id ? await idMap.get('sales', r.sale_id) : null;
      const branch_id = r.branch_id ? await idMap.get('branches', r.branch_id) : null;
      if (!sale_id || !branch_id) return null;
      return {sale_id, branch_id};
    },
  });
});
