import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as path from "path";
import { appDataBucket } from "./s3";
import { lambdaRole } from "./iam";
import { commonTags } from "./config";

// Build zip phải làm trước qua `lambda/image-resize/build.sh`.
// Output: lambda/image-resize/function.zip.
const lambdaZipPath = path.join(__dirname, "..", "lambda", "image-resize", "function.zip");

export const imageResizeLambda = new aws.lambda.Function("tienthanh-image-resize", {
  name: "tienthanh-image-resize",
  runtime: "nodejs20.x",
  architectures: ["arm64"],          // arm64 → ~20% rẻ hơn x86_64 cho Sharp
  handler: "index.handler",
  code: new pulumi.asset.FileArchive(lambdaZipPath),
  role: lambdaRole.arn,
  timeout: 30,
  memorySize: 1536,
  environment: {
    variables: {
      S3_BUCKET: appDataBucket.bucket,
      // D6/D7 — 2 size + WebP
      VARIANT_THUMBNAIL_WIDTH: "400",
      VARIANT_LARGE_WIDTH: "1280",
      VARIANT_QUALITY: "82",
      DELETE_ORIGINAL: "true",       // D8
    },
  },
  tags: commonTags,
});

// S3 → Lambda permission
new aws.lambda.Permission("allow-s3-invoke", {
  action: "lambda:InvokeFunction",
  function: imageResizeLambda.name,
  principal: "s3.amazonaws.com",
  sourceArn: appDataBucket.arn,
});

// AWS giới hạn 1 bucket notification config — phải gom tất cả filter vào 1 resource.
new aws.s3.BucketNotification("app-data-notification", {
  bucket: appDataBucket.id,
  lambdaFunctions: [
    {
      lambdaFunctionArn: imageResizeLambda.arn,
      events: ["s3:ObjectCreated:*"],
      filterPrefix: "uploads/",
      filterSuffix: ".jpg",
    },
    {
      lambdaFunctionArn: imageResizeLambda.arn,
      events: ["s3:ObjectCreated:*"],
      filterPrefix: "uploads/",
      filterSuffix: ".jpeg",
    },
    {
      lambdaFunctionArn: imageResizeLambda.arn,
      events: ["s3:ObjectCreated:*"],
      filterPrefix: "uploads/",
      filterSuffix: ".png",
    },
    {
      lambdaFunctionArn: imageResizeLambda.arn,
      events: ["s3:ObjectCreated:*"],
      filterPrefix: "uploads/",
      filterSuffix: ".gif",
    },
    {
      lambdaFunctionArn: imageResizeLambda.arn,
      events: ["s3:ObjectCreated:*"],
      filterPrefix: "uploads/",
      filterSuffix: ".webp",
    },
    {
      lambdaFunctionArn: imageResizeLambda.arn,
      events: ["s3:ObjectCreated:*"],
      filterPrefix: "uploads/",
      filterSuffix: ".bmp",
    },
    {
      lambdaFunctionArn: imageResizeLambda.arn,
      events: ["s3:ObjectCreated:*"],
      filterPrefix: "uploads/",
      filterSuffix: ".tiff",
    },
  ],
});

// CloudWatch log group — explicit để control retention.
new aws.cloudwatch.LogGroup("lambda-image-resize-logs", {
  name: pulumi.interpolate`/aws/lambda/${imageResizeLambda.name}`,
  retentionInDays: 30,
  tags: commonTags,
});
