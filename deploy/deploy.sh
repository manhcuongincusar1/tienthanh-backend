#!/usr/bin/env bash
# Deploy script — chạy NHƯ ROOT trên VPS qua `sudo -E /opt/tita-api/deploy.sh`.
# Gọi từ GHA `deploy-be.yml`. Compose pattern: pull ECR image → update TITA_IMAGE
# trong /opt/tita-api/.env → systemctl restart tita-stack → health check.
#
# Env required:
#   TITA_IMAGE_TAG      — eg "prod-20260511-abc1234"
#   ECR_REGISTRY        — eg "<acct>.dkr.ecr.ap-southeast-1.amazonaws.com"
#   AWS_REGION          — ap-southeast-1
#   AWS_ACCESS_KEY_ID   — deployer key
#   AWS_SECRET_ACCESS_KEY

set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: must run as root (use sudo -E)"; exit 1
fi

: "${TITA_IMAGE_TAG:?TITA_IMAGE_TAG required}"
: "${ECR_REGISTRY:?ECR_REGISTRY required}"
: "${AWS_REGION:=ap-southeast-1}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY required}"

export AWS_REGION AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

REPO_NAME="${REPO_NAME:-tienthanh-api}"
NEW_IMAGE="${ECR_REGISTRY}/${REPO_NAME}:${TITA_IMAGE_TAG}"
ENV_FILE="/opt/tita-api/.env"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3002/health}"

echo "[deploy] target: $NEW_IMAGE"

# 1. ECR login
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

# 2. Pull
echo "[deploy] pulling..."
docker pull "$NEW_IMAGE"

# 3. Snapshot previous TITA_IMAGE
PREV_IMAGE=$(grep '^TITA_IMAGE=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "")
echo "[deploy] previous: ${PREV_IMAGE:-<none>}"

# 4. Atomic update TITA_IMAGE
TMP=$(mktemp)
cp "$ENV_FILE" "$TMP"
if grep -q '^TITA_IMAGE=' "$TMP"; then
  sed -i "s|^TITA_IMAGE=.*|TITA_IMAGE=$NEW_IMAGE|" "$TMP"
else
  echo "TITA_IMAGE=$NEW_IMAGE" >> "$TMP"
fi
mv "$TMP" "$ENV_FILE"
chmod 600 "$ENV_FILE"

# 5. Restart compose stack
systemctl restart tita-stack.service

# 6. Health check 60s window
echo "[deploy] waiting for healthy..."
for i in $(seq 1 60); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "[deploy] healthy after ${i}s"
    break
  fi
  if [ "$i" = "60" ]; then
    echo "[deploy] health FAIL — rolling back"
    if [ -n "$PREV_IMAGE" ]; then
      sed -i "s|^TITA_IMAGE=.*|TITA_IMAGE=$PREV_IMAGE|" "$ENV_FILE"
      systemctl restart tita-stack.service
      echo "[deploy] rolled back to $PREV_IMAGE"
    fi
    exit 1
  fi
  sleep 1
done

curl -fsS "$HEALTH_URL" | head -c 200; echo
echo "[deploy] OK"

# 7. Cleanup old images > 7 ngày
docker image prune -af --filter "until=168h" >/dev/null 2>&1 || true
