#!/usr/bin/env bash
# Manual provisioning script — apply hardening trên server đã chạy (không boot via cloud-init).
# Source of truth vẫn là cloud-init.yml. Script này adapt: user `admin` (Alibaba default) thay `tita`.
# Idempotent — chạy lại OK.
#
# Usage trên server:
#   sudo bash /tmp/provision.sh

set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: must run as root (sudo bash $0)"
  exit 1
fi

echo "==> 1. hostname + timezone"
hostnamectl set-hostname tita-prod
timedatectl set-timezone Asia/Ho_Chi_Minh
sed -i '/^127\.0\.1\.1/d' /etc/hosts
echo "127.0.1.1 tita-prod tita-prod.localdomain" >> /etc/hosts

echo "==> 2. apt update + packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  ufw fail2ban unattended-upgrades \
  curl htop ncdu ca-certificates gnupg lsb-release rsync git jq

echo "==> 3. SSH hardening (AllowUsers admin)"
cat > /etc/ssh/sshd_config.d/99-tita.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
KbdInteractiveAuthentication no
AllowUsers admin
ClientAliveInterval 300
ClientAliveCountMax 2
MaxAuthTries 3
LoginGraceTime 30
EOF
chmod 644 /etc/ssh/sshd_config.d/99-tita.conf
sshd -t
systemctl restart ssh

echo "==> 4. fail2ban sshd jail"
cat > /etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
port = 22
filter = sshd
logpath = %(sshd_log)s
backend = %(sshd_backend)s
maxretry = 3
bantime = 3600
findtime = 600
EOF
chmod 644 /etc/fail2ban/jail.d/sshd.local
systemctl enable --now fail2ban
systemctl restart fail2ban

echo "==> 5. unattended-upgrades"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
systemctl enable unattended-upgrades

echo "==> 6. sysctl tuning"
cat > /etc/sysctl.d/99-tita.conf <<'EOF'
vm.swappiness=10
vm.overcommit_memory=1
net.ipv4.tcp_syncookies=1
net.ipv4.conf.all.rp_filter=1
net.ipv4.conf.default.rp_filter=1
net.ipv4.icmp_echo_ignore_broadcasts=1
net.ipv4.tcp_max_syn_backlog=4096
net.core.somaxconn=1024
fs.file-max=200000
EOF
chmod 644 /etc/sysctl.d/99-tita.conf
sysctl --system >/dev/null

echo "==> 7. UFW firewall (22/80/443)"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> 8. swap 2GB"
if [[ ! -f /swapfile ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

echo "==> 9. app layout dirs"
mkdir -p /opt/tita-api /var/log/tita-api /etc/tita-api
chown -R admin:admin /opt/tita-api /var/log/tita-api /etc/tita-api

echo "==> 10. log marker"
echo "tita-bootstrap OK $(date -Is)" >> /var/log/tita-bootstrap.log

echo "==> DONE"
