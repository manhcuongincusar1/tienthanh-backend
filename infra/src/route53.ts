import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { apiDomain, cdnDomain, hostedZoneName, vpsIp } from "./config";
import { cdnDistribution } from "./cdn";
import { cdnCert, usEast1 } from "./acm";

const zone = aws.route53.getZone({ name: hostedZoneName });

// API → Alibaba VPS (A record)
new aws.route53.Record("tienthanhapi-a", {
  zoneId: zone.then(z => z.zoneId),
  name: apiDomain,
  type: "A",
  ttl: 300,
  records: [vpsIp],
});

// CDN → CloudFront (alias)
new aws.route53.Record("tienthanhcdn-a", {
  zoneId: zone.then(z => z.zoneId),
  name: cdnDomain,
  type: "A",
  aliases: [{
    name: cdnDistribution.domainName,
    zoneId: cdnDistribution.hostedZoneId,
    evaluateTargetHealth: false,
  }],
});

// ACM cert DNS validation
const certValidationDomain = cdnCert.domainValidationOptions[0];
const certValidationRecord = new aws.route53.Record("tienthanh-cdn-cert-validation", {
  zoneId: zone.then(z => z.zoneId),
  name: certValidationDomain.resourceRecordName,
  type: certValidationDomain.resourceRecordType,
  records: [certValidationDomain.resourceRecordValue],
  ttl: 60,
  allowOverwrite: true,
});

export const cdnCertValidation = new aws.acm.CertificateValidation("tienthanh-cdn-cert-validation", {
  certificateArn: cdnCert.arn,
  validationRecordFqdns: [certValidationRecord.fqdn],
}, { provider: usEast1 });

// FE (tienthanh.datviet.ai) — SST tạo record, KHÔNG quản lý ở Pulumi.
