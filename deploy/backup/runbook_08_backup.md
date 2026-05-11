# Runbook 08 — pg_dump daily backup → S3

> pgBackRest PITR đã **drop** (overkill cho server nhỏ). Granularity = 1 ngày.

## 1. Install deps

```bash
sudo apt install -y zstd gnupg awscli
```

## 2. Apply config

```bash
# Env file
sudo mkdir -p /etc/tita-api
sudo tee /etc/tita-api/backup.env <<EOF
POSTGRES_URL=postgresql://tita_app:__PG_PWD__@127.0.0.1:5432/tita_prod
AWS_ACCESS_KEY_ID=__BACKUP_USER_KEY__
AWS_SECRET_ACCESS_KEY=__BACKUP_USER_SECRET__
AWS_REGION=ap-southeast-1
BACKUP_BUCKET=tienthanh-backups
TELEGRAM_BOT_TOKEN=__BOT__
TELEGRAM_CHAT_ID=-5226544067
EOF
sudo chown postgres:postgres /etc/tita-api/backup.env
sudo chmod 600 /etc/tita-api/backup.env

# Install script + units
sudo install -m 0755 deploy/backup/tita-backup.sh /usr/local/bin/tita-backup.sh
sudo cp deploy/backup/tita-backup.service /etc/systemd/system/
sudo cp deploy/backup/tita-backup.timer   /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now tita-backup.timer
sudo systemctl list-timers tita-backup.timer
```

## 3. Test first backup

```bash
sudo systemctl start tita-backup.service
sudo journalctl -u tita-backup.service -f
# → /var/log/tita-api/backup.log
# → s3://tienthanh-backups/postgres/daily/YYYY/MM/*.dump.zst
```

## 4. Verify Telegram alert (fail case)

```bash
# Tạm break env để test alert
sudo sed -i 's|tienthanh-backups|tienthanh-backups-nonexist|' /etc/tita-api/backup.env
sudo systemctl start tita-backup.service
# → Telegram message FAIL với journal tail
# Khôi phục
sudo sed -i 's|tienthanh-backups-nonexist|tienthanh-backups|' /etc/tita-api/backup.env
```

## 5. Restore

Xem `deploy/backup/restore-runbook.md` — download S3, gpg decrypt (nếu có), zstd, pg_restore vào staging DB, swap.

## Retention (Pulumi `infra/src/s3.ts`)

- `daily/`: Standard 30d → STANDARD_IA → GLACIER 90d → delete 180d
- `weekly/`: Standard 60d → GLACIER → delete 365d

## Cost

- ~2GB dump compressed × 30 ngày = 60GB STANDARD ~$1.40/tháng.
- Sau lifecycle Glacier: ~$0.05/tháng.

## Rollback

```bash
sudo systemctl disable --now tita-backup.timer
```

## Khi nào cần PITR thật?

Nếu data quan trọng + RPO < 1 ngày → review lại pgBackRest:
- Setup: 1 ngày.
- Cost: thêm ~$0.30/tháng WAL.
- Restore xuống giây trong window 7 ngày.

Hiện tại pg_dump daily đủ cho RPO 24h. Đủ với small business app.
