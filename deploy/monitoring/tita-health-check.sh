#!/usr/bin/env bash
# Local heartbeat — chạy mỗi phút từ systemd timer.
# Check Caddy local health → fail thì alert (chống nốt nhỏ trong BetterStack uptime check).
set -euo pipefail

source /etc/tita-api/alert.env

URL="${1:-http://127.0.0.1:3002/health}"

if ! curl -fsS --max-time 5 "$URL" >/dev/null; then
  MSG="[TienThanh][$(hostname)] /health FAIL @ $(date -Is)"
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${MSG}" >/dev/null || true
  exit 1
fi

# Disk check (>90% root partition)
USAGE=$(df / | awk 'NR==2 {sub(/%/,"",$5); print $5}')
if [ "$USAGE" -gt 90 ]; then
  MSG="[TienThanh][$(hostname)] disk root ${USAGE}% @ $(date -Is)"
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${MSG}" >/dev/null || true
fi

# Memory check
MEM_PCT=$(free | awk '/^Mem:/ {printf "%.0f", $3/$2*100}')
if [ "$MEM_PCT" -gt 90 ]; then
  MSG="[TienThanh][$(hostname)] mem ${MEM_PCT}% @ $(date -Is)"
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${MSG}" >/dev/null || true
fi
