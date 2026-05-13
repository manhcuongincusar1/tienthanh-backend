// 59 rows. branch_id UUID → INT. province_id + district_id INT đã match.
const run = require('./lib/runScript');
const {junction} = require('./lib/batch');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  await idMap.warmup('branches');
  return junction({
    legacyTable: 'branch_district',
    targetTable: 'branch_district',
    conflictCols: ['branch_id', 'province_id', 'district_id'],
    batchSize: 1000,
    mapRow: async (r) => {
      const branch_id = r.branch_id ? await idMap.get('branches', r.branch_id) : null;
      if (!branch_id) return null;
      return {
        branch_id,
        province_id: r.province_id,
        district_id: r.district_id,
      };
    },
  });
});
