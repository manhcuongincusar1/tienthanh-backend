// Rewrite cdn_path trong JSONB:
//   real_estate_details.metadata.listPath[].cdn_path
//   real_estate_historical.meta_data.detail.listPath[].cdn_path
//
// Cùng pattern 41: thay `https://<old-host>/tita-prod/files` → `<CDN_BASE>/<size>`.
const run = require('./lib/runScript');
const db = require('./lib/db');

const OLD_PREFIXES = [
  'https://cdn.logintienthanh.com/tita-prod/files',
  'https://tita-prod-2-2.s3.ap-southeast-1.amazonaws.com/tita-prod/files',
  'https://tita-prod-2-2.s3.amazonaws.com/tita-prod/files',
];

run(__filename, async () => {
  const CDN_BASE = process.env.CDN_BASE || 'https://tienthanhcdn.datviet.ai';
  const SIZE = process.env.CDN_DEFAULT_SIZE || 'large';
  const newPrefix = `${CDN_BASE.replace(/\/+$/, '')}/${SIZE}`;

  const result = {real_estate_details: {}, real_estate_historical: {}};

  for (const old of OLD_PREFIXES) {
    // real_estate_details.metadata.listPath[]
    const r1 = await db.target().raw(`
      UPDATE real_estate_details
      SET metadata = jsonb_set(
        metadata, '{listPath}',
        (
          SELECT COALESCE(jsonb_agg(
            jsonb_set(elem, '{cdn_path}',
              to_jsonb(replace(elem->>'cdn_path', ?, ?)))
          ), '[]'::jsonb)
          FROM jsonb_array_elements(metadata->'listPath') elem
        )
      )
      WHERE jsonb_typeof(metadata->'listPath') = 'array'
        AND metadata::text LIKE ?
    `, [old, newPrefix, `%${old}%`]);
    result.real_estate_details[old] = r1.rowCount || 0;

    // real_estate_historical.meta_data.detail.listPath[]
    const r2 = await db.target().raw(`
      UPDATE real_estate_historical
      SET meta_data = jsonb_set(
        meta_data, '{detail,listPath}',
        (
          SELECT COALESCE(jsonb_agg(
            jsonb_set(elem, '{cdn_path}',
              to_jsonb(replace(elem->>'cdn_path', ?, ?)))
          ), '[]'::jsonb)
          FROM jsonb_array_elements(meta_data->'detail'->'listPath') elem
        )
      )
      WHERE jsonb_typeof(meta_data->'detail'->'listPath') = 'array'
        AND meta_data::text LIKE ?
    `, [old, newPrefix, `%${old}%`]);
    result.real_estate_historical[old] = r2.rowCount || 0;
  }

  return {target_prefix: newPrefix, rewrites: result};
});
