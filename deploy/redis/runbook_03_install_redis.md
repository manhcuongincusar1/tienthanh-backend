# Runbook 03 — Install Redis 7

## 1. Install

```bash
sudo apt install -y lsb-release curl gpg
curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
sudo sh -c 'echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" > /etc/apt/sources.list.d/redis.list'
sudo apt update
sudo apt install -y redis
```

## 2. Generate password + apply config

```bash
REDIS_PWD=$(openssl rand -base64 32)
echo "REDIS_PASSWORD = $REDIS_PWD"        # → 1Password + /opt/tita-api/.env REDIS_URL

sudo cp deploy/redis/redis.conf /etc/redis/redis.conf
sudo sed -i "s|__REDIS_PASSWORD__|$REDIS_PWD|" /etc/redis/redis.conf
sudo chown redis:redis /etc/redis/redis.conf
sudo chmod 640 /etc/redis/redis.conf

sudo systemctl restart redis-server
sudo systemctl enable redis-server
sudo systemctl status redis-server
```

## 3. Verify

```bash
redis-cli -a "$REDIS_PWD" PING                            # → PONG
redis-cli -a "$REDIS_PWD" CONFIG GET maxmemory            # → 268435456 (256MB)
redis-cli -a "$REDIS_PWD" CONFIG GET maxmemory-policy     # → allkeys-lru
redis-cli -a "$REDIS_PWD" CONFIG GET bind                 # → 127.0.0.1

# Confirm dangerous commands disabled
redis-cli -a "$REDIS_PWD" FLUSHALL                        # → (error) ERR unknown command
```

## 4. Node app .env

```bash
# /opt/tita-api/.env (sẽ apply ở task 05)
REDIS_URL=redis://default:<REDIS_PWD>@127.0.0.1:6379
USE_REDIS_CACHE=true
```

## 5. Smoke từ Node app (sau task 05)

```bash
sudo -u tita docker exec tita-api node -e "
const r = require('./db/redis');
(async () => {
  await r.set('smoke', 'ok', 60);
  console.log(await r.get('smoke'));
  process.exit(0);
})();
"
```

## Rollback

```bash
sudo systemctl stop redis-server
sudo apt purge -y redis
sudo rm -rf /var/lib/redis /etc/redis
```

## Notes

- **256MB đủ** cho permission/setting/master data cache.
- **AOF tắt** vì đây là cache — mất data sau reboot OK, Node fail-open (BE skip cache).
- **CONFIG rename** = "" → tắt hoàn toàn lệnh trên prod. Cần CONFIG GET → tạm uncomment trong /etc/redis/redis.conf rồi restart.
- **maxclients 200** đủ cho 1 Node process × 30 connection. Cron cũng share connection pool.
