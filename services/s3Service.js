// S3 service — presign PUT URL (DECISIONS D1).
// AWS SDK v2 (đã có trong deps). Không add SDK v3 để tránh bloat.

const AWS = require('aws-sdk');
const Constants = require('../common/constants');

const s3 = new AWS.S3({
  accessKeyId: Constants.S3.S3_KEY,
  secretAccessKey: Constants.S3.S3_SECRET,
  region: Constants.S3.S3_REGION,
  signatureVersion: 'v4',
});

// Format YYYY/MM/DD prefix per ngày — chunked, dễ archive sau.
function datePrefix() {
  const d = new Date();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}/${m}/${day}`;
}

function randomId() {
  // 16 hex char — đủ tránh collision (16^16 / 365 days).
  return [...Array(16)]
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join('');
}

// Generate S3 key per DECISIONS D3 (public/private prefix split).
exports.buildS3Key = ({visibility = 'public', extension}) => {
  const prefix = visibility === 'private' ? 'uploads/private' : 'uploads/public';
  const id = randomId();
  const ext = extension ? extension.replace(/[^a-z0-9]/gi, '').toLowerCase() : 'bin';
  return `${prefix}/${datePrefix()}/${id}.${ext}`;
};

// Generate presigned PUT URL — FE upload trực tiếp S3.
exports.presignPut = async ({s3_key, mime, expiresSec = 300}) => {
  const params = {
    Bucket: Constants.S3.S3_BUCKET,
    Key: s3_key,
    ContentType: mime,
    Expires: expiresSec,
  };
  // ACL theo prefix:
  //  - uploads/public/* → public-read (sau Lambda resize sẽ output cho CDN)
  //  - uploads/private/* → KHÔNG set ACL (default private)
  // Tuy nhiên, presigned URL không bind ACL — FE phải gửi `x-amz-acl` header
  // hoặc bucket policy enforce. Để bucket policy lo (DECISIONS D3).
  return s3.getSignedUrlPromise('putObject', params);
};

// Generate presigned GET URL — fallback nếu CloudFront chưa setup.
exports.presignGet = async ({s3_key, expiresSec = 300}) => {
  return s3.getSignedUrlPromise('getObject', {
    Bucket: Constants.S3.S3_BUCKET,
    Key: s3_key,
    Expires: expiresSec,
  });
};
