tita-node-api
======================================= 

## Installation

### Step 1: Start docker-compose

```bash
docker compose up -d
```

### Step 2: Start NPM

* Install by NPM

```bash
npm install
```

-OR-

* Install by Yarn

```bash
yarn install
```

### Step 3: Start Server

* Using NPM

```bash
npm start dev
```

## Testing

DECISIONS F3: mọi task S1-S4 phải có test pass trước khi merge.

### Setup

Test DB tách biệt với dev DB. Tạo DB `tita_test`:

```bash
psql -U tita -c "CREATE DATABASE tita_test;"
```

Cấu hình env: copy `.env.test` (đã có sẵn) hoặc override `POSTGRES_URL`.

### Chạy test

```bash
npm test                  # tất cả
npm run test:unit         # chỉ unit (không cần DB)
npm run test:integration  # cần PG dev đang chạy
npm run test:watch        # watch mode
```

### Pattern

- Unit test: file `tests/unit/*.test.js` — pure function, không IO.
- Integration test: file `tests/integration/*.test.js` — tạo bảng tạm trong `beforeAll`, drop + `knex.destroy()` trong `afterAll`.
- Tham khảo `tests/integration/settings.test.js` làm template.

## Env vars

### PG pool (DECISIONS C2)

| Var | Default | Note |
|---|---|---|
| `PG_POOL_MAX` | 20 | Max connection pg.Pool (raw query) |
| `PG_POOL_MIN` | 4 | Min connection pg.Pool |
| `KNEX_POOL_MAX` | 10 | Max connection Knex pool |
| `KNEX_POOL_MIN` | 2 | Min connection Knex pool |

Tổng pool tối đa: 30 connection (single Node process). PG server `max_connections` cần ≥ 50 để dư ~20 cho psql/backup/admin.

Khác:
- `statement_timeout` + `query_timeout` = 30s hard-coded — kill query > 30s.
- bigint (OID 20) coerce sang Number global ở `db/postgresql.js`.

### Redis cache (DECISIONS C5)

| Var | Default | Note |
|---|---|---|
| `REDIS_URL` | `redis://127.0.0.1:6379` | URL Redis |
| `USE_REDIS_CACHE` | `true` | Set `false` để bypass cache (fallback DB) |

TTL: permission 1h, settings 5m, master data 24h, report 15m. Invalidate explicit khi update.
Fail-open: Redis down → log warning throttled 60s, fallback DB.
Test env (`NODE_ENV=test`) tự động skip Redis.

## GIT

### New Feature
#### Step 1
* Create a new brand from the Development [branches](https://gitlab.com/mpire-projs-2022/tita-node-api/-/branches) with prefix feature-{**branches**}.
* After finishing the new feature, merge your code from the new branch into Development.
  * Remove the new branch or not.
#### Step 2
* Switch to [CI/CD](https://gitlab.com/mpire-projs-2022/tita-node-api/-/pipelines)
  * Start the docker-build-web stage.


## Coding Convention
### Components
