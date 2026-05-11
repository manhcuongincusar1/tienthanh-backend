// Tienthanh AWS infra — entry point.
// Run: pulumi up --stack tienthanh-prod
//
// Module order:
//   s3 → ecr → iam → acm → lambda → cdn → route53 → ses → alerts → outputs
//
// Mỗi module export resource cần thiết. outputs.ts gom export Pulumi.

import "./src/s3";
import "./src/ecr";
import "./src/iam";
import "./src/acm";
import "./src/lambda";
import "./src/cdn";
import "./src/route53";
import "./src/ses";
import "./src/alerts";

export { outputs } from "./src/outputs";
