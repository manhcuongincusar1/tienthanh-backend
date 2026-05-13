// Sprint 6 — Legacy schema completion.
// Đóng gap giữa knex baseline (6 migrations) và prod dump tita_prod.sql.gz.
// Spec: tasks/sprint_06_legacy_schema_completion/schema_diff.md
//
// 8 tables CREATE + 38 columns ADD + 3 RENAME + 6 triggers.
// Type mismatches int4 ↔ uuid INTENTIONALLY ignored (B6: INT PK forward; id_map ở scripts).

exports.up = async (knex) => {
  // -------- 1. legacy_uuid columns trên entity tables hiện có --------
  await knex.raw(`
    ALTER TABLE branches             ADD COLUMN IF NOT EXISTS legacy_uuid TEXT;
    ALTER TABLE sales                ADD COLUMN IF NOT EXISTS legacy_uuid TEXT;
    ALTER TABLE users                ADD COLUMN IF NOT EXISTS legacy_uuid TEXT;
    ALTER TABLE roles                ADD COLUMN IF NOT EXISTS legacy_uuid TEXT;
    ALTER TABLE customers            ADD COLUMN IF NOT EXISTS legacy_uuid TEXT;
    ALTER TABLE real_estate          ADD COLUMN IF NOT EXISTS legacy_uuid TEXT;
    ALTER TABLE real_estate_status   ADD COLUMN IF NOT EXISTS legacy_uuid TEXT;
    ALTER TABLE real_estate_category ADD COLUMN IF NOT EXISTS legacy_uuid TEXT;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_branches_legacy_uuid             ON branches             (legacy_uuid) WHERE legacy_uuid IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_legacy_uuid                ON sales                (legacy_uuid) WHERE legacy_uuid IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_users_legacy_uuid                ON users                (legacy_uuid) WHERE legacy_uuid IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_legacy_uuid                ON roles                (legacy_uuid) WHERE legacy_uuid IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_legacy_uuid            ON customers            (legacy_uuid) WHERE legacy_uuid IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_real_estate_legacy_uuid          ON real_estate          (legacy_uuid) WHERE legacy_uuid IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_real_estate_status_legacy_uuid   ON real_estate_status   (legacy_uuid) WHERE legacy_uuid IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_real_estate_category_legacy_uuid ON real_estate_category (legacy_uuid) WHERE legacy_uuid IS NOT NULL;
  `);

  // -------- 2. CREATE new tables (theo FK dependency order) --------

  // media — không phụ thuộc
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS media (
      id SERIAL PRIMARY KEY,
      legacy_uuid TEXT,
      path VARCHAR,
      title VARCHAR,
      extension VARCHAR,
      cdn_path VARCHAR,
      status SMALLINT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_media_legacy_uuid ON media(legacy_uuid) WHERE legacy_uuid IS NOT NULL;
    CREATE INDEX        IF NOT EXISTS idx_media_status     ON media(status);
  `);

  // brokers — ref users, branches
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS brokers (
      id SERIAL PRIMARY KEY,
      legacy_uuid TEXT,
      full_name VARCHAR,
      status SMALLINT,
      creator_id INTEGER,
      branch_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT now(),
      modification_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_brokers_legacy_uuid ON brokers(legacy_uuid) WHERE legacy_uuid IS NOT NULL;
    CREATE INDEX        IF NOT EXISTS idx_brokers_branch_id  ON brokers(branch_id);
    CREATE INDEX        IF NOT EXISTS idx_brokers_creator_id ON brokers(creator_id);
  `);

  // broker_phones — ref brokers
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS broker_phones (
      id SERIAL PRIMARY KEY,
      legacy_uuid TEXT,
      broker_id INTEGER,
      phone_number VARCHAR,
      status INTEGER,
      is_main BOOLEAN,
      created_at TIMESTAMPTZ DEFAULT now(),
      modification_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_broker_phones_legacy_uuid    ON broker_phones(legacy_uuid) WHERE legacy_uuid IS NOT NULL;
    CREATE INDEX        IF NOT EXISTS idx_broker_phones_broker_id     ON broker_phones(broker_id);
    CREATE INDEX        IF NOT EXISTS idx_broker_phones_phone_number  ON broker_phones(phone_number);
  `);

  // customer_demands — ref customers
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS customer_demands (
      id SERIAL PRIMARY KEY,
      legacy_uuid TEXT,
      price_to NUMERIC(15,2),
      price_from NUMERIC(15,2),
      district_id INTEGER,
      province_city_id INTEGER,
      status SMALLINT,
      customer_id INTEGER,
      type INTEGER,
      uses VARCHAR,
      note VARCHAR,
      created_at TIMESTAMPTZ DEFAULT now(),
      modification_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_demands_legacy_uuid  ON customer_demands(legacy_uuid) WHERE legacy_uuid IS NOT NULL;
    CREATE INDEX        IF NOT EXISTS idx_customer_demands_customer_id ON customer_demands(customer_id);
  `);

  // customer_detail — ref customers
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS customer_detail (
      id SERIAL PRIMARY KEY,
      legacy_uuid TEXT,
      price_to NUMERIC(15,2),
      price_from NUMERIC(15,2),
      district_id INTEGER,
      province_city_id INTEGER,
      status SMALLINT,
      customer_id INTEGER,
      uses SMALLINT,
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      modification_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_detail_legacy_uuid  ON customer_detail(legacy_uuid) WHERE legacy_uuid IS NOT NULL;
    CREATE INDEX        IF NOT EXISTS idx_customer_detail_customer_id ON customer_detail(customer_id);
  `);

  // export_customer_queue — ref users, branches
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS export_customer_queue (
      id SERIAL PRIMARY KEY,
      legacy_uuid TEXT,
      file_path TEXT,
      user_id INTEGER,
      meta_data JSONB,
      status SMALLINT DEFAULT 1,
      file_name TEXT,
      type INTEGER,
      branch_id INTEGER,
      file_size NUMERIC(15,2),
      created_at TIMESTAMPTZ DEFAULT now(),
      modification_date TIMESTAMPTZ DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_export_customer_queue_legacy_uuid ON export_customer_queue(legacy_uuid) WHERE legacy_uuid IS NOT NULL;
    CREATE INDEX        IF NOT EXISTS idx_export_customer_queue_user_id   ON export_customer_queue(user_id);
  `);

  // real_estate_historical — ref users
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS real_estate_historical (
      id SERIAL PRIMARY KEY,
      legacy_uuid TEXT,
      meta_data JSONB,
      creator_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_real_estate_historical_legacy_uuid ON real_estate_historical(legacy_uuid) WHERE legacy_uuid IS NOT NULL;
    CREATE INDEX        IF NOT EXISTS idx_real_estate_historical_creator_id ON real_estate_historical(creator_id);
  `);

  // real_estate_subscribe — ref real_estate, sales
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS real_estate_subscribe (
      real_estate_id INTEGER NOT NULL,
      sale_id INTEGER NOT NULL
    );
    -- PK composite — idempotent guard
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'real_estate_subscribe_pkey') THEN
        ALTER TABLE real_estate_subscribe ADD PRIMARY KEY (real_estate_id, sale_id);
      END IF;
    END $$;
    CREATE INDEX IF NOT EXISTS idx_real_estate_subscribe_sale_id ON real_estate_subscribe(sale_id);
  `);

  // -------- 3. Column renames (idempotent) --------
  await knex.raw(`
    -- users.salk → salt
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='users' AND column_name='salk'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='users' AND column_name='salt'
      ) THEN
        ALTER TABLE users RENAME COLUMN salk TO salt;
      END IF;
    END $$;

    -- real_estate.districts_id → district_id
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='real_estate' AND column_name='districts_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='real_estate' AND column_name='district_id'
      ) THEN
        ALTER TABLE real_estate RENAME COLUMN districts_id TO district_id;
      END IF;
    END $$;

    -- customer_phones.phone → phone_number
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='customer_phones' AND column_name='phone'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='customer_phones' AND column_name='phone_number'
      ) THEN
        ALTER TABLE customer_phones RENAME COLUMN phone TO phone_number;
      END IF;
    END $$;
  `);

  // -------- 4. ADD COLUMN per existing table --------

  // customers (+8 cols)
  await knex.raw(`
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS creator_id           INTEGER;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS goodwill             BOOLEAN DEFAULT false;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS type                 INTEGER;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS branch_id            INTEGER;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_status      SMALLINT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_share_info        BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS share_info_update_at TIMESTAMPTZ;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS customers_alias      VARCHAR;
    CREATE INDEX IF NOT EXISTS idx_customers_branch_id  ON customers(branch_id);
    CREATE INDEX IF NOT EXISTS idx_customers_creator_id ON customers(creator_id);
  `);

  // real_estate (+15 cols)
  await knex.raw(`
    ALTER TABLE real_estate ADD COLUMN IF NOT EXISTS address               TEXT;
    ALTER TABLE real_estate ADD COLUMN IF NOT EXISTS goodwill              BOOLEAN;
    ALTER TABLE real_estate ADD COLUMN IF NOT EXISTS price                 NUMERIC(15,2);
    ALTER TABLE real_estate ADD COLUMN IF NOT EXISTS brokerage_fees        NUMERIC(15,2);
    ALTER TABLE real_estate ADD COLUMN IF NOT EXISTS agency                BOOLEAN;
    ALTER TABLE real_estate ADD COLUMN IF NOT EXISTS type                  SMALLINT;
    ALTER TABLE real_estate ADD COLUMN IF NOT EXISTS code                  VARCHAR;
    ALTER TABLE real_estate ADD COLUMN IF NOT EXISTS parent_real_estate_id INTEGER;
    ALTER TABLE real_estate ADD COLUMN IF NOT EXISTS is_internal           BOOLEAN;
    ALTER TABLE real_estate ADD COLUMN IF NOT EXISTS saler_phone_id        INTEGER;
    ALTER TABLE real_estate ADD COLUMN IF NOT EXISTS full_address          TEXT;
    ALTER TABLE real_estate ADD COLUMN IF NOT EXISTS location              INTEGER;
    ALTER TABLE real_estate ADD COLUMN IF NOT EXISTS broker_id             INTEGER;
    ALTER TABLE real_estate ADD COLUMN IF NOT EXISTS broker_phone_id       INTEGER;
    ALTER TABLE real_estate ADD COLUMN IF NOT EXISTS direction             VARCHAR;
    CREATE INDEX IF NOT EXISTS idx_real_estate_district_id ON real_estate(district_id);
    CREATE INDEX IF NOT EXISTS idx_real_estate_broker_id   ON real_estate(broker_id);
    CREATE INDEX IF NOT EXISTS idx_real_estate_code        ON real_estate(code);
    CREATE INDEX IF NOT EXISTS idx_real_estate_type        ON real_estate(type);
    CREATE INDEX IF NOT EXISTS idx_real_estate_status_id   ON real_estate(real_estate_status_id);
  `);

  // users (+2 cols, salt rename above)
  await knex.raw(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_key VARCHAR;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_id     INTEGER;
    -- salt: nếu rename không chạy (knex baseline đã đổi), thêm cột direct cho idempotent
    ALTER TABLE users ADD COLUMN IF NOT EXISTS salt           VARCHAR;
  `);

  // customer_phones (+ PK id, +3 cols)
  await knex.raw(`
    ALTER TABLE customer_phones ADD COLUMN IF NOT EXISTS id            SERIAL;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_phones_pkey') THEN
        ALTER TABLE customer_phones ADD PRIMARY KEY (id);
      END IF;
    END $$;
    ALTER TABLE customer_phones ADD COLUMN IF NOT EXISTS phone_number  VARCHAR;
    ALTER TABLE customer_phones ADD COLUMN IF NOT EXISTS status        INTEGER;
    ALTER TABLE customer_phones ADD COLUMN IF NOT EXISTS is_main       BOOLEAN;
    ALTER TABLE customer_phones ADD COLUMN IF NOT EXISTS legacy_uuid   TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_phones_legacy_uuid    ON customer_phones(legacy_uuid) WHERE legacy_uuid IS NOT NULL;
    CREATE INDEX        IF NOT EXISTS idx_customer_phones_customer_id  ON customer_phones(customer_id);
    CREATE INDEX        IF NOT EXISTS idx_customer_phones_phone_number ON customer_phones(phone_number);
  `);

  // real_estate_status (+6 cols)
  await knex.raw(`
    ALTER TABLE real_estate_status ADD COLUMN IF NOT EXISTS is_editable_re     BOOLEAN DEFAULT false;
    ALTER TABLE real_estate_status ADD COLUMN IF NOT EXISTS is_default         BOOLEAN DEFAULT false;
    ALTER TABLE real_estate_status ADD COLUMN IF NOT EXISTS type               SMALLINT;
    ALTER TABLE real_estate_status ADD COLUMN IF NOT EXISTS is_allow_duplicate BOOLEAN DEFAULT false;
    ALTER TABLE real_estate_status ADD COLUMN IF NOT EXISTS color              VARCHAR;
    ALTER TABLE real_estate_status ADD COLUMN IF NOT EXISTS is_show_internal   BOOLEAN DEFAULT false;
  `);

  // export_queue (+1 col)
  await knex.raw(`
    ALTER TABLE export_queue ADD COLUMN IF NOT EXISTS file_size NUMERIC(15,2);
  `);

  // import_queue (+1 col)
  await knex.raw(`
    ALTER TABLE import_queue ADD COLUMN IF NOT EXISTS error_file_name VARCHAR;
  `);

  // -------- 5. sync_lastmod function + 6 triggers --------
  await knex.raw(`
    CREATE OR REPLACE FUNCTION sync_lastmod() RETURNS trigger AS $$
    BEGIN
      NEW.modification_at := NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS modification_at ON real_estate;
    CREATE TRIGGER modification_at BEFORE UPDATE ON real_estate
      FOR EACH ROW EXECUTE PROCEDURE sync_lastmod();

    DROP TRIGGER IF EXISTS modification_at ON customers;
    CREATE TRIGGER modification_at BEFORE UPDATE ON customers
      FOR EACH ROW EXECUTE PROCEDURE sync_lastmod();

    DROP TRIGGER IF EXISTS modification_at ON customer_demands;
    CREATE TRIGGER modification_at BEFORE UPDATE ON customer_demands
      FOR EACH ROW EXECUTE PROCEDURE sync_lastmod();

    DROP TRIGGER IF EXISTS modification_at ON sales;
    CREATE TRIGGER modification_at BEFORE UPDATE ON sales
      FOR EACH ROW EXECUTE PROCEDURE sync_lastmod();

    DROP TRIGGER IF EXISTS modification_at ON users;
    CREATE TRIGGER modification_at BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE PROCEDURE sync_lastmod();

    DROP TRIGGER IF EXISTS modification_at ON branches;
    CREATE TRIGGER modification_at BEFORE UPDATE ON branches
      FOR EACH ROW EXECUTE PROCEDURE sync_lastmod();
  `);

  // -------- 6. id_map table (cho UUID→INT pipeline ở task 04) --------
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS id_map (
      table_name VARCHAR NOT NULL,
      legacy_uuid TEXT NOT NULL,
      new_id INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (table_name, legacy_uuid)
    );
    CREATE INDEX IF NOT EXISTS idx_id_map_new_id ON id_map(table_name, new_id);
  `);
};

