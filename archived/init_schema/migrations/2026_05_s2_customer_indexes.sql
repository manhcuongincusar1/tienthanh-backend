-- Sprint 2 task 08 — index cho `getCustomerListSellRent`.
-- Idempotent + safe DO block (skip nếu bảng không tồn tại local).

-- 4-tuple: [index_name, table, expression, required_cols] — chỉ tạo nếu mọi col tồn tại.
DO $$
DECLARE
  targets TEXT[][] := ARRAY[
    ['idx_customer_creator_id',  'customers',      'creator_id',                 'creator_id'],
    ['idx_customer_sale_id',     'customers',      'sale_id',                    'sale_id'],
    ['idx_customer_branch_id',   'customers',      'branch_id',                  'branch_id'],
    ['idx_customer_status',      'customers',      'status',                     'status'],
    ['idx_customer_type',        'customers',      'type',                       'type'],
    ['idx_customer_created_at',  'customers',      'created_at DESC',            'created_at'],
    ['idx_re_sale_status',       'real_estate',    'sale_id, status',            'sale_id,status'],
    ['idx_cp_main',              'customer_phones','customer_id, is_main',       'customer_id,is_main']
  ];
  idx TEXT;
  tbl TEXT;
  expr TEXT;
  col_list TEXT;
  col TEXT;
  all_present BOOLEAN;
  i INT;
BEGIN
  FOR i IN 1 .. array_length(targets, 1) LOOP
    idx := targets[i][1];
    tbl := targets[i][2];
    expr := targets[i][3];
    col_list := targets[i][4];

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      RAISE NOTICE 'skip index % — table % does not exist', idx, tbl;
      CONTINUE;
    END IF;

    all_present := true;
    FOR col IN SELECT trim(unnest(string_to_array(col_list, ','))) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=tbl AND column_name=col
      ) THEN
        all_present := false;
        RAISE NOTICE 'skip index % — column %.% does not exist', idx, tbl, col;
        EXIT;
      END IF;
    END LOOP;

    IF all_present THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (%s)', idx, tbl, expr);
    END IF;
  END LOOP;
END $$;

-- Sau prod deploy + có data thực + pg_trgm extension:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX idx_customer_phone_search ON customer_phones USING gin (phone_number gin_trgm_ops);
-- — phục vụ keyword search ILIKE %x% trên phone_number. Tách migration sau khi confirm hot path.
