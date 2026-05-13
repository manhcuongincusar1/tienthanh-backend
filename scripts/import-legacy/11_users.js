// 49 rows. Self-ref creator_id → 2-pass:
//  Pass 1: insert with creator_id=null
//  Pass 2: UPDATE creator_id qua id_map lookup
const run = require('./lib/runScript');
const {transform} = require('./lib/batch');
const db = require('./lib/db');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  // Pass 1
  const stats = await transform({
    legacyTable: 'users',
    targetTable: 'users',
    mapRow: async (r) => ({
      full_name: r.full_name,
      address: r.address,
      username: r.username,
      password: r.password,
      salt: r.salt,
      activation_key: r.activation_key,
      avatar: r.avatar,
      raw_phone_number: r.raw_phone_number,
      last_login: r.last_login,
      update_password: r.update_password,
      created_at: r.created_at,
      modification_at: r.modification_at,
      status: r.status,
      // creator_id: NULL — pass 2 update
    }),
  });

  // Pass 2: backfill creator_id self-ref
  const legacyRows = await db.legacy()('users')
    .select('id', 'creator_id')
    .whereNotNull('creator_id');

  let updated = 0;
  for (const r of legacyRows) {
    const newId = await idMap.get('users', r.id);
    const newCreator = await idMap.get('users', r.creator_id);
    if (!newId || !newCreator) continue;
    await db.target()('users').where({id: newId}).update({creator_id: newCreator});
    updated++;
  }
  console.log(`  [users pass2] backfilled creator_id on ${updated} rows`);
  return {...stats, creator_id_backfilled: updated};
});
