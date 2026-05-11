# Runbook 01 — Provision Alibaba VPS Singapore (2C/4G)

> Apply ONCE khi mua VPS mới. Idempotent — chạy lại OK.

## 0. Order VPS

- **Provider:** Alibaba Cloud
- **Region:** Singapore (`ap-southeast-1` đồng vùng AWS)
- **Image:** Ubuntu 22.04 LTS x86_64
- **Spec:** 2 vCPU / 4 GB RAM / 80 GB ESSD (Standard)
- **Network:** Public IP + 5 Mbps bandwidth (đủ cho 1k user)
- **Snapshot policy:** daily, retain 7

## 1. Cloud-init (tự động)

Paste nội dung `deploy/cloud-init.yml` vào field **User Data** khi tạo instance.

**Trước khi paste:** thay `ssh-ed25519 AAAA__PASTE_DEPLOY_PUBLIC_KEY_HERE__` bằng public key thật.

```bash
# Generate key (local)
ssh-keygen -t ed25519 -C "deploy@tienthanh" -f ~/.ssh/tita_deploy
cat ~/.ssh/tita_deploy.pub  # paste output vào cloud-init.yml
```

**Lưu private key** `~/.ssh/tita_deploy` vào 1Password — KHÔNG commit.

## 2. Verify cloud-init xong

```bash
ssh tita@<VPS_IP>
cat /var/log/tita-bootstrap.log   # "cloud-init OK <timestamp>"
sudo cloud-init status --wait     # status: done
```

## 3. Smoke check

```bash
# SSH harden
sudo grep -E "^(PermitRootLogin|PasswordAuthentication|AllowUsers)" /etc/ssh/sshd_config.d/99-tita.conf
# → PermitRootLogin no / PasswordAuthentication no / AllowUsers tita

# UFW
sudo ufw status
# → 22, 80, 443 ALLOW IN

# fail2ban
sudo systemctl status fail2ban
sudo fail2ban-client status sshd

# Swap
free -h | grep Swap
# → Swap: 2.0Gi

# Sysctl
sysctl vm.swappiness
# → vm.swappiness = 10
```

## 4. Provider snapshot baseline

Sau khi 1-3 OK → snapshot Alibaba console "Tita-base-clean" để rollback nhanh.

## 5. Output cho Pulumi (task 10)

Lấy public IP → update `infra/Pulumi.tienthanh-prod.yaml`:

```yaml
config:
  tienthanh-api:vpsIp: <PUBLIC_IP>
```

→ Route53 A record `tienthanhapi.datviet.ai` sẽ trỏ về IP này khi `pulumi up`.

## Rollback

```bash
# Provider console → restore snapshot "Tita-base-clean"
# hoặc destroy instance, tạo lại.
```

## Gotchas

- **Alibaba security group** mặc định mở port 22 cho `0.0.0.0/0`. UFW là layer 2 → vẫn restrict OK. Cân nhắc giới hạn security group SSH chỉ cho office IP nếu có.
- **Snapshot không backup `/swapfile`** mặc định OK — cloud-init tự tạo lại nếu mất.
- **Hostname `tita-prod`** dùng cho monitoring (BetterStack, task 09) — đừng đổi.
