# Runbook 09 — Monitoring basic (DECISIONS E6, E7)

## Strategy

| Layer | Tool | What |
|-------|------|------|
| **External uptime** | BetterStack (free 10 monitor) | HTTPS check 3 phút từ 5 region |
| **Process** | systemd `OnFailure=` | unit fail → tita-alert@.service → Telegram |
| **App health** | tita-health.timer | curl /health, disk, mem mỗi phút |
| **AWS Lambda** | CloudWatch alarm (Pulumi `alerts.ts`) | error rate, duration p99 |
| **Backup** | tita-backup OnFailure | fail → Telegram |
| **Log** | journald | 2GB rotation 30 ngày |

## Setup steps

### 1. Telegram bot

Tạo bot (BotFather):
- `/newbot` → tên `TienThanh Alert`
- Bot token → save 1Password
- Add bot vào group `-5226544067` (đã có)
- `chat_id`: gửi msg đến bot, `curl https://api.telegram.org/bot<TOKEN>/getUpdates` → lấy chat.id

### 2. Apply alert env

```bash
sudo tee /etc/tita-api/alert.env <<EOF
TELEGRAM_BOT_TOKEN=<BOT_TOKEN>
TELEGRAM_CHAT_ID=-5226544067
HOST_NAME=tita-prod-sg
EOF
sudo chown root:root /etc/tita-api/alert.env
sudo chmod 600 /etc/tita-api/alert.env

sudo install -m 0755 deploy/monitoring/tita-alert.sh        /usr/local/bin/
sudo install -m 0755 deploy/monitoring/tita-health-check.sh /usr/local/bin/

sudo cp deploy/monitoring/tita-alert@.service /etc/systemd/system/
sudo cp deploy/monitoring/tita-health.service /etc/systemd/system/
sudo cp deploy/monitoring/tita-health.timer   /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now tita-health.timer
sudo systemctl list-timers tita-health.timer
```

### 3. journald cap

```bash
sudo mkdir -p /etc/systemd/journald.conf.d
sudo cp deploy/monitoring/journald.conf /etc/systemd/journald.conf.d/tita.conf
sudo systemctl restart systemd-journald
sudo journalctl --disk-usage     # < 2G
```

### 4. BetterStack uptime

Free account: https://uptime.betterstack.com
- Monitor 1: `GET https://tienthanhapi.datviet.ai/health` mỗi 3 phút, expect 200, expect body contains `"ok"`.
- Monitor 2: `GET https://tienthanh.datviet.ai/` mỗi 5 phút.
- Monitor 3: `GET https://tienthanhcdn.datviet.ai/large/<test-key>` mỗi 5 phút.
- Notification → Telegram bot (BetterStack webhook → Telegram).

### 5. CloudWatch (đã setup Pulumi task 10)

Alarms:
- `tienthanh-image-resize-error-rate` (> 5 errors / 5 phút)
- `tienthanh-image-resize-duration-p99` (> 20s)
- SNS `tienthanh-alerts` → Lambda `tienthanh-telegram-relay` → group.

### 6. Test alerts

```bash
# Trigger app fail
sudo docker kill tita-api
# → tita-health.timer fire trong 60s → Telegram MSG.

# Trigger systemd unit fail
sudo systemctl start tita-alert@test-fake-unit.service
# → Telegram nhận msg test.
```

## pg_stat_statements weekly review

Cron weekly task 09 (đề xuất, optional):

```bash
sudo crontab -u postgres -e
0 9 * * 1   psql -d tita_prod -c "SELECT round(total_exec_time::numeric, 0) ms, calls, query FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;" | mail -s "[TienThanh] PG slow queries weekly" lead@datviet.ai
```

## Acceptance

- [ ] Bot post test message vào group `-5226544067` OK.
- [ ] `sudo docker kill tita-api` → Telegram alert trong < 2 phút.
- [ ] `sudo systemctl start tita-alert@fake.service` → message với journal tail.
- [ ] BetterStack 3 monitor xanh.
- [ ] `journalctl --disk-usage` < 2G sau 30 ngày.

## Anti-noise

- tita-health.timer alert chỉ khi disk > 90% / mem > 90% / health fail — không spam.
- BetterStack: confirm 2/5 region fail trước khi alert (giảm false positive).
- Telegram bot có thể bị Telegram rate limit ~30 msg/giây — KHÔNG concern cho monitoring use case.
