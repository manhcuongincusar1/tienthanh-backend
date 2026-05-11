/**
 * One-shot migration: permissions (Mongo) → role_permissions (PG).
 * 1 row per role. Idempotent: onConflict('role_id').merge.
 *
 * Usage:
 *   NODE_ENV=production node scripts/migrate/05_permissions.js
 */
const mongodbConnect = require('../../db/mongodb');
const knexPg = require('../../db/connectKnex');

(async () => {
  let total = 0;
  try {
    const db = await mongodbConnect.getDb();
    const docs = await db.collection('permissions').find({}).toArray();

    for (const doc of docs) {
      if (!doc.role_id) {
        console.warn('[migrate:permissions] skip doc no role_id', doc._id);
        continue;
      }
      await knexPg('role_permissions')
        .insert({
          role_id: Number(doc.role_id),
          title: doc.title || null,
          permission_data: doc.permission_data || {},
          updated_at: knexPg.fn.now(),
        })
        .onConflict('role_id')
        .merge({
          title: doc.title || null,
          permission_data: doc.permission_data || {},
          updated_at: knexPg.fn.now(),
        });
      total += 1;
    }

    console.log(`[migrate:permissions] done — ${total} roles`);
    process.exit(0);
  } catch (err) {
    console.error('[migrate:permissions] FAIL', err);
    process.exit(1);
  }
})();
