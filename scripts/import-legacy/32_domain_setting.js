// 1 row singleton. (domain_title, branches JSONB)
const run = require('./lib/runScript');
const db = require('./lib/db');

run(__filename, async () => {
  const rows = await db.legacy()('domain_setting').select('*');
  let inserted = 0, merged = 0;
  for (const r of rows) {
    // branches là JSONB — stringify để pg driver bind đúng (không qua array text format).
    const branchesJson = JSON.stringify(r.branches);
    const existing = await db.target()('domain_setting').where({domain_title: r.domain_title}).first();
    if (existing) {
      await db.target()('domain_setting')
        .where({domain_title: r.domain_title})
        .update({branches: db.target().raw('?::jsonb', [branchesJson])});
      merged++;
    } else {
      await db.target()('domain_setting').insert({
        domain_title: r.domain_title,
        branches: db.target().raw('?::jsonb', [branchesJson]),
      });
      inserted++;
    }
  }
  return {inserted, merged, total: rows.length};
});
