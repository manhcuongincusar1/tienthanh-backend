# Runbook 05 — Install Docker + deploy Tita API

## 1. Install Docker Engine

```bash
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Add tita user vào docker group (deploy.sh dùng `sudo` cho systemd, không cần thiết — nhưng tiện debug).
sudo usermod -aG docker tita

# Install AWS CLI v2 cho ECR login.
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp
sudo /tmp/aws/install
rm -rf /tmp/awscliv2.zip /tmp/aws
```

## 2. Filesystem layout

```bash
sudo mkdir -p /opt/tita-api /etc/tita-api /var/log/tita-api
sudo chown tita:tita /opt/tita-api /var/log/tita-api
sudo chmod 750 /etc/tita-api
```

## 3. Install systemd + logrotate

```bash
sudo cp deploy/tita-api.service   /etc/systemd/system/tita-api.service
sudo cp deploy/tita-api.logrotate /etc/logrotate.d/tita-api
sudo cp deploy/deploy.sh          /opt/tita-api/deploy.sh
sudo chmod +x /opt/tita-api/deploy.sh

sudo systemctl daemon-reload
```

## 4. Render .env (1 lần)

```bash
# .env có secret — GHA sẽ render từ template + GitHub secrets task 11.
# Lần đầu manual:
sudo cp deploy/.env.production.template /opt/tita-api/.env
sudo nano /opt/tita-api/.env                    # paste secrets
sudo chown tita:tita /opt/tita-api/.env
sudo chmod 600 /opt/tita-api/.env
```

Secrets cần paste (lấy từ Pulumi `pulumi stack output --show-secrets`):
- `POSTGRES_URL` (password từ bootstrap.sql)
- `REDIS_URL` (password từ runbook_03)
- `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (appUserKey)
- `CF_KEY_PAIR_ID` + `CF_PRIVATE_KEY` (base64 của cfPrivateKeyPem)
- `S3_BUCKET=tienthanh-app-data`

## 5. First deploy (manual)

```bash
# Set ECR login env
export AWS_REGION=ap-southeast-1
export ECR_REGISTRY=<acct>.dkr.ecr.ap-southeast-1.amazonaws.com
export TITA_IMAGE_TAG=prod-<sha>     # build từ GHA hoặc push manual

sudo -E /opt/tita-api/deploy.sh
```

## 6. Verify

```bash
sudo systemctl status tita-api
docker ps | grep tita-api
curl http://127.0.0.1:3002/health             # → 200
curl https://tienthanhapi.datviet.ai/health   # → 200 (qua Caddy)

# Auto-restart test
sudo docker kill tita-api
sleep 15
sudo systemctl status tita-api                # → active again
curl http://127.0.0.1:3002/health             # → 200

# Reboot resilience
sudo reboot
# Sau khi VPS lên lại:
curl https://tienthanhapi.datviet.ai/health   # → 200
```

## 7. Sudo for tita user (cho GHA SSH deploy)

GHA SSH vào VPS bằng user `tita` rồi gọi `sudo /opt/tita-api/deploy.sh`. Cấp passwordless sudo chỉ cho deploy script:

```bash
sudo tee /etc/sudoers.d/tita-deploy <<'EOF'
tita ALL=NOPASSWD: /usr/bin/systemctl daemon-reload
tita ALL=NOPASSWD: /usr/bin/systemctl restart tita-api
tita ALL=NOPASSWD: /opt/tita-api/deploy.sh
tita ALL=NOPASSWD: /bin/tee /etc/tita-api/runtime.env.tmp
tita ALL=NOPASSWD: /bin/mv /etc/tita-api/runtime.env.tmp /etc/tita-api/runtime.env
tita ALL=NOPASSWD: /bin/sed -i * /etc/tita-api/runtime.env
EOF
sudo chmod 0440 /etc/sudoers.d/tita-deploy
sudo visudo -cf /etc/sudoers.d/tita-deploy
```

## Rollback

```bash
# Manual rollback to previous tag:
sudo systemctl stop tita-api
sudo sed -i "s|^TITA_IMAGE=.*|TITA_IMAGE=<ECR_REGISTRY>/tienthanh-api:prod-<old-sha>|" /etc/tita-api/runtime.env
sudo systemctl start tita-api
```

deploy.sh auto-rollback nếu health check fail trong 30s.

## Notes

- **--network host** → Docker container share network namespace với host. Caddy reverse proxy 127.0.0.1:3002 hoạt động natively, không cần expose port bridge.
- **--read-only + tmpfs /tmp** → defense-in-depth (DECISIONS A4 box bé, không cần writable filesystem).
- **--memory 1g** → match MemoryMax cũ trong systemd. Vượt → OOM kill, systemd restart sau 10s.
- **Pre-existing bug app.js:105 ERR_HTTP_HEADERS_SENT** — vẫn còn (CLAUDE.md scope). Sẽ thấy log nhưng không crash.
