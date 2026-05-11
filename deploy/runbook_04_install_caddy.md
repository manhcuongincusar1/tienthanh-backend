# Runbook 04 — Install Caddy 2 + auto HTTPS

## Pre-req

- DNS `tienthanhapi.datviet.ai` đã trỏ về VPS IP (Pulumi task 10 tạo).
- Port 80 + 443 đã mở (UFW từ cloud-init).

## 1. Install Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list

sudo apt update
sudo apt install -y caddy
```

## 2. Apply Caddyfile

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile

# Log dir
sudo mkdir -p /var/log/caddy
sudo chown caddy:caddy /var/log/caddy

# Validate trước khi reload
sudo caddy validate --config /etc/caddy/Caddyfile

sudo systemctl reload caddy
sudo systemctl status caddy
```

## 3. Verify auto HTTPS

```bash
# Lần đầu: chờ 30-60s Let's Encrypt issue cert
sudo journalctl -u caddy -f | grep -E "(certificate|tls)"

# Smoke ngoài
curl -I https://tienthanhapi.datviet.ai/health
# → 200 OK + headers HSTS/X-Content-Type-Options

# HTTP → HTTPS redirect
curl -I http://tienthanhapi.datviet.ai/health
# → 308 Permanent Redirect
```

## 4. Cert renewal

Caddy tự renew 30 ngày trước expiry. Verify:

```bash
sudo cat /var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/tienthanhapi.datviet.ai/tienthanhapi.datviet.ai.json | jq '.expiration'
```

## 5. Logrotate

Caddy v2 đã có `roll_size 100mb` + `roll_keep 7` trong config → tự rotate. Không cần logrotate riêng.

## Rollback

```bash
sudo systemctl stop caddy
# Tạm thời serve qua Node trực tiếp port 80/443 (kèm sudo + setcap CAP_NET_BIND_SERVICE).
```

## Troubleshooting

| Lỗi | Fix |
|---|---|
| `bind: address already in use :80` | nginx/apache đang chạy → `sudo systemctl stop nginx apache2` |
| Let's Encrypt rate limit | 5 cert/tuần/domain. Test ở staging trước: `acme_ca https://acme-staging-v02.api.letsencrypt.org/directory` |
| Cert không issue | DNS chưa propagate. `dig tienthanhapi.datviet.ai` phải resolve về VPS IP. |
| 502 Bad Gateway | Node app chưa chạy port 3002. `sudo systemctl status tita-api`. |
