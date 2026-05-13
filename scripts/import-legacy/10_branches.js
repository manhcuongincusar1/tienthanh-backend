// 3 rows. No FK deps. ward_id/district_id/province_city_id INT đã match master data.
const run = require('./lib/runScript');
const {transform} = require('./lib/batch');

run(__filename, async () => {
  return transform({
    legacyTable: 'branches',
    targetTable: 'branches',
    mapRow: async (r) => ({
      title: r.title,
      address: r.address,
      tax: r.tax,
      ward_id: r.ward_id,
      district_id: r.district_id,
      province_city_id: r.province_city_id,
      code: r.code,
      created_at: r.created_at,
      modification_at: r.modification_at,
      status: r.status,
    }),
  });
});
