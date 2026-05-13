// 117 rows. Junction. 100% sale_id orphan + 2 real_estate_id orphan.
// Likely migrate 0 rows total — confirmed via task 03 inventory.
const run = require('./lib/runScript');
const {junction} = require('./lib/batch');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  await idMap.warmup('real_estate');
  await idMap.warmup('sales');
  return junction({
    legacyTable: 'real_estate_subscribe',
    targetTable: 'real_estate_subscribe',
    conflictCols: ['real_estate_id', 'sale_id'],
    batchSize: 500,
    mapRow: async (r) => {
      const real_estate_id = r.real_estate_id ? await idMap.get('real_estate', r.real_estate_id) : null;
      const sale_id = r.sale_id ? await idMap.get('sales', r.sale_id) : null;
      if (!real_estate_id || !sale_id) return null;
      return {real_estate_id, sale_id};
    },
  });
});
