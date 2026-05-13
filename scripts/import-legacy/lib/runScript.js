// Helper wrap async main() với logging + cleanup chuẩn.
//
//   const run = require('./lib/runScript');
//   run(__filename, async () => { ... });

const db = require('./db');

module.exports = function run(file, main) {
  const name = require('path').basename(file).replace(/\.js$/, '');
  const t0 = Date.now();
  console.log(`[${name}] start`);
  main()
    .then((result) => {
      const took = ((Date.now() - t0) / 1000).toFixed(1);
      if (result && typeof result === 'object') {
        console.log(`[${name}] done in ${took}s`, JSON.stringify(result));
      } else {
        console.log(`[${name}] done in ${took}s`);
      }
    })
    .catch((err) => {
      console.error(`[${name}] FAIL`, err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.close();
    });
};
