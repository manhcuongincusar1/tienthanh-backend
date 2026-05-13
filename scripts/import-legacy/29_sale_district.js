// 882 rows. sale_id UUID → INT. districts_id INT đã match (preserve plural per knex schema).
const run = require('./lib/runScript');
const {junction} = require('./lib/batch');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  await idMap.warmup('sales');
  return junction({
    legacyTable: 'sale_district',
    targetTable: 'sale_district',
    conflictCols: ['sale_id', 'districts_id'],
    batchSize: 1000,
    mapRow: async (r) => {
      const sale_id = r.sale_id ? await idMap.get('sales', r.sale_id) : null;
      if (!sale_id) return null;
      return {sale_id, districts_id: r.districts_id};
    },
  });
});
