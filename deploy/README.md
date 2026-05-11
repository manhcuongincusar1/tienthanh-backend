# Deploy artifacts (Sprint 2 task 05, executed in Sprint 4)

File chuẩn bị cho deployment lên VPS Alibaba Singapore 2C/4G (DECISIONS A4/A5).
**KHÔNG chạy lệnh trong file này trên local** — chỉ áp dụng khi deploy thật ở Sprint 4.

## Files

| File | Đích trên VPS |
|---|---|
| `tita-api.service` | `/etc/systemd/system/tita-api.service` |
| `tita-api.logrotate` | `/etc/logrotate.d/tita-api` |

## Install steps trên VPS

```bash
# 1. App location + user
sudo useradd -r -s /bin/false tita
sudo mkdir -p /opt/tita-api /var/log/tita-api
sudo chown tita:tita /opt/tita-api /var/log/tita-api

# 2. Deploy code (rsync / git pull / docker — Sprint 4 task chốt)
sudo -u tita rsync -av --exclude=node_modules ./ /opt/tita-api/
sudo -u tita bash -c "cd /opt/tita-api && npm ci --omit=dev"

# 3. Copy systemd + logrotate
sudo cp deploy/tita-api.service /etc/systemd/system/
sudo cp deploy/tita-api.logrotate /etc/logrotate.d/tita-api

# 4. Env
sudo -u tita cp .env.example /opt/tita-api/.env
# edit /opt/tita-api/.env — POSTGRES_URL, AWS keys, etc.

# 5. Enable + start
sudo systemctl daemon-reload
sudo systemctl enable --now tita-api
sudo systemctl status tita-api
```

## Verify

```bash
# Boot
sudo journalctl -u tita-api -f

# Auto-restart
sudo systemctl kill -s SIGKILL tita-api
# → systemd respawn trong 5s

# Reboot resilience
sudo reboot
# → check `systemctl status tita-api` sau khi server lên lại
```

## Rollback

```bash
sudo systemctl disable --now tita-api
# Quay lại chạy thủ công: sudo -u tita node /opt/tita-api/bin/www
```

## Vì sao không PM2

- Thêm 1 layer + ~50MB RAM master + chỗ fail.
- Systemd có sẵn trên Linux, restart on crash, journald log built-in.
- Cron lock không cần (DECISIONS A5: single process) → task 04 đã đơn giản hoá.

Khi nào cần cluster: review lại task 04 (in-memory lock → PG advisory lock / Redis SETNX) trước.
