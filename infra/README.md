# Pulumi — AWS infrastructure cho TienThanh

> Sprint 4 task 10. **Không apply tự động** — chỉ apply khi sẵn sàng prod.

## Pre-flight

```bash
aws sts get-caller-identity                          # confirm đúng account
aws route53 list-hosted-zones | grep datviet.ai      # confirm zone access
pulumi login                                          # Pulumi Cloud free tier (DECISIONS A3)
```

## Init

```bash
cd tita-node-api-main/infra
npm install
pulumi stack init tienthanh-prod    # 1 lần
```

Set VPS IP (từ runbook_01):

```bash
pulumi config set tienthanh-api:vpsIp <PUBLIC_IP>
```

Set Telegram (optional):

```bash
pulumi config set --secret tienthanh-api:telegramBotToken <TOKEN>
pulumi config set --secret tienthanh-api:telegramChatId <CHAT_ID>
```

## Build Lambda zip (task 06)

```bash
cd lambda/image-resize
bash build.sh                       # → function.zip
cd ../..
```

## Deploy

```bash
pulumi preview                      # dry-run, xem diff
pulumi up                            # apply
```

## Verify outputs (paste vào BE + GHA secrets)

```bash
pulumi stack output --show-secrets --json > /tmp/tienthanh-outputs.json

# BE Node app .env
jq '.appAccessKeyId, .appSecretAccessKey, .cfKeyPairId, .cfPrivateKeyPem' /tmp/tienthanh-outputs.json

# GHA repo secrets
jq '.deployerAccessKeyId, .deployerSecretAccessKey, .ecrRepoUrl, .cdnDistributionId' /tmp/tienthanh-outputs.json

# pg_dump backup (task 08) trên VPS /etc/tita-api/backup.env
jq '.backupAccessKeyId, .backupSecretAccessKey, .backupBucketName' /tmp/tienthanh-outputs.json
```

**Xoá `/tmp/tienthanh-outputs.json` sau khi paste** — chứa secrets.

## Rollback

```bash
pulumi destroy --stack tienthanh-prod
```

⚠️ S3 bucket `tienthanh-app-data` + `tienthanh-backups` đặt `protect: true`. Muốn destroy phải:
1. `pulumi state delete --target-dependents urn:.../tienthanh-app-data --force`
2. Empty bucket bằng tay (AWS console).
3. `pulumi destroy`.

## Cost estimate

| Resource | Monthly |
|----------|---------|
| S3 storage (variants only, ~5GB) | ~$0.10 |
| S3 + CloudFront egress (10GB) | ~$1 |
| Lambda image-resize (10k req) | ~$0.50 |
| Route53 zone | $0.50 |
| SES (1k mail) | ~$0.10 |
| ACM cert | $0 |
| ECR storage (10 image) | ~$0.50 |
| CloudWatch logs | ~$0.30 |
| **Tổng AWS** | **~$3-5/tháng** |

## Resources trong stack

```
S3              tienthanh-app-data, tienthanh-backups
ECR             tienthanh-api (+ lifecycle policy)
IAM users       tienthanh-app, -deployer, -backup
IAM role        tienthanh-lambda-image-resize
Lambda          tienthanh-image-resize, tienthanh-telegram-relay
CloudFront      tienthanh-cdn (+ key group, OAC, rewrite function)
ACM             tienthanh-cdn-cert (us-east-1)
Route53         A/ALIAS records (3 domain) + DKIM/MX/SPF/DMARC
SES             tienthanh.datviet.ai identity + DKIM + MAIL FROM
SNS             tienthanh-alerts (+ 2 alarm)
CloudWatch      logs/lambda + 2 alarm Lambda
```

## Notes

- Pulumi backend: Pulumi Cloud free tier (DECISIONS A3).
- Secrets: `pulumi config set --secret`.
- Lambda code build qua `lambda/image-resize/build.sh` (Sharp arm64 binary).
- Nếu zone `datviet.ai` ở account khác → cross-account delegation; hoặc tạo NS record ở zone parent.
