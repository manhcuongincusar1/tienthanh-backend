import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { sesDomain, hostedZoneName, commonTags } from "./config";

const zone = aws.route53.getZone({ name: hostedZoneName });

// SES domain identity
export const sesIdentity = new aws.sesv2.EmailIdentity("tienthanh-ses", {
  emailIdentity: sesDomain,
  dkimSigningAttributes: {
    nextSigningKeyLength: "RSA_2048_BIT",
  },
  tags: commonTags,
});

// DKIM CNAME records — SES trả về 3 tokens, mỗi token 1 CNAME.
// Workaround: pulumi không hỗ trợ for-loop trực tiếp trên Output, dùng `.apply`.
sesIdentity.dkimSigningAttributes.tokens.apply(tokens => {
  if (!tokens) return;
  tokens.forEach((token, idx) => {
    new aws.route53.Record(`ses-dkim-${idx}`, {
      zoneId: zone.then(z => z.zoneId),
      name: `${token}._domainkey.${sesDomain}`,
      type: "CNAME",
      ttl: 1800,
      records: [`${token}.dkim.amazonses.com`],
    });
  });
});

// MAIL FROM domain (custom bounce subdomain)
export const sesMailFrom = new aws.sesv2.EmailIdentityMailFromAttributes("tienthanh-ses-mailfrom", {
  emailIdentity: sesIdentity.emailIdentity,
  mailFromDomain: pulumi.interpolate`mail.${sesDomain}`,
  behaviorOnMxFailure: "USE_DEFAULT_VALUE",
});

// MX cho mail.tienthanh.datviet.ai → SES inbound bounce
new aws.route53.Record("ses-mailfrom-mx", {
  zoneId: zone.then(z => z.zoneId),
  name: `mail.${sesDomain}`,
  type: "MX",
  ttl: 1800,
  records: ["10 feedback-smtp.ap-southeast-1.amazonses.com"],
});

// SPF (TXT) cho subdomain mail.*
new aws.route53.Record("ses-mailfrom-spf", {
  zoneId: zone.then(z => z.zoneId),
  name: `mail.${sesDomain}`,
  type: "TXT",
  ttl: 1800,
  records: ["v=spf1 include:amazonses.com ~all"],
});

// DMARC — recommended monitoring policy
new aws.route53.Record("ses-dmarc", {
  zoneId: zone.then(z => z.zoneId),
  name: `_dmarc.${sesDomain}`,
  type: "TXT",
  ttl: 1800,
  records: ["v=DMARC1; p=none; rua=mailto:dmarc@datviet.ai"],
});
