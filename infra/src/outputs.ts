import * as pulumi from "@pulumi/pulumi";
import { appDataBucket, backupBucket } from "./s3";
import { apiRepo } from "./ecr";
import { appUserKey, deployerUserKey, backupUserKey } from "./iam";
import { cdnDistributionId, cdnDistributionDomain, cfPrivateKeyPem, cfKeyPairId } from "./cdn";
import { alertTopicArn } from "./alerts";
import { sesIdentity } from "./ses";

export const outputs = {
  appDataBucketName: appDataBucket.bucket,
  backupBucketName: backupBucket.bucket,

  ecrRepoUrl: apiRepo.repositoryUrl,
  ecrRepoArn: apiRepo.arn,

  // App user (BE Node)
  appAccessKeyId: appUserKey.id,
  appSecretAccessKey: pulumi.secret(appUserKey.secret),

  // Deployer (GHA)
  deployerAccessKeyId: deployerUserKey.id,
  deployerSecretAccessKey: pulumi.secret(deployerUserKey.secret),

  // pg_dump backup (task 08)
  backupAccessKeyId: backupUserKey.id,
  backupSecretAccessKey: pulumi.secret(backupUserKey.secret),

  // CDN
  cdnDistributionId,
  cdnDistributionDomain,

  // CF signed URL key pair
  cfKeyPairId,
  cfPrivateKeyPem,             // secret — paste vào BE env CF_PRIVATE_KEY

  // Alerts
  alertTopicArn,

  // SES
  sesIdentity: sesIdentity.emailIdentity,
};
