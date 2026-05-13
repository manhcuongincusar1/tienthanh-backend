// Pre-resize local 4.5GB tita-prod/ → upload thumb+large.webp lên S3 bucket Sprint 4
// (tienthanh-app-data). Skip Lambda, output thẳng vào `_resized/public/{thumbnail,large}/`.
//
// Match Lambda config Sprint 4 task 06:
//   thumbnail: 400×400 cover, webp q82
//   large:     1280w withoutEnlargement, webp q82
//
// S3 key pattern (match CF function rewrite expectation):
//   _resized/public/thumbnail/<relpath>.<ext>.webp
//   _resized/public/large/<relpath>.<ext>.webp
// Trong đó <relpath>.<ext> = path relative tới MEDIA_DIR, vd `2024/05/27file.jpg`.
//
// Idempotent: HeadObject skip-if-exists per variant.
// Errors → /tmp/upload_errors.json.
//
// Env:
//   MEDIA_DIR=/Users/nguyencuong/Desktop/TienThanh/tita-prod
//   S3_BUCKET=tienthanh-app-data
//   S3_REGION=ap-southeast-1
//   S3_KEY_PREFIX=_resized/public          (parent của /thumbnail và /large)
//   S3_KEY=...                              AWS access key
//   S3_SECRET=...                           AWS secret
//   CONCURRENCY=10                          parallel workers
//
// Chỉ chạy khi RUN_MEDIA_UPLOAD=1 (an toàn local dry-run).
const run = require('./lib/runScript');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

run(__filename, async () => {
  if (process.env.RUN_MEDIA_UPLOAD !== '1') {
    console.log('  RUN_MEDIA_UPLOAD!=1 → skip (set to enable real S3 upload)');
    return {skipped: true};
  }

  const {S3Client, HeadObjectCommand, PutObjectCommand} = require('@aws-sdk/client-s3');

  const MEDIA_DIR = process.env.MEDIA_DIR || '/Users/nguyencuong/Desktop/TienThanh/tita-prod';
  const BUCKET = process.env.S3_BUCKET || 'tienthanh-app-data';
  const REGION = process.env.S3_REGION || 'ap-southeast-1';
  const PREFIX = (process.env.S3_KEY_PREFIX || '_resized/public').replace(/^\/|\/$/g, '');
  const CONC = Number(process.env.CONCURRENCY) || 10;
  const THUMB_W = Number(process.env.VARIANT_THUMBNAIL_WIDTH || 400);
  const LARGE_W = Number(process.env.VARIANT_LARGE_WIDTH || 1280);
  const QUALITY = Number(process.env.VARIANT_QUALITY || 82);

  const s3 = new S3Client({
    region: REGION,
    credentials: process.env.S3_KEY ? {
      accessKeyId: process.env.S3_KEY,
      secretAccessKey: process.env.S3_SECRET,
    } : undefined,
  });

  // Recursively list all files
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile()) files.push(p);
    }
  }
  walk(MEDIA_DIR);
  console.log(`  ${files.length} files to process`);

  const errors = [];
  let processed = 0, skipped = 0, uploaded = 0;
  const queue = [...files];

  async function existsOnS3(key) {
    try {
      await s3.send(new HeadObjectCommand({Bucket: BUCKET, Key: key}));
      return true;
    } catch (e) {
      if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) return false;
      throw e;
    }
  }

  async function processOne(local) {
    const rel = path.relative(MEDIA_DIR, local).replace(/\\/g, '/');
    const thumbKey = `${PREFIX}/thumbnail/${rel}.webp`;
    const largeKey = `${PREFIX}/large/${rel}.webp`;

    const [thumbExists, largeExists] = await Promise.all([
      existsOnS3(thumbKey),
      existsOnS3(largeKey),
    ]);
    if (thumbExists && largeExists) {
      skipped++;
      return;
    }

    const buffer = fs.readFileSync(local);

    const tasks = [];
    if (!thumbExists) {
      tasks.push((async () => {
        const buf = await sharp(buffer)
          .rotate()
          .resize({width: THUMB_W, height: THUMB_W, fit: 'cover'})
          .webp({quality: QUALITY})
          .toBuffer();
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET, Key: thumbKey, Body: buf,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        }));
      })());
    }
    if (!largeExists) {
      tasks.push((async () => {
        const buf = await sharp(buffer)
          .rotate()
          .resize({width: LARGE_W, withoutEnlargement: true})
          .webp({quality: QUALITY})
          .toBuffer();
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET, Key: largeKey, Body: buf,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        }));
      })());
    }
    await Promise.all(tasks);
    uploaded++;
  }

  async function worker() {
    while (queue.length > 0) {
      const local = queue.shift();
      try {
        await processOne(local);
      } catch (e) {
        errors.push({file: local, error: e.message});
      }
      processed++;
      if (processed % 200 === 0) {
        console.log(`  progress: ${processed}/${files.length} (up=${uploaded} skip=${skipped} err=${errors.length})`);
      }
    }
  }

  await Promise.all(Array.from({length: CONC}, () => worker()));

  if (errors.length > 0) {
    fs.writeFileSync('/tmp/upload_errors.json', JSON.stringify(errors, null, 2));
    console.error(`  ${errors.length} errors → /tmp/upload_errors.json`);
  }
  return {uploaded, skipped, errors: errors.length, total: files.length};
});
