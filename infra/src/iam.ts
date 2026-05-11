import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { appDataBucket, backupBucket } from "./s3";
import { apiRepo } from "./ecr";
import { commonTags } from "./config";

// =========================================================================
// tienthanh-app — BE Node app trên VPS
//   • S3: PutObject/GetObject/DeleteObject trên app-data
//   • SES: SendEmail/SendRawEmail (cho noreply@tienthanh.datviet.ai)
//   • KHÔNG có quyền backup bucket.
// =========================================================================
export const appUser = new aws.iam.User("tienthanh-app", {
  name: "tienthanh-app",
  tags: commonTags,
});

const appPolicyDoc = pulumi.all([appDataBucket.arn]).apply(([appArn]) => JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "S3AppData",
      Effect: "Allow",
      Action: ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:HeadObject"],
      Resource: [`${appArn}/*`],
    },
    {
      Sid: "S3ListAppData",
      Effect: "Allow",
      Action: ["s3:ListBucket"],
      Resource: [appArn],
    },
    {
      Sid: "SESSend",
      Effect: "Allow",
      Action: ["ses:SendEmail", "ses:SendRawEmail"],
      Resource: "*",
    },
  ],
}));

new aws.iam.UserPolicy("tienthanh-app-policy", {
  user: appUser.name,
  policy: appPolicyDoc,
});

export const appUserKey = new aws.iam.AccessKey("tienthanh-app-key", {
  user: appUser.name,
});

// =========================================================================
// tienthanh-deployer — GHA push ECR + invalidate CF + SST FE deploy
// =========================================================================
export const deployerUser = new aws.iam.User("tienthanh-deployer", {
  name: "tienthanh-deployer",
  tags: commonTags,
});

const deployerPolicyDoc = pulumi.all([apiRepo.arn]).apply(([repoArn]) => JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "ECRAuth",
      Effect: "Allow",
      Action: ["ecr:GetAuthorizationToken"],
      Resource: "*",
    },
    {
      Sid: "ECRRepo",
      Effect: "Allow",
      Action: [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeImages",
      ],
      Resource: repoArn,
    },
    {
      Sid: "CloudFrontInvalidate",
      Effect: "Allow",
      Action: ["cloudfront:CreateInvalidation"],
      Resource: "*",
    },
    {
      Sid: "Route53SSTNeeds",
      Effect: "Allow",
      Action: [
        "route53:ChangeResourceRecordSets",
        "route53:GetChange",
        "route53:ListHostedZones",
        "route53:ListResourceRecordSets",
      ],
      Resource: "*",
    },
    {
      Sid: "ACMRequest",
      Effect: "Allow",
      Action: [
        "acm:RequestCertificate",
        "acm:DescribeCertificate",
        "acm:DeleteCertificate",
        "acm:AddTagsToCertificate",
        "acm:ListCertificates",
      ],
      Resource: "*",
    },
    {
      Sid: "S3FERead",
      Effect: "Allow",
      Action: ["s3:*"],
      Resource: [
        "arn:aws:s3:::tienthanh-fe-prod-*",
        "arn:aws:s3:::tienthanh-fe-prod-*/*",
        "arn:aws:s3:::sstbootstrap-*",
        "arn:aws:s3:::sstbootstrap-*/*",
      ],
    },
    {
      Sid: "CloudFormationSST",
      Effect: "Allow",
      Action: ["cloudformation:*"],
      Resource: "*",
    },
    {
      Sid: "LambdaSST",
      Effect: "Allow",
      Action: [
        "lambda:CreateFunction", "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration", "lambda:GetFunction",
        "lambda:DeleteFunction", "lambda:InvokeFunction",
        "lambda:AddPermission", "lambda:RemovePermission",
        "lambda:ListVersionsByFunction", "lambda:PublishVersion",
        "lambda:CreateAlias", "lambda:UpdateAlias", "lambda:GetAlias",
      ],
      Resource: "*",
    },
    {
      Sid: "IAMPassRoleSST",
      Effect: "Allow",
      Action: ["iam:PassRole", "iam:CreateRole", "iam:AttachRolePolicy",
               "iam:PutRolePolicy", "iam:GetRole", "iam:GetRolePolicy",
               "iam:DetachRolePolicy", "iam:DeleteRolePolicy", "iam:DeleteRole"],
      Resource: "arn:aws:iam::*:role/tienthanh-fe-*",
    },
  ],
}));

new aws.iam.UserPolicy("tienthanh-deployer-policy", {
  user: deployerUser.name,
  policy: deployerPolicyDoc,
});

export const deployerUserKey = new aws.iam.AccessKey("tienthanh-deployer-key", {
  user: deployerUser.name,
});

// =========================================================================
// tienthanh-backup — task 08 pg_dump cron daily
// =========================================================================
export const backupUser = new aws.iam.User("tienthanh-backup", {
  name: "tienthanh-backup",
  tags: commonTags,
});

const backupPolicyDoc = pulumi.all([backupBucket.arn]).apply(([backupArn]) => JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "S3DumpUpload",
      Effect: "Allow",
      Action: ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
      Resource: [
        backupArn,
        `${backupArn}/postgres/daily/*`,
        `${backupArn}/postgres/weekly/*`,
      ],
    },
  ],
}));

new aws.iam.UserPolicy("tienthanh-backup-policy", {
  user: backupUser.name,
  policy: backupPolicyDoc,
});

export const backupUserKey = new aws.iam.AccessKey("tienthanh-backup-key", {
  user: backupUser.name,
});

// =========================================================================
// Lambda execution role — task 06
// =========================================================================
export const lambdaRole = new aws.iam.Role("tienthanh-lambda-image-resize-role", {
  name: "tienthanh-lambda-image-resize",
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [{
      Effect: "Allow",
      Principal: { Service: "lambda.amazonaws.com" },
      Action: "sts:AssumeRole",
    }],
  }),
  tags: commonTags,
});

new aws.iam.RolePolicyAttachment("lambda-basic-exec", {
  role: lambdaRole.name,
  policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
});

const lambdaInlinePolicyDoc = pulumi.all([appDataBucket.arn]).apply(([appArn]) => JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "S3ReadOriginalsAndWriteVariants",
      Effect: "Allow",
      Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:HeadObject"],
      Resource: [
        `${appArn}/uploads/*`,
        `${appArn}/_resized/*`,
      ],
    },
  ],
}));

new aws.iam.RolePolicy("lambda-s3-policy", {
  role: lambdaRole.id,
  policy: lambdaInlinePolicyDoc,
});
