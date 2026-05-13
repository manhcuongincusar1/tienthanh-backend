// Reset SERIAL sequences to MAX(id) for all SERIAL tables.
// Sau import data, sequence không tự update. INSERT mới sẽ conflict trừ khi setval.
const run = require('./lib/runScript');
const db = require('./lib/db');

const TABLES = [
  'branches', 'users', 'sales', 'roles', 'customers',
  'customer_phones', 'customer_detail', 'customer_demands',
  'brokers', 'broker_phones',
  'real_estate', 'real_estate_status', 'real_estate_category',
  'real_estate_historical', 'media',
  'export_customer_queue',
];

run(__filename, async () => {
  const result = {};
  for (const t of TABLES) {
    // Hardcoded TABLES list — safe to interpolate name.
    const row = await db.target().raw(
      `SELECT setval(pg_get_serial_sequence('${t}', 'id'),
              GREATEST(COALESCE(MAX(id),0), 1)) AS v FROM "${t}"`
    );
    result[t] = Number(row.rows[0].v);
  }
  console.log('  sequences reset:', JSON.stringify(result, null, 2));
  return result;
});
