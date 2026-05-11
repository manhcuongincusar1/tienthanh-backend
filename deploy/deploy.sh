#!/usr/bin/env bash
# Deploy script chạy trên VPS, được gọi từ GHA task 11.
# Idempotent. Rollback bằng cách re-run với TITA_IMAGE_TAG cũ.
#
# Usage (local SSH debug):
#   sudo TITA_IMAGE_TAG=prod-abc1234 /opt/tita-api/deploy.sh
#
# Env required (GHA truyền qua SSH):
#   TITA_IMAGE_TAG      — tag git SHA (vd "prod-abc1234")
#   ECR_REGISTRY        — eg "<acct>.dkr.ecr.ap-southeast-1.amazonaws.com"
#   AWS_REGION          — ap-southeast-1
#   AWS_ACCESS_KEY_ID   — deployer key (cho ecr get-login-password)
#   AWS_SECRET_ACCESS_KEY

set -euo pipefail

: "${TITA_IMAGE_TAG:?TITA_IMAGE_TAG required}"
: "${ECR_REGISTRY:?ECR_REGISTRY required}"
: "${AWS_REGION:=ap-southeast-1}"

REPO_NAME="${REPO_NAME:-tienthanh-api}"
NEW_IMAGE="${ECR_REGISTRY}/${REPO_NAME}:${TITA_IMAGE_TAG}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3002/health}"
RUNTIME_ENV="/etc/tita-api/runtime.env"

echo "[deploy] target image: $NEW_IMAGE"

# 1. ECR login
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

# 2. Pull new image
echo "[deploy] pulling..."
docker pull "$NEW_IMAGE"

# 3. Capture previous image (rollback)
PREV_IMAGE=$(grep '^TITA_IMAGE=' "$RUNTIME_ENV" 2>/dev/null | cut -d= -f2- || echo "")
echo "[deploy] previous: ${PREV_IMAGE:-<none>}"

# 4. Update runtime.env atomic
sudo mkdir -p /etc/tita-api
sudo tee "$RUNTIME_ENV.tmp" >/dev/null <<EOF
TITA_IMAGE=$NEW_IMAGE
TITA_IMAGE_TAG=$TITA_IMAGE_TAG
DEPLOYED_AT=$(date -Is)
EOF
sudo mv "$RUNTIME_ENV.tmp" "$RUNTIME_ENV"

# 5. Restart systemd unit (graceful drain qua docker stop -t 30)
sudo systemctl daemon-reload
sudo systemctl restart tita-api

# 6. Health check (30s window)
echo "[deploy] waiting for healthy..."
for i in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "[deploy] healthy after ${i}s"
    break
  fi
  if [ "$i" = "30" ]; then
    echo "[deploy] health check FAILED after 30s — rolling back"
    if [ -n "$PREV_IMAGE" ]; then
      sudo sed -i "s|^TITA_IMAGE=.*|TITA_IMAGE=$PREV_IMAGE|" "$RUNTIME_ENV"
      sudo systemctl restart tita-api
      echo "[deploy] rolled back to $PREV_IMAGE"
    fi
    exit 1
  fi
  sleep 1
done

# 7. Smoke
curl -fsS "$HEALTH_URL" | head -c 200
echo
echo "[deploy] OK"

# 8. Cleanup: giữ 3 image cuối trên local disk.
docker image prune -af --filter "until=168h"  # > 7 ngày
