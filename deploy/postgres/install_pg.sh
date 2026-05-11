#!/usr/bin/env bash
# Install + tune PostgreSQL 15 trên Ubuntu (idempotent).
# Source of truth: deploy/postgres/runbook_02_install_pg.md.
#
# Inputs (pre-staged ở /tmp):
#   /tmp/postgresql.conf  /tmp/pg_hba.conf  /tmp/bootstrap.sql
# Env:
#   APP_PWD — password cho tita_app (BẮT BUỘC khi bootstrap lần đầu).
#
# Usage trên server:
#   sudo APP_PWD='<base64-32>' bash /tmp/install_pg.sh

set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: must run as root (sudo bash $0)"
  exit 1
fi

echo "==> 1. PGDG repo"
if [[ ! -f /etc/apt/sources.list.d/pgdg.list ]]; then
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq
else
  echo "  (PGDG repo already present)"
fi

echo "==> 2. apt install PG 15"
export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq \
  postgresql-15 postgresql-contrib-15 postgresql-15-pgvector

echo "==> 3. apply tuned config (Debian conf.d drop-in)"
cd /etc/postgresql/15/main
# Restore Debian default conf if previous run replaced it
[[ -f postgresql.conf.bak ]] && cp postgresql.conf.bak postgresql.conf
[[ -f pg_hba.conf.bak ]] || cp pg_hba.conf pg_hba.conf.bak

# Drop tuning into conf.d (Debian conf has `include_dir = 'conf.d'`)
mkdir -p conf.d
cp /tmp/postgresql.conf conf.d/99-tita.conf
chown postgres:postgres conf.d/99-tita.conf
chmod 640 conf.d/99-tita.conf

# pg_hba — full replace OK (no Debian magic needed)
cp /tmp/pg_hba.conf .
chown postgres:postgres pg_hba.conf
chmod 640 pg_hba.conf

mkdir -p /var/log/postgresql
chown postgres:postgres /var/log/postgresql

echo "==> 4. restart PG"
systemctl enable postgresql@15-main >/dev/null 2>&1 || true
systemctl restart postgresql@15-main
sleep 2
systemctl is-active --quiet postgresql@15-main || { echo "PG failed to start"; exit 1; }

echo "==> 5. bootstrap user + DB (idempotent)"
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='tita_app';")
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='tita_prod';")

if [[ "$USER_EXISTS" == "1" && "$DB_EXISTS" == "1" ]]; then
  echo "  tita_app + tita_prod already exist — skip bootstrap"
  # Always re-run extension create in tita_prod (idempotent)
  sudo -u postgres psql -d tita_prod -c "
    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE EXTENSION IF NOT EXISTS btree_gin;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  " >/dev/null
else
  if [[ -z "${APP_PWD:-}" ]]; then
    echo "ERROR: APP_PWD env required when bootstrapping (user/db not yet created)"
    exit 1
  fi
  sudo -u postgres psql -v APP_PWD="'${APP_PWD}'" -f /tmp/bootstrap.sql
fi

echo "==> 6. verify"
echo "  shared_buffers:    $(sudo -u postgres psql -d tita_prod -tAc 'SHOW shared_buffers;')"
echo "  max_connections:   $(sudo -u postgres psql -d tita_prod -tAc 'SHOW max_connections;')"
echo "  extensions in tita_prod:"
sudo -u postgres psql -d tita_prod -c "SELECT extname FROM pg_extension ORDER BY extname;"

echo "==> DONE"
