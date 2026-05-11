/**
 * One-shot migration: subscriptions (Mongo → PG).
 * Idempotent: onConflict('auth').ignore.
 *
 * Usage:
 *   NODE_ENV=production node scripts/migrate/04_subscriptions.js
 */
const mongodbConnect = require('../../db/mongodb');
const knexPg = require('../../db/connectKnex');

const BATCH = 500;

(async () => {
  let total = 0;
  let inserted = 0;
  try {
    const db = await mongodbConnect.getDb();
    const cursor = db.collection('subscriptions').find({});
    let batch = [];

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      total += 1;
      if (!doc.auth) {
        console.warn('[migrate:subscriptions] skip doc no auth', doc._id);
        continue;
      }
      batch.push({
        user_id: Number(doc.userId),
        auth: doc.auth,
        info: doc.info ?? {},
      });
      if (batch.length >= BATCH) {
        const res = await knexPg('subscriptions')
          .insert(batch)
          .onConflict('auth')
          .ignore();
        inserted += batch.length;
        batch = [];
        console.log(`[migrate:subscriptions] processed ${total}`);
      }
    }
    if (batch.length) {
      await knexPg('subscriptions').insert(batch).onConflict('auth').ignore();
      inserted += batch.length;
    }

    console.log(`[migrate:subscriptions] done — total=${total} attempted=${inserted}`);
    process.exit(0);
  } catch (err) {
    console.error('[migrate:subscriptions] FAIL', err);
    process.exit(1);
  }
})();
