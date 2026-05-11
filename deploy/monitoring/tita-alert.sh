#!/usr/bin/env bash
# Generic Telegram alert relay cho systemd OnFailure.
# /etc/tita-api/alert.env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, HOST_NAME.
set -euo pipefail

UNIT="${1:-unknown}"
HOST="${HOST_NAME:-$(hostname)}"
JOURNAL=$(journalctl -u "$UNIT" -n 20 --no-pager 2>/dev/null | tail -c 1500 || echo "")

MSG="[TienThanh][${HOST}] FAILED: ${UNIT}\n\n<pre>${JOURNAL}</pre>"

curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "parse_mode=HTML" \
  --data-urlencode "text=${MSG}" >/dev/null || true
