# Runbook — Restore PG từ pg_dump backup (task 08)

## When to use

- Khôi phục từ điểm thời gian cụ thể (granularity = 1 ngày).
- pgBackRest (task 08b) PITR là phương án chính cho restore nhanh + granular xuống giây. Dùng pg_dump chỉ khi pgBackRest repo hỏng.

## 1. Download backup

```bash
# Liệt kê available
aws s3 ls s3://tienthanh-backups/postgres/daily/ --recursive | sort | tail -10

# Pick + download
KEY="postgres/daily/2026/05/tita_prod_20260511_033012.dump.zst.gpg"
aws s3 cp "s3://tienthanh-backups/$KEY" /tmp/restore.dump.zst.gpg
```

## 2. Decrypt (nếu có .gpg)

```bash
gpg --decrypt --output /tmp/restore.dump.zst /tmp/restore.dump.zst.gpg
rm /tmp/restore.dump.zst.gpg
```

## 3. Decompress

```bash
zstd -d /tmp/restore.dump.zst -o /tmp/restore.dump
```

## 4. Restore vào staging DB

```bash
# Tạo DB clean rồi restore
sudo -u postgres psql -c "DROP DATABASE IF EXISTS tita_restore;"
sudo -u postgres psql -c "CREATE DATABASE tita_restore OWNER tita_app;"

sudo -u postgres pg_restore \
  --dbname=tita_restore \
  --no-owner --no-privileges \
  --jobs=2 \
  /tmp/restore.dump
```

## 5. Verify

```sql
\c tita_restore
SELECT count(*) FROM users;
SELECT max(created_at) FROM real_estate;
```

## 6. Promote (nếu OK)

```bash
# Stop app
sudo systemctl stop tita-api

# Swap
sudo -u postgres psql <<'SQL'
ALTER DATABASE tita_prod    RENAME TO tita_prod_old;
ALTER DATABASE tita_restore RENAME TO tita_prod;
SQL

# Start app
sudo systemctl start tita-api
curl https://tienthanhapi.datviet.ai/health
```

Nếu fail → swap ngược lại.

## 7. Cleanup

```bash
sudo -u postgres psql -c "DROP DATABASE tita_prod_old;"
rm /tmp/restore.dump
```

## Retention

S3 lifecycle (Pulumi task 10):
- `daily/`: Standard 30d → STANDARD_IA → GLACIER 90d → delete 180d
- `weekly/`: Standard 60d → GLACIER → delete 365d
