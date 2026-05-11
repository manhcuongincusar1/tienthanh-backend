import * as pulumi from "@pulumi/pulumi";

const cfg = new pulumi.Config();

export const projectName = cfg.require("projectName");
export const env = cfg.require("env");
export const hostedZoneName = cfg.require("hostedZoneName");
export const apiDomain = cfg.require("apiDomain");
export const feDomain = cfg.require("feDomain");
export const cdnDomain = cfg.require("cdnDomain");
export const sesDomain = cfg.require("sesDomain");
export const vpsIp = cfg.require("vpsIp");
export const appDataBucketName = cfg.require("appDataBucketName");
export const backupBucketName = cfg.require("backupBucketName");
export const ecrRepoName = cfg.require("ecrRepoName");
export const alertEmail = cfg.require("alertEmail");
export const telegramBotToken = cfg.getSecret("telegramBotToken");
export const telegramChatId = cfg.getSecret("telegramChatId");

export const commonTags = {
  ManagedBy: "Pulumi",
  Project: projectName,
  Env: env,
};
