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
