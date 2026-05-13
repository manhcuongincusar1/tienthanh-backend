// 5,594 rows. FK: customer_id → customers (id_map).
const run = require('./lib/runScript');
const {transform} = require('./lib/batch');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  await idMap.warmup('customers');
  return transform({
    legacyTable: 'customer_phones',
    targetTable: 'customer_phones',
    batchSize: 1000,
    orderBy: null,   // không có created_at
    mapRow: async (r) => {
      const customer_id = r.customer_id ? await idMap.get('customers', r.customer_id) : null;
      if (r.customer_id && !customer_id) return null; // orphan skip
      return {
        customer_id,
        phone_number: r.phone_number,
        status: r.status,
        is_main: r.is_main,
      };
    },
  });
});
