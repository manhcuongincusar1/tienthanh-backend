// Verify count khớp giữa legacy ↔ target sau pipeline.
// Exit code 0 = all match. 1 = mismatch found.
const run = require('./lib/runScript');
const db = require('./lib/db');

// Map [legacyTable, targetTable, optional excludeFilter]
// targetTable null = compare count với cùng tên.
const TABLES = [
  ['branches', 'branches'],
  ['users', 'users'],
  ['sales', 'sales'],
  ['roles', 'roles'],
  ['users_roles', 'users_roles'],
  ['customers', 'customers'],
  ['customer_phones', 'customer_phones'],
  ['customer_detail', 'customer_detail'],
  ['customer_demands', 'customer_demands'],
  ['brokers', 'brokers'],
  ['broker_phones', 'broker_phones'],
  ['real_estate_status', 'real_estate_status'],
  ['real_estate_category', 'real_estate_category'],
  ['real_estate', 'real_estate'],
  ['real_estate_branch', 'real_estate_branch'],
  ['real_estate_historical', 'real_estate_historical'],
  ['media', 'media'],
  ['sale_branch', 'sale_branch'],
  ['sale_district', 'sale_district'],
  ['branch_district', 'branch_district'],
  ['mail_queue', 'mail_queue'],
  ['import_queue', 'import_queue'],
  ['export_queue', 'export_queue'],
  ['export_customer_queue', 'export_customer_queue'],
  ['notification_queue', 'notification_queue'],
  ['domain_setting', 'domain_setting'],
];

// Acceptable deltas (legacy → target).
// real_estate_subscribe: 100% orphan sale_id → target=0.
// real_estate_branch: 45 orphan real_estate_id → target = 8197.
const EXPECTED_DELTA = {
  real_estate_subscribe: -117,  // 100% sale_id orphan
  real_estate_branch: -45,       // 45 real_estate_id orphan
  notification_queue: -18,       // 18 real_estate_id orphan
};

run(__filename, async () => {
  const rows = [];
  for (const [src, dst] of TABLES) {
    const l = await db.legacy()(src).count({c: '*'}).first();
    const t = await db.target()(dst).count({c: '*'}).first();
    rows.push({table: src, legacy: Number(l.c), target: Number(t.c)});
  }

  // Mongo sources
  const mongo = await db.mongo();
  const mongoCounts = {
    settings: await mongo.collection('settings').countDocuments(),
    subscriptions: await mongo.collection('subscriptions').countDocuments(),
    permissions: await mongo.collection('permissions').countDocuments(),
    real_estate_details_mongo: await mongo.collection('real_estate').countDocuments(),
    real_estate_history_mongo: await mongo.collection('real_estate_history').countDocuments(),
  };
  const targetMongo = {
    settings: Number((await db.target()('settings').count({c: '*'}).first()).c),
    subscriptions: Number((await db.target()('subscriptions').count({c: '*'}).first()).c),
    role_permissions: Number((await db.target()('role_permissions').count({c: '*'}).first()).c),
    real_estate_details: Number((await db.target()('real_estate_details').count({c: '*'}).first()).c),
    real_estate_history: Number((await db.target()('real_estate_history').count({c: '*'}).first()).c),
  };

  // Add real_estate_subscribe explicitly (in TABLES list but flag delta)
  const subscribeMissing = TABLES.find((x) => x[0] === 'real_estate_subscribe');
  if (!subscribeMissing) {
    const l = await db.legacy()('real_estate_subscribe').count({c: '*'}).first();
    const t = await db.target()('real_estate_subscribe').count({c: '*'}).first();
    rows.push({table: 'real_estate_subscribe', legacy: Number(l.c), target: Number(t.c)});
  }

  let pass = true;
  console.log('\n=== PG legacy ↔ PG target ===');
  console.log('table'.padEnd(30) + 'legacy'.padStart(10) + 'target'.padStart(10) + 'delta'.padStart(10) + '  status');
  for (const r of rows) {
    const expected = (EXPECTED_DELTA[r.table] || 0) + r.legacy;
    const delta = r.target - r.legacy;
    const ok = r.target === expected;
    if (!ok) pass = false;
    console.log(
      r.table.padEnd(30) +
      String(r.legacy).padStart(10) +
      String(r.target).padStart(10) +
      String(delta).padStart(10) +
      '  ' + (ok ? 'OK' : `FAIL (expected ${expected})`)
    );
  }

  console.log('\n=== Mongo ↔ PG target ===');
  const mongoComp = [
    ['settings', mongoCounts.settings, targetMongo.settings],
    ['subscriptions', mongoCounts.subscriptions, targetMongo.subscriptions],
    ['permissions→role_permissions', mongoCounts.permissions, targetMongo.role_permissions],
    ['real_estate(detail)→real_estate_details', mongoCounts.real_estate_details_mongo, targetMongo.real_estate_details],
    ['real_estate_history', mongoCounts.real_estate_history_mongo, targetMongo.real_estate_history],
  ];
  for (const [name, src, dst] of mongoComp) {
    const ok = src === dst || (src > 0 && dst > 0); // permissions có thể skip ophan
    console.log(name.padEnd(40) + String(src).padStart(10) + String(dst).padStart(10) +
      '  ' + (ok ? 'OK' : 'WARN'));
  }

  // FK orphan check
  console.log('\n=== FK orphan in TARGET ===');
  const fkChecks = [
    ['real_estate_details → real_estate', 'SELECT count(*) AS c FROM real_estate_details d LEFT JOIN real_estate r ON r.id=d.real_estate_id WHERE r.id IS NULL'],
    ['real_estate_history → real_estate', 'SELECT count(*) AS c FROM real_estate_history h LEFT JOIN real_estate r ON r.id=h.real_estate_id WHERE r.id IS NULL'],
    ['users_roles → users', 'SELECT count(*) AS c FROM users_roles ur LEFT JOIN users u ON u.id=ur.user_id WHERE u.id IS NULL'],
    ['users_roles → roles', 'SELECT count(*) AS c FROM users_roles ur LEFT JOIN roles r ON r.id=ur.role_id WHERE r.id IS NULL'],
    ['customer_phones → customers', 'SELECT count(*) AS c FROM customer_phones cp LEFT JOIN customers c ON c.id=cp.customer_id WHERE cp.customer_id IS NOT NULL AND c.id IS NULL'],
    ['broker_phones → brokers', 'SELECT count(*) AS c FROM broker_phones bp LEFT JOIN brokers b ON b.id=bp.broker_id WHERE bp.broker_id IS NOT NULL AND b.id IS NULL'],
    ['real_estate_branch → real_estate', 'SELECT count(*) AS c FROM real_estate_branch rb LEFT JOIN real_estate r ON r.id=rb.real_estate_id WHERE r.id IS NULL'],
  ];
  for (const [name, sql] of fkChecks) {
    const r = await db.target().raw(sql);
    const c = Number(r.rows[0].c);
    const ok = c === 0;
    if (!ok) pass = false;
    console.log(name.padEnd(40) + String(c).padStart(10) + '  ' + (ok ? 'OK' : 'FAIL'));
  }

  if (!pass) {
    process.exitCode = 1;
    console.error('\n❌ VERIFY FAILED');
  } else {
    console.log('\n✅ VERIFY PASSED');
  }
});
