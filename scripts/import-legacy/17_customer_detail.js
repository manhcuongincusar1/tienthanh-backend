// 5,208 rows. FK: customer_id → customers.
// Lưu ý: legacy có `districts_id` (plural) — map sang `district_id` mới.
const run = require('./lib/runScript');
const {transform} = require('./lib/batch');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  await idMap.warmup('customers');
  return transform({
    legacyTable: 'customer_detail',
    targetTable: 'customer_detail',
    batchSize: 500,
    mapRow: async (r) => {
      const customer_id = r.customer_id ? await idMap.get('customers', r.customer_id) : null;
      if (r.customer_id && !customer_id) return null;
      return {
        price_to: r.price_to,
        price_from: r.price_from,
        district_id: r.districts_id,  // legacy plural → singular
        province_city_id: r.province_city_id,
        status: r.status,
        customer_id,
        uses: r.uses,
        note: r.note,
        created_at: r.created_at,
        modification_at: r.modification_at,
      };
    },
  });
});
