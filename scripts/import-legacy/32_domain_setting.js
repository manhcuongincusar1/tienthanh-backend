// 1 row legacy singleton. domain_title + branches JSONB.
// branches là array UUID legacy → remap sang INT via id_map['branches'].
//
// Ngoài ra: thêm row cho DOMAIN_URL (default 'localhost:8000') trỏ tới TẤT CẢ branches,
// để get-login-info intersect đúng khi run local dev hoặc prod (env DOMAIN_URL=...).
const run = require('./lib/runScript');
const db = require('./lib/db');
const idMap = require('./lib/idMap');

async function upsertDomain(domain_title, branchInts) {
  const branchesJson = JSON.stringify(branchInts);
  const existing = await db.target()('domain_setting').where({domain_title}).first();
  if (existing) {
    await db.target()('domain_setting')
      .where({domain_title})
      .update({branches: db.target().raw('?::jsonb', [branchesJson])});
    return 'merged';
  }
  await db.target()('domain_setting').insert({
    domain_title,
    branches: db.target().raw('?::jsonb', [branchesJson]),
  });
  return 'inserted';
}

run(__filename, async () => {
  await idMap.warmup('branches');

  // 1) Migrate legacy row(s) — remap UUID→INT.
  const rows = await db.legacy()('domain_setting').select('*');
  let inserted = 0, merged = 0;
  for (const r of rows) {
    const legacyBranches = Array.isArray(r.branches) ? r.branches : [];
    const newBranches = [];
    for (const uuid of legacyBranches) {
      const newId = await idMap.get('branches', uuid);
      if (newId != null) newBranches.push(newId);
    }
    const op = await upsertDomain(r.domain_title, newBranches);
    if (op === 'merged') merged++; else inserted++;
  }

  // 2) Ensure DOMAIN_URL row tồn tại với mọi branch hiện có.
  const domainUrl = process.env.DOMAIN_URL || 'localhost:8000';
  const allBranches = await db.target()('branches').orderBy('id').pluck('id');
  const op = await upsertDomain(domainUrl, allBranches);
  return {legacy_rows: rows.length, inserted, merged, [`${domainUrl}`]: op};
});
