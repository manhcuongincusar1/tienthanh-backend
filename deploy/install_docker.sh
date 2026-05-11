#!/usr/bin/env bash
# Install Docker engine + compose plugin trên Ubuntu (idempotent).
# Source of truth: deploy/runbook_05_install_docker.md (adapted for compose architecture).
#
# Usage trên server:
#   sudo bash /tmp/install_docker.sh

set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: must run as root"; exit 1
fi

echo "==> 1. Docker repo"
if [[ ! -f /etc/apt/sources.list.d/docker.list ]]; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
else
  echo "  (docker repo already present)"
fi

echo "==> 2. apt install Docker + compose plugin"
export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq \
  docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

echo "==> 3. enable + start docker.service"
systemctl enable --now docker
systemctl is-active --quiet docker || { echo "docker.service failed"; exit 1; }

echo "==> 4. add admin to docker group"
usermod -aG docker admin

echo "==> 5. install AWS CLI v2 (cho ECR login)"
if ! command -v aws >/dev/null 2>&1; then
  curl -s "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscliv2.zip
  apt-get install -y -qq unzip
  unzip -q /tmp/awscliv2.zip -d /tmp
  /tmp/aws/install
  rm -rf /tmp/awscliv2.zip /tmp/aws
else
  echo "  (aws cli already installed: $(aws --version))"
fi

echo "==> verify"
docker version --format 'Docker: {{.Server.Version}}'
docker compose version
aws --version

echo "==> DONE"
