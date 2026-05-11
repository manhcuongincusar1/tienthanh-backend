#!/usr/bin/env bash
# pg_dump → encrypt → S3 daily backup (DECISIONS E4).
# Chạy qua systemd timer (daily 03:30 Asia/Ho_Chi_Minh).
#
# Env file: /etc/tita-api/backup.env
#   POSTGRES_URL=postgresql://tita_app:<pwd>@127.0.0.1:5432/tita_prod
#   AWS_ACCESS_KEY_ID=<backup-user-key>
#   AWS_SECRET_ACCESS_KEY=<backup-user-secret>
#   AWS_REGION=ap-southeast-1
#   BACKUP_BUCKET=tienthanh-backups
#   GPG_RECIPIENT=admin@tienthanh.datviet.ai     # optional, skip nếu unset
#   TELEGRAM_BOT_TOKEN=
#   TELEGRAM_CHAT_ID=-5226544067

set -euo pipefail

source /etc/tita-api/backup.env
: "${POSTGRES_URL:?}"
: "${BACKUP_BUCKET:?}"

NOW=$(date +%Y%m%d_%H%M%S)
DOW=$(date +%u)                 # 1=Mon ... 7=Sun
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

DUMP_FILE="$TMPDIR/tita_prod_${NOW}.dump"
COMPRESSED="$DUMP_FILE.zst"

echo "[backup] pg_dump start at $(date -Is)"
pg_dump --format=custom --compress=0 --no-owner --no-privileges \
  --dbname="$POSTGRES_URL" --file="$DUMP_FILE"

SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "[backup] dump size: $SIZE"

echo "[backup] compress (zstd -19)"
zstd -19 -q --rm "$DUMP_FILE" -o "$COMPRESSED"

# Optional GPG encrypt (recommend cho PII data)
if [ -n "${GPG_RECIPIENT:-}" ]; then
  echo "[backup] gpg encrypt → $GPG_RECIPIENT"
  gpg --batch --yes --trust-model always --encrypt --recipient "$GPG_RECIPIENT" \
    --output "$COMPRESSED.gpg" "$COMPRESSED"
  rm -f "$COMPRESSED"
  COMPRESSED="$COMPRESSED.gpg"
fi

# Upload — daily/, và Chủ nhật cũng push thêm weekly/
S3_DAILY_KEY="postgres/daily/$(date +%Y/%m)/$(basename "$COMPRESSED")"
echo "[backup] upload → s3://$BACKUP_BUCKET/$S3_DAILY_KEY"
aws s3 cp "$COMPRESSED" "s3://$BACKUP_BUCKET/$S3_DAILY_KEY" \
  --storage-class STANDARD --no-progress

if [ "$DOW" = "7" ]; then
  S3_WEEKLY_KEY="postgres/weekly/$(date +%Y/%V)/$(basename "$COMPRESSED")"
  echo "[backup] upload weekly → s3://$BACKUP_BUCKET/$S3_WEEKLY_KEY"
  aws s3 cp "$COMPRESSED" "s3://$BACKUP_BUCKET/$S3_WEEKLY_KEY" \
    --storage-class STANDARD --no-progress
fi

# Verify upload
aws s3 ls "s3://$BACKUP_BUCKET/$S3_DAILY_KEY" >/dev/null

# Notify Telegram
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  MSG="[TienThanh][backup] OK $(basename "$COMPRESSED") — $SIZE"
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${MSG}" >/dev/null || true
fi

echo "[backup] done at $(date -Is)"
