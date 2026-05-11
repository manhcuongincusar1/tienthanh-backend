import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { alertEmail, telegramBotToken, telegramChatId, commonTags } from "./config";
import { imageResizeLambda } from "./lambda";

// === SNS topic — kênh chính cho alert ===
export const alertTopic = new aws.sns.Topic("tienthanh-alerts", {
  name: "tienthanh-alerts",
  tags: commonTags,
});

// Email subscription — luôn có (fallback).
new aws.sns.TopicSubscription("alert-email", {
  topic: alertTopic.arn,
  protocol: "email",
  endpoint: alertEmail,
});

// === Telegram bot relay (optional) ===
// Nếu set telegramBotToken/telegramChatId → tạo Lambda relay SNS → Telegram API.
const hasTelegram = pulumi.all([telegramBotToken, telegramChatId])
  .apply(([t, c]) => Boolean(t) && Boolean(c));

const telegramRelayRole = new aws.iam.Role("telegram-relay-role", {
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

new aws.iam.RolePolicyAttachment("telegram-relay-basic", {
  role: telegramRelayRole.name,
  policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
});

const telegramRelayCode = `
const https = require('https');
exports.handler = async (event) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  for (const rec of (event.Records || [])) {
    const sns = rec.Sns || {};
    const subject = sns.Subject || 'AWS Alert';
    const text = '[' + subject + ']\\n' + (sns.Message || '');
    await new Promise((resolve) => {
      const data = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
      const req = https.request({
        hostname: 'api.telegram.org',
        path: '/bot' + token + '/sendMessage',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      }, (res) => { res.on('data', () => {}); res.on('end', resolve); });
      req.on('error', (e) => { console.error(e); resolve(); });
      req.write(data);
      req.end();
    });
  }
};
`;

export const telegramRelay = new aws.lambda.Function("telegram-relay", {
  name: "tienthanh-telegram-relay",
  runtime: "nodejs20.x",
  architectures: ["arm64"],
  handler: "index.handler",
  timeout: 10,
  memorySize: 128,
  role: telegramRelayRole.arn,
  code: new pulumi.asset.AssetArchive({
    "index.js": new pulumi.asset.StringAsset(telegramRelayCode),
  }),
  environment: {
    variables: {
      TELEGRAM_BOT_TOKEN: telegramBotToken || pulumi.output(""),
      TELEGRAM_CHAT_ID: telegramChatId || pulumi.output(""),
    },
  },
  tags: commonTags,
});

new aws.lambda.Permission("telegram-relay-sns-perm", {
  action: "lambda:InvokeFunction",
  function: telegramRelay.name,
  principal: "sns.amazonaws.com",
  sourceArn: alertTopic.arn,
});

new aws.sns.TopicSubscription("alert-telegram", {
  topic: alertTopic.arn,
  protocol: "lambda",
  endpoint: telegramRelay.arn,
});

// === Alarms ===
new aws.cloudwatch.MetricAlarm("lambda-image-resize-errors", {
  alarmName: "tienthanh-image-resize-error-rate",
  alarmDescription: "Lambda image resize errors > 5 trong 5 phút",
  comparisonOperator: "GreaterThanThreshold",
  evaluationPeriods: 1,
  metricName: "Errors",
  namespace: "AWS/Lambda",
  period: 300,
  statistic: "Sum",
  threshold: 5,
  treatMissingData: "notBreaching",
  alarmActions: [alertTopic.arn],
  okActions: [alertTopic.arn],
  dimensions: { FunctionName: imageResizeLambda.name },
  tags: commonTags,
});

new aws.cloudwatch.MetricAlarm("lambda-image-resize-duration", {
  alarmName: "tienthanh-image-resize-duration-p99",
  alarmDescription: "Lambda image resize duration > 20s",
  comparisonOperator: "GreaterThanThreshold",
  evaluationPeriods: 3,
  metricName: "Duration",
  namespace: "AWS/Lambda",
  period: 300,
  extendedStatistic: "p99",
  threshold: 20000,
  treatMissingData: "notBreaching",
  alarmActions: [alertTopic.arn],
  dimensions: { FunctionName: imageResizeLambda.name },
  tags: commonTags,
});

export const alertTopicArn = alertTopic.arn;
