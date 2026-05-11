import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION });

const BUCKET = process.env.S3_BUCKET;
const THUMB_W = Number(process.env.VARIANT_THUMBNAIL_WIDTH || 400);
const LARGE_W = Number(process.env.VARIANT_LARGE_WIDTH || 1280);
const QUALITY = Number(process.env.VARIANT_QUALITY || 82);
const DELETE_ORIGINAL = (process.env.DELETE_ORIGINAL || 'true') === 'true';

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
]);

const KEY_PATTERN = /^uploads\/(public|private)\/(.+)\.([^.]+)$/;
const EXT_PATTERN = /^(jpe?g|png|gif|webp|bmp|tiff?)$/i;

async function streamToBuffer(stream) {
  if (stream && typeof stream.transformToByteArray === 'function') {
    return Buffer.from(await stream.transformToByteArray());
  }
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks);
}

async function processOne(key) {
  const match = key.match(KEY_PATTERN);
  if (!match) {
    console.log(`skip non-upload key: ${key}`);
    return;
  }
  const [, visibility, baseKey, ext] = match;
  if (!EXT_PATTERN.test(ext)) {
    console.log(`skip unsupported ext: ${key}`);
    return;
  }

  const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const buffer = await streamToBuffer(obj.Body);

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_MIMES.has(detected.mime)) {
    console.error(`magic_bytes_mismatch key=${key} detected=${detected ? detected.mime : 'unknown'}`);
    return;
  }

  const [thumbnail, large] = await Promise.all([
    sharp(buffer)
      .rotate()
      .resize({ width: THUMB_W, height: THUMB_W, fit: 'cover' })
      .webp({ quality: QUALITY })
      .toBuffer(),
    sharp(buffer)
      .rotate()
      .resize({ width: LARGE_W, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer(),
  ]);

  await Promise.all([
    s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: `_resized/${visibility}/thumbnail/${baseKey}.webp`,
      Body: thumbnail,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    })),
    s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: `_resized/${visibility}/large/${baseKey}.webp`,
      Body: large,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    })),
  ]);

  if (DELETE_ORIGINAL) {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  }

  console.log(`resized key=${key} visibility=${visibility} thumb=${thumbnail.length} large=${large.length} originalDeleted=${DELETE_ORIGINAL}`);
}

export const handler = async (event) => {
  const records = (event && event.Records) || [];
  for (const r of records) {
    const key = decodeURIComponent(r.s3.object.key.replace(/\+/g, ' '));
    try {
      await processOne(key);
    } catch (err) {
      // Throw → Lambda retry sẽ trigger (S3 event 2 lần). Sau retry vẫn fail → CloudWatch alarm.
      console.error(`failed key=${key} err=${err && err.message}`);
      throw err;
    }
  }
};
