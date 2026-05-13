// 1,013 rows. FK: broker_id → brokers.
const run = require('./lib/runScript');
const {transform} = require('./lib/batch');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  await idMap.warmup('brokers');
  return transform({
    legacyTable: 'broker_phones',
    targetTable: 'broker_phones',
    batchSize: 1000,
    mapRow: async (r) => {
      const broker_id = r.broker_id ? await idMap.get('brokers', r.broker_id) : null;
      if (r.broker_id && !broker_id) return null;
      return {
        broker_id,
        phone_number: r.phone_number,
        status: r.status,
        is_main: r.is_main,
        created_at: r.created_at,
        modification_at: r.modification_at,
      };
    },
  });
});
