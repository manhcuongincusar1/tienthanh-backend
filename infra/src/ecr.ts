import * as aws from "@pulumi/aws";
import { ecrRepoName, commonTags } from "./config";

export const apiRepo = new aws.ecr.Repository("tienthanh-api", {
  name: ecrRepoName,
  imageScanningConfiguration: { scanOnPush: true },
  encryptionConfigurations: [{ encryptionType: "AES256" }],
  imageTagMutability: "MUTABLE",
  forceDelete: false,
  tags: commonTags,
});

// E5b — lifecycle policy: giữ 10 image prod-*, untagged > 3 ngày xoá, > 60 ngày xoá all.
new aws.ecr.LifecyclePolicy("tienthanh-api-lifecycle", {
  repository: apiRepo.name,
  policy: JSON.stringify({
    rules: [
      {
        rulePriority: 1,
        description: "Keep last 10 prod-* images",
        selection: {
          tagStatus: "tagged",
          tagPrefixList: ["prod-"],
          countType: "imageCountMoreThan",
          countNumber: 10,
        },
        action: { type: "expire" },
      },
      {
        rulePriority: 2,
        description: "Untagged images > 3 days",
        selection: {
          tagStatus: "untagged",
          countType: "sinceImagePushed",
          countUnit: "days",
          countNumber: 3,
        },
        action: { type: "expire" },
      },
      {
        rulePriority: 3,
        description: "Any image > 60 days",
        selection: {
          tagStatus: "any",
          countType: "sinceImagePushed",
          countUnit: "days",
          countNumber: 60,
        },
        action: { type: "expire" },
      },
    ],
  }),
});

export const apiRepoUrl = apiRepo.repositoryUrl;
