// 13,130 rows. No FK. cdn_path GIỮ host cũ — task_07 rewrite sau khi upload S3.
const run = require('./lib/runScript');
const {transform} = require('./lib/batch');

run(__filename, async () => {
  return transform({
    legacyTable: 'media',
    targetTable: 'media',
    batchSize: 1000,
    mapRow: async (r) => ({
      path: r.path,
      title: r.title,
      extension: r.extension,
      cdn_path: r.cdn_path,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }),
  });
});
