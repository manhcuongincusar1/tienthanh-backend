import * as aws from "@pulumi/aws";
import * as tls from "@pulumi/tls";
import * as pulumi from "@pulumi/pulumi";
import { appDataBucket } from "./s3";
import { cdnCert, usEast1 } from "./acm";
import { cdnDomain, commonTags } from "./config";

// === Key group cho signed URL (D4) ===
const cfPrivateKey = new tls.PrivateKey("cf-private-key", {
  algorithm: "RSA",
  rsaBits: 2048,
});

export const cfPublicKey = new aws.cloudfront.PublicKey("tienthanh-cf-public-key", {
  name: "tienthanh-cf-public-key",
  encodedKey: cfPrivateKey.publicKeyPem,
  comment: "Used to sign URLs for private images",
});

export const cfKeyGroup = new aws.cloudfront.KeyGroup("tienthanh-cf-key-group", {
  name: "tienthanh-cf-key-group",
  items: [cfPublicKey.id],
});

export const cfPrivateKeyPem = pulumi.secret(cfPrivateKey.privateKeyPem);
export const cfKeyPairId = cfPublicKey.id;

// === Origin Access Control (modern replacement of OAI) ===
const oac = new aws.cloudfront.OriginAccessControl("tienthanh-cdn-oac", {
  name: "tienthanh-cdn-oac",
  description: "OAC for CloudFront → S3 app-data",
  originAccessControlOriginType: "s3",
  signingBehavior: "always",
  signingProtocol: "sigv4",
});

// === CloudFront function: rewrite URL theo visibility (D3) ===
const rewriteFunction = new aws.cloudfront.Function("tienthanh-rewrite", {
  name: "tienthanh-rewrite",
  runtime: "cloudfront-js-2.0",
  comment: "Rewrite /thumbnail/{key} → /_resized/public/thumbnail/{key}.webp",
  code: `
function handler(event) {
  var request = event.request;
  // Public: /thumbnail/{key} or /large/{key}
  var pub = request.uri.match(/^\\/(thumbnail|large)\\/(.+)$/);
  if (pub) {
    request.uri = '/_resized/public/' + pub[1] + '/' + pub[2] + '.webp';
    return request;
  }
  // Private signed: /_signed/thumbnail/{key} or /_signed/large/{key}
  var priv = request.uri.match(/^\\/_signed\\/(thumbnail|large)\\/(.+)$/);
  if (priv) {
    request.uri = '/_resized/private/' + priv[1] + '/' + priv[2] + '.webp';
    return request;
  }
  return request;
}
  `,
});

// === Distribution ===
export const cdnDistribution = new aws.cloudfront.Distribution("tienthanh-cdn", {
  enabled: true,
  isIpv6Enabled: true,
  httpVersion: "http2and3",
  priceClass: "PriceClass_200",     // Asia + EU + NA — bỏ SA/AU
  aliases: [cdnDomain],
  comment: "Tienthanh CDN — public + signed image",
  origins: [{
    originId: "s3-app-data",
    domainName: appDataBucket.bucketRegionalDomainName,
    originAccessControlId: oac.id,
    s3OriginConfig: { originAccessIdentity: "" },     // OAC mode, empty OAI
  }],
  // Default: public no-auth, cache 1 ngày
  defaultCacheBehavior: {
    targetOriginId: "s3-app-data",
    viewerProtocolPolicy: "redirect-to-https",
    allowedMethods: ["GET", "HEAD"],
    cachedMethods: ["GET", "HEAD"],
    compress: true,
    minTtl: 0,
    defaultTtl: 86400,
    maxTtl: 31536000,
    forwardedValues: {
      queryString: false,
      cookies: { forward: "none" },
    },
    functionAssociations: [{
      eventType: "viewer-request",
      functionArn: rewriteFunction.arn,
    }],
  },
  orderedCacheBehaviors: [
    // Private signed — trusted key group + cache 5 phút (đồng bộ signed URL TTL)
    {
      pathPattern: "/_signed/*",
      targetOriginId: "s3-app-data",
      viewerProtocolPolicy: "redirect-to-https",
      allowedMethods: ["GET", "HEAD"],
      cachedMethods: ["GET", "HEAD"],
      compress: true,
      minTtl: 0,
      defaultTtl: 300,
      maxTtl: 300,
      trustedKeyGroups: [cfKeyGroup.id],
      forwardedValues: {
        queryString: true,    // CF signed URL có query string (Policy/Signature/Key-Pair-Id)
        cookies: { forward: "none" },
      },
      functionAssociations: [{
        eventType: "viewer-request",
        functionArn: rewriteFunction.arn,
      }],
    },
  ],
  viewerCertificate: {
    acmCertificateArn: cdnCert.arn,
    sslSupportMethod: "sni-only",
    minimumProtocolVersion: "TLSv1.2_2021",
  },
  restrictions: {
    geoRestriction: { restrictionType: "none" },
  },
  tags: commonTags,
}, { dependsOn: [cdnCert] });

// === S3 bucket policy — chỉ cho CloudFront OAC đọc ===
new aws.s3.BucketPolicy("app-data-cf-policy", {
  bucket: appDataBucket.id,
  policy: pulumi.all([appDataBucket.arn, cdnDistribution.arn]).apply(([bArn, dArn]) => JSON.stringify({
    Version: "2012-10-17",
    Statement: [{
      Sid: "AllowCloudFrontServicePrincipal",
      Effect: "Allow",
      Principal: { Service: "cloudfront.amazonaws.com" },
      Action: "s3:GetObject",
      Resource: `${bArn}/*`,
      Condition: {
        StringEquals: { "AWS:SourceArn": dArn },
      },
    }],
  })),
});

export const cdnDistributionId = cdnDistribution.id;
export const cdnDistributionDomain = cdnDistribution.domainName;
