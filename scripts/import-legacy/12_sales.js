// 49 rows. FK: user_id → users (id_map['users']).
const run = require('./lib/runScript');
const {transform} = require('./lib/batch');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  return transform({
    legacyTable: 'sales',
    targetTable: 'sales',
    mapRow: async (r) => {
      const user_id = await idMap.get('users', r.user_id);
      if (r.user_id && !user_id) {
        console.warn(`  [sales] orphan user_id ${r.user_id} → NULL`);
      }
      return {
        user_id,
        type: r.type,
        sell_price_from: r.sell_price_from,
        sell_price_to: r.sell_price_to,
        rent_price_from: r.rent_price_from,
        rent_price_to: r.rent_price_to,
        created_at: r.created_at,
        modification_at: r.modification_at,
        status: r.status,
      };
    },
  });
});
