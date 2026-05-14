// 8,203 rows. The big one — 8 FKs + self-ref.
// FK lookup:
//   category_id → real_estate_category (id_map)
//   creator_sale_id → users (id_map) — column tên gây hiểu nhầm, thực ra trỏ users.id (100% match).
//                                       Sprint 6 ban đầu map sang sales → toàn bộ NULL, fix qua 34_creator_sale_id_backfill.js.
//   sale_id → sales (id_map) — 3,683 orphan trong legacy (0 match anywhere), NULL khi miss.
//   real_estate_status_id → real_estate_status (id_map)
//   parent_real_estate_id → real_estate (id_map) — 2-pass self-ref
//   broker_id → brokers (id_map) — 7 orphan, NULL
//   broker_phone_id → broker_phones (id_map)
//   saler_phone_id → customer_phones (id_map)
const run = require('./lib/runScript');
const {transform} = require('./lib/batch');
const db = require('./lib/db');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  // Warmup all parent tables
  for (const t of ['real_estate_category', 'sales', 'users', 'real_estate_status',
                   'brokers', 'broker_phones', 'customer_phones']) {
    await idMap.warmup(t);
  }

  const orphanCounts = {sale_id: 0, broker_id: 0, broker_phone_id: 0, saler_phone_id: 0,
                       category_id: 0, real_estate_status_id: 0, creator_sale_id: 0};

  // Pass 1: insert WITHOUT parent_real_estate_id
  const stats = await transform({
    legacyTable: 'real_estate',
    targetTable: 'real_estate',
    batchSize: 300,
    mapRow: async (r) => {
      const lookupOrNull = async (table, uuid, key) => {
        if (!uuid) return null;
        const id = await idMap.get(table, uuid);
        if (!id) orphanCounts[key]++;
        return id;
      };
      return {
        category_id: await lookupOrNull('real_estate_category', r.category_id, 'category_id'),
        title: r.title,
        creator_sale_id: await lookupOrNull('users', r.creator_sale_id, 'creator_sale_id'),
        sale_id: await lookupOrNull('sales', r.sale_id, 'sale_id'),
        ward_id: r.ward_id,
        district_id: r.district_id,
        province_city_id: r.province_city_id,
        street_id: r.street_id,
        real_estate_status_id: await lookupOrNull('real_estate_status', r.real_estate_status_id, 'real_estate_status_id'),
        status: r.status,
        address: r.address,
        goodwill: r.goodwill,
        price: r.price,
        brokerage_fees: r.brokerage_fees,
        agency: r.agency,
        type: r.type,
        code: r.code,
        is_internal: r.is_internal,
        saler_phone_id: await lookupOrNull('customer_phones', r.saler_phone_id, 'saler_phone_id'),
        full_address: r.full_address,
        location: r.location,
        broker_id: await lookupOrNull('brokers', r.broker_id, 'broker_id'),
        broker_phone_id: await lookupOrNull('broker_phones', r.broker_phone_id, 'broker_phone_id'),
        direction: r.direction,
        created_at: r.created_at,
        modification_at: r.modification_at,
        // parent_real_estate_id: NULL pass 2
      };
    },
  });

  console.log('  FK orphans:', JSON.stringify(orphanCounts));

  // Pass 2: backfill parent_real_estate_id self-ref
  const legacyRows = await db.legacy()('real_estate')
    .select('id', 'parent_real_estate_id')
    .whereNotNull('parent_real_estate_id');

  let parentBackfilled = 0, parentOrphan = 0;
  for (const r of legacyRows) {
    const newId = await idMap.get('real_estate', r.id);
    const newParent = await idMap.get('real_estate', r.parent_real_estate_id);
    if (!newId) continue;
    if (!newParent) { parentOrphan++; continue; }
    await db.target()('real_estate').where({id: newId}).update({parent_real_estate_id: newParent});
    parentBackfilled++;
  }
  console.log(`  [real_estate pass2] parent backfilled=${parentBackfilled} orphan=${parentOrphan}`);

  return {...stats, orphans: orphanCounts, parent_backfilled: parentBackfilled};
});
