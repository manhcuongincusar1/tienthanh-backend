#!/usr/bin/env bash
# Install Caddy v2 + apply Caddyfile (idempotent).
# Source of truth: deploy/runbook_04_install_caddy.md.
#
# Usage trên server:
#   sudo bash /tmp/install_caddy.sh

set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: must run as root"; exit 1
fi

echo "==> 1. Caddy apt repo"
if [[ ! -f /etc/apt/sources.list.d/caddy-stable.list ]]; then
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
else
  echo "  (caddy repo already present)"
fi

echo "==> 2. apt install caddy"
export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq caddy

echo "==> 3. apply Caddyfile"
[[ -f /tmp/Caddyfile ]] || { echo "ERROR: /tmp/Caddyfile missing — scp first"; exit 1; }
install -m 644 /tmp/Caddyfile /etc/caddy/Caddyfile

echo "==> 4. log dir"
mkdir -p /var/log/caddy
chown caddy:caddy /var/log/caddy

echo "==> 5. validate config"
caddy validate --config /etc/caddy/Caddyfile

echo "==> 6. enable + reload"
systemctl enable --now caddy
systemctl reload caddy
sleep 2
systemctl is-active --quiet caddy || { echo "caddy.service failed"; exit 1; }

echo "==> verify"
systemctl status caddy --no-pager -l | head -20
echo
echo "==> DONE — chờ 30-60s Let's Encrypt issue cert lần đầu."
echo "    journalctl -u caddy -f | grep -E 'certificate|tls' để theo dõi."
