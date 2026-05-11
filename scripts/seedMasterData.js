// One-shot import: master data (province/district/ward/street + translations) từ PG dump prod.
//
// Usage:
//   node scripts/seedMasterData.js <path-to-prod-dump.sql>
//   node scripts/seedMasterData.js "/Volumes/KINGSTON/source code/tita_prod/tita_28_05_2024.sql"
//
// Extract đúng 7 INSERT statements (province_city + 3 cùng nhóm + 3 translation), apply via knex.
// Idempotent: TRUNCATE master tables trước khi insert (RESTART IDENTITY giữ FK references).
// KHÔNG cascade — nếu có data tham chiếu (branches.ward_id, etc.), TRUNCATE sẽ fail.
//
// Cảnh báo: chạy trên DB dev. KHÔNG chạy trên prod.

const fs = require('fs');
const path = require('path');
const knex = require('../db/connectKnex');

const TABLES = [
  'province_city',
  'districts',
  'wards',
  'streets',
  'province_city_translation',
  'districts_translation',
  'streets_translation',
];

const TABLE_RE = TABLES.map((t) => t.replace(/_/g, '\\_')).join('|');

function extractInserts(sqlText) {
  // Match: INSERT INTO "table" (...) VALUES (...), (...), ...;
  // Multi-line VALUES list, terminator là ';' đứng riêng cuối hoặc cuối dòng.
  const out = {};
  const lines = sqlText.split('\n');
  let inTable = null;
  let buf = [];
  for (const line of lines) {
    if (!inTable) {
      const m = line.match(new RegExp(`^INSERT INTO "(${TABLES.join('|')})" \\(`));
      if (m) {
        inTable = m[1];
        buf = [line];
        if (line.trim().endsWith(';')) {
          out[inTable] = (out[inTable] || '') + buf.join('\n') + '\n';
          inTable = null;
          buf = [];
        }
      }
    } else {
      buf.push(line);
      if (line.trim().endsWith(';')) {
        out[inTable] = (out[inTable] || '') + buf.join('\n') + '\n';
        inTable = null;
        buf = [];
      }
    }
  }
  return out;
}

(async () => {
  const sqlPath = process.argv[2];
  if (!sqlPath) {
    console.error('Usage: node scripts/seedMasterData.js <path-to-prod-dump.sql>');
    process.exit(1);
  }
  if (!fs.existsSync(sqlPath)) {
    console.error(`File not found: ${sqlPath}`);
    process.exit(1);
  }

  console.log(`Reading ${sqlPath}...`);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`  size: ${(sql.length / 1024 / 1024).toFixed(1)}MB`);

  console.log('Extracting INSERT statements...');
  const inserts = extractInserts(sql);
  for (const t of TABLES) {
    if (!inserts[t]) {
      console.warn(`  WARN: no INSERT found for "${t}"`);
    } else {
      const rows = (inserts[t].match(/\),\s*\(/g) || []).length + 1;
      console.log(`  ${t}: ${rows} rows`);
    }
  }

  console.log('Truncating master tables (CASCADE OFF — fail nếu có FK)...');
  // Reverse order to handle child-parent (translation depends on parent).
  await knex.raw(
    `TRUNCATE TABLE streets_translation, streets, wards,
                    districts_translation, districts,
                    province_city_translation, province_city
     RESTART IDENTITY`,
  );

  console.log('Applying INSERTs in order...');
  for (const t of TABLES) {
    if (!inserts[t]) continue;
    process.stdout.write(`  ${t}... `);
    await knex.raw(inserts[t]);
    console.log('done');
  }

  // Re-sync sequences sau khi insert (id values từ prod có thể > current seq).
  console.log('Re-syncing sequences...');
  for (const t of TABLES) {
    const seq = `${t}_id_seq`;
    await knex.raw(
      `SELECT setval('${seq}', GREATEST((SELECT MAX(id) FROM ${t}), 1))`,
    );
  }

  // Quick count verification
  console.log('\nFinal counts:');
  for (const t of TABLES) {
    const { count } = await knex(t).count({ count: '*' }).first();
    console.log(`  ${t.padEnd(30)} ${count}`);
  }

  await knex.destroy();
})();
