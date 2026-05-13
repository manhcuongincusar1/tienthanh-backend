// UPDATE media.cdn_path: thay host cũ + path prefix → CDN mới.
//
// Old: https://cdn.logintienthanh.com/tita-prod/files/2024/05/27file.jpg
// New: https://tienthanhcdn.datviet.ai/large/2024/05/27file.jpg
//
// CF function tự rewrite /large/{key} → _resized/public/large/{key}.webp (Sprint 4 task 10).
// Idempotent qua WHERE LIKE old prefix.
const run = require('./lib/runScript');
const db = require('./lib/db');

const OLD_PREFIXES = [
  'https://cdn.logintienthanh.com/tita-prod/files',
  'https://tita-prod-2-2.s3.ap-southeast-1.amazonaws.com/tita-prod/files',
  'https://tita-prod-2-2.s3.amazonaws.com/tita-prod/files',
];

run(__filename, async () => {
  const CDN_BASE = process.env.CDN_BASE || 'https://tienthanhcdn.datviet.ai';
  const SIZE = process.env.CDN_DEFAULT_SIZE || 'large';   // 'large' | 'thumbnail'
  const newPrefix = `${CDN_BASE.replace(/\/+$/, '')}/${SIZE}`;

  const result = {};
  for (const old of OLD_PREFIXES) {
    const r = await db.target().raw(`
      UPDATE media SET cdn_path = replace(cdn_path, ?, ?)
      WHERE cdn_path LIKE ?
    `, [old, newPrefix, `${old}%`]);
    result[old] = r.rowCount || 0;
  }
  return {target_prefix: newPrefix, rewrites_by_old_prefix: result};
});