exports.down = async (knex) => {
  // Reverse order: triggers, function, columns, tables, legacy_uuid.
  await knex.raw(`
    DROP TRIGGER IF EXISTS modification_at ON branches;
    DROP TRIGGER IF EXISTS modification_at ON users;
    DROP TRIGGER IF EXISTS modification_at ON sales;
    DROP TRIGGER IF EXISTS modification_at ON customer_demands;
    DROP TRIGGER IF EXISTS modification_at ON customers;
    DROP TRIGGER IF EXISTS modification_at ON real_estate;
    DROP FUNCTION IF EXISTS sync_lastmod();

    DROP TABLE IF EXISTS id_map CASCADE;
    DROP TABLE IF EXISTS real_estate_subscribe CASCADE;
    DROP TABLE IF EXISTS real_estate_historical CASCADE;
    DROP TABLE IF EXISTS export_customer_queue CASCADE;
    DROP TABLE IF EXISTS customer_detail CASCADE;
    DROP TABLE IF EXISTS customer_demands CASCADE;
    DROP TABLE IF EXISTS broker_phones CASCADE;
    DROP TABLE IF EXISTS brokers CASCADE;
    DROP TABLE IF EXISTS media CASCADE;

    ALTER TABLE import_queue       DROP COLUMN IF EXISTS error_file_name;
    ALTER TABLE export_queue       DROP COLUMN IF EXISTS file_size;
    ALTER TABLE real_estate_status DROP COLUMN IF EXISTS is_show_internal;
    ALTER TABLE real_estate_status DROP COLUMN IF EXISTS color;
    ALTER TABLE real_estate_status DROP COLUMN IF EXISTS is_allow_duplicate;
    ALTER TABLE real_estate_status DROP COLUMN IF EXISTS type;
    ALTER TABLE real_estate_status DROP COLUMN IF EXISTS is_default;
    ALTER TABLE real_estate_status DROP COLUMN IF EXISTS is_editable_re;

    ALTER TABLE customer_phones DROP COLUMN IF EXISTS legacy_uuid;
    ALTER TABLE customer_phones DROP COLUMN IF EXISTS is_main;
    ALTER TABLE customer_phones DROP COLUMN IF EXISTS status;
    -- KHÔNG drop id PK + phone_number (rename back gây phức tạp). Migration down chỉ best-effort.

    ALTER TABLE users DROP COLUMN IF EXISTS creator_id;
    ALTER TABLE users DROP COLUMN IF EXISTS activation_key;

    ALTER TABLE real_estate DROP COLUMN IF EXISTS direction;
    ALTER TABLE real_estate DROP COLUMN IF EXISTS broker_phone_id;
    ALTER TABLE real_estate DROP COLUMN IF EXISTS broker_id;
    ALTER TABLE real_estate DROP COLUMN IF EXISTS location;
    ALTER TABLE real_estate DROP COLUMN IF EXISTS full_address;
    ALTER TABLE real_estate DROP COLUMN IF EXISTS saler_phone_id;
    ALTER TABLE real_estate DROP COLUMN IF EXISTS is_internal;
    ALTER TABLE real_estate DROP COLUMN IF EXISTS parent_real_estate_id;
    ALTER TABLE real_estate DROP COLUMN IF EXISTS code;
    ALTER TABLE real_estate DROP COLUMN IF EXISTS type;
    ALTER TABLE real_estate DROP COLUMN IF EXISTS agency;
    ALTER TABLE real_estate DROP COLUMN IF EXISTS brokerage_fees;
    ALTER TABLE real_estate DROP COLUMN IF EXISTS price;
    ALTER TABLE real_estate DROP COLUMN IF EXISTS goodwill;
    ALTER TABLE real_estate DROP COLUMN IF EXISTS address;

    ALTER TABLE customers DROP COLUMN IF EXISTS customers_alias;
    ALTER TABLE customers DROP COLUMN IF EXISTS share_info_update_at;
    ALTER TABLE customers DROP COLUMN IF EXISTS is_share_info;
    ALTER TABLE customers DROP COLUMN IF EXISTS business_status;
    ALTER TABLE customers DROP COLUMN IF EXISTS branch_id;
    ALTER TABLE customers DROP COLUMN IF EXISTS type;
    ALTER TABLE customers DROP COLUMN IF EXISTS goodwill;
    ALTER TABLE customers DROP COLUMN IF EXISTS creator_id;

    ALTER TABLE real_estate_category DROP COLUMN IF EXISTS legacy_uuid;
    ALTER TABLE real_estate_status   DROP COLUMN IF EXISTS legacy_uuid;
    ALTER TABLE real_estate          DROP COLUMN IF EXISTS legacy_uuid;
    ALTER TABLE customers            DROP COLUMN IF EXISTS legacy_uuid;
    ALTER TABLE roles                DROP COLUMN IF EXISTS legacy_uuid;
    ALTER TABLE users                DROP COLUMN IF EXISTS legacy_uuid;
    ALTER TABLE sales                DROP COLUMN IF EXISTS legacy_uuid;
    ALTER TABLE branches             DROP COLUMN IF EXISTS legacy_uuid;
  `);
};
