import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { appDataBucketName, backupBucketName, commonTags, feDomain } from "./config";

// === App data: uploads + variants ===
export const appDataBucket = new aws.s3.BucketV2("tienthanh-app-data", {
  bucket: appDataBucketName,
  tags: commonTags,
}, { protect: true });

new aws.s3.BucketServerSideEncryptionConfigurationV2("app-data-sse", {
  bucket: appDataBucket.id,
  rules: [{
    applyServerSideEncryptionByDefault: { sseAlgorithm: "AES256" },
  }],
});

new aws.s3.BucketPublicAccessBlock("app-data-pab", {
  bucket: appDataBucket.id,
  blockPublicAcls: true,
  blockPublicPolicy: true,
  ignorePublicAcls: true,
  restrictPublicBuckets: true,
});

new aws.s3.BucketCorsConfigurationV2("app-data-cors", {
  bucket: appDataBucket.id,
  corsRules: [{
    allowedOrigins: [
      pulumi.interpolate`https://${feDomain}`,
      // Dev (optional) — bỏ comment khi cần test từ localhost.
      // "http://localhost:8000",
    ],
    allowedMethods: ["PUT", "POST", "GET", "HEAD"],
    allowedHeaders: ["*"],
    exposeHeaders: ["ETag"],
    maxAgeSeconds: 3000,
  }],
});

new aws.s3.BucketLifecycleConfigurationV2("app-data-lifecycle", {
  bucket: appDataBucket.id,
  rules: [
    // Original sau Lambda resize sẽ delete trực tiếp. Rule này là safety net:
    // nếu Lambda fail (magic bytes mismatch hay timeout), original ở `uploads/`
    // sẽ tự expire sau 7 ngày để admin có thời gian reprocess.
    {
      id: "expire-failed-uploads",
      status: "Enabled",
      filter: { prefix: "uploads/" },
      expiration: { days: 7 },
    },
    // Variants `_resized/*` không có expiration — sống mãi.
    // Abort multipart upload > 1 ngày để tránh phí storage rò rỉ.
    {
      id: "abort-multipart",
      status: "Enabled",
      filter: {},
      abortIncompleteMultipartUpload: { daysAfterInitiation: 1 },
    },
  ],
});

// === Backup bucket: pg_dump (task 08) + WAL archive (task 08b) ===
export const backupBucket = new aws.s3.BucketV2("tienthanh-backups", {
  bucket: backupBucketName,
  tags: commonTags,
}, { protect: true });

new aws.s3.BucketServerSideEncryptionConfigurationV2("backup-sse", {
  bucket: backupBucket.id,
  rules: [{
    applyServerSideEncryptionByDefault: { sseAlgorithm: "AES256" },
  }],
});

new aws.s3.BucketVersioningV2("backup-versioning", {
  bucket: backupBucket.id,
  versioningConfiguration: { status: "Enabled" },
});

new aws.s3.BucketPublicAccessBlock("backup-pab", {
  bucket: backupBucket.id,
  blockPublicAcls: true,
  blockPublicPolicy: true,
  ignorePublicAcls: true,
  restrictPublicBuckets: true,
});

new aws.s3.BucketLifecycleConfigurationV2("backup-lifecycle", {
  bucket: backupBucket.id,
  rules: [
    // E4 — daily backup: Standard 30d → Glacier 90d → delete 180d
    {
      id: "daily",
      status: "Enabled",
      filter: { prefix: "postgres/daily/" },
      transitions: [
        { days: 30, storageClass: "STANDARD_IA" },
        { days: 90, storageClass: "GLACIER" },
      ],
      expiration: { days: 180 },
    },
    {
      id: "weekly",
      status: "Enabled",
      filter: { prefix: "postgres/weekly/" },
      transitions: [{ days: 60, storageClass: "GLACIER" }],
      expiration: { days: 365 },
    },
    {
      id: "abort-multipart",
      status: "Enabled",
      filter: {},
      abortIncompleteMultipartUpload: { daysAfterInitiation: 1 },
    },
  ],
});

export const appDataBucketArn = appDataBucket.arn;
export const backupBucketArn = backupBucket.arn;
