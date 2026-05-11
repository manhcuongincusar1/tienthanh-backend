import * as aws from "@pulumi/aws";
import { cdnDomain, commonTags } from "./config";

// CloudFront cert phải tạo ở us-east-1.
export const usEast1 = new aws.Provider("us-east-1", { region: "us-east-1" });

export const cdnCert = new aws.acm.Certificate("tienthanh-cdn-cert", {
  domainName: cdnDomain,
  validationMethod: "DNS",
  tags: commonTags,
}, { provider: usEast1 });
