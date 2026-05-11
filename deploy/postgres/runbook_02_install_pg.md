# Runbook 02 — Install + tune PostgreSQL 15

## 1. Cài PG 15

```bash
# Add PGDG repo
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
sudo sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
  https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list'

sudo apt update
sudo apt install -y postgresql-15 postgresql-contrib-15 postgresql-15-pgvector
```

## 2. Apply config

```bash
# Backup default
sudo cp /etc/postgresql/15/main/postgresql.conf{,.bak}
sudo cp /etc/postgresql/15/main/pg_hba.conf{,.bak}

# Copy artifacts từ repo
sudo cp deploy/postgres/postgresql.conf /etc/postgresql/15/main/postgresql.conf
sudo cp deploy/postgres/pg_hba.conf     /etc/postgresql/15/main/pg_hba.conf

sudo chown postgres:postgres /etc/postgresql/15/main/*.conf
sudo chmod 640 /etc/postgresql/15/main/*.conf

# Log dir
sudo mkdir -p /var/log/postgresql
sudo chown postgres:postgres /var/log/postgresql

sudo systemctl restart postgresql@15-main
sudo systemctl status postgresql@15-main
```

## 3. Bootstrap user + DB

```bash
# Generate strong password
APP_PWD=$(openssl rand -base64 32)
echo "tita_app password = $APP_PWD"     # → paste vào /opt/tita-api/.env

sudo -u postgres psql \
  -v APP_PWD="'$APP_PWD'" \
  -f deploy/postgres/bootstrap.sql
```

**Save password vào 1Password** trước khi đóng terminal.

## 4. Apply schema

```bash
# Init DDL (TITA.sql từ legacy + S1 migrations)
sudo -u tita_app psql -h localhost -d tita_prod -f init_schema/TITA.sql

# Sprint migrations
for f in init_schema/migrations/*.sql; do
  echo "==> $f"
  sudo -u tita_app psql -h localhost -d tita_prod -f "$f"
done
```

## 5. Verify

```bash
sudo -u postgres psql -d tita_prod -c "SHOW shared_buffers;"           # 512MB
sudo -u postgres psql -d tita_prod -c "SHOW max_connections;"          # 50
sudo -u postgres psql -d tita_prod -c "SELECT * FROM pg_extension;"    # pg_stat_statements + pg_trgm
sudo -u postgres psql -d tita_prod -c "\dt"                            # list tables
```

## 6. pg_stat_statements weekly review (DECISIONS B5.3)

```sql
-- Top 10 slowest queries
SELECT round(total_exec_time::numeric, 2) AS total_ms,
       calls,
       round((total_exec_time/calls)::numeric, 2) AS avg_ms,
       round((100 * total_exec_time/sum(total_exec_time) OVER ())::numeric, 1) AS pct,
       substring(query for 200) AS query
FROM   pg_stat_statements
ORDER  BY total_exec_time DESC
LIMIT  10;
```

→ Add cron weekly task 09 monitoring.

## Rollback

```bash
sudo cp /etc/postgresql/15/main/postgresql.conf.bak /etc/postgresql/15/main/postgresql.conf
sudo systemctl restart postgresql@15-main
```

## Troubleshooting

| Lỗi | Fix |
|---|---|
| `FATAL: password authentication failed` | Check pg_hba.conf method = scram-sha-256, password trong .env có quote đúng. |
| `out of memory` | shared_buffers + work_mem*max_connections vượt RAM. Giảm work_mem hoặc max_connections. |
