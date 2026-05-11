-- Sprint 2 task 07 — index audit cho bảng `real_estate`.
-- Hiện trạng (2026-05-11): chỉ có PK. Mọi FK column dùng trong JOIN 18-bảng của
-- realEstateService.getList → seq scan. Add index FK + cột filter hot.
--
-- Idempotent — `IF NOT EXISTS` + table-existence check qua DO block.
-- Bench sau khi deploy prod (cần data ≥ 100K rows mới có ý nghĩa).

-- 4-tuple: [index_name, table, expression, required_cols] — skip nếu mọi col không tồn tại.
DO $$
DECLARE
  targets TEXT[][] := ARRAY[
    ['idx_re_category_id',          'real_estate',                'category_id',            'category_id'],
    ['idx_re_creator_sale_id',      'real_estate',                'creator_sale_id',        'creator_sale_id'],
    ['idx_re_sale_id',              'real_estate',                'sale_id',                'sale_id'],
    ['idx_re_ward_id',              'real_estate',                'ward_id',                'ward_id'],
    ['idx_re_districts_id',         'real_estate',                'districts_id',           'districts_id'],
    ['idx_re_province_city_id',     'real_estate',                'province_city_id',       'province_city_id'],
    ['idx_re_street_id',            'real_estate',                'street_id',              'street_id'],
    ['idx_re_status_id',            'real_estate',                'real_estate_status_id',  'real_estate_status_id'],
    ['idx_re_status_created_at',    'real_estate',                'status, created_at DESC','status,created_at'],
    ['idx_reb_real_estate_id',      'real_estate_branch',         'real_estate_id',         'real_estate_id'],
    ['idx_reb_branch_id',           'real_estate_branch',         'branch_id',              'branch_id'],
    ['idx_re_sub_real_estate_id',   'real_estate_subscribe',      'real_estate_id',         'real_estate_id'],
    ['idx_re_sub_sale_id',          'real_estate_subscribe',      'sale_id',                'sale_id'],
    ['idx_customer_phones_cid',     'customer_phones',            'customer_id',            'customer_id'],
    ['idx_broker_phones_bid',       'broker_phones',              'broker_id',              'broker_id'],
    ['idx_pct_pcid',                'province_city_translation',  'province_city_id',       'province_city_id'],
    ['idx_dt_did',                  'districts_translation',      'district_id',            'district_id'],
    ['idx_wt_wid',                  'wards_translation',          'ward_id',                'ward_id'],
    ['idx_strt_sid',                'streets_translation',        'street_id',              'street_id']
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

-- Notes:
-- 1. Customer query (task 08) bench riêng — index thêm ở migration riêng nếu cần.
-- 2. Sau khi deploy prod + có pg_stat_statements 1 tuần, review:
--    - Index nào idx_scan = 0 → drop (DECISIONS B5.7).
--    - Query nào còn slow → cân nhắc materialized view (DECISIONS C6).
-- 3. Schema gap phát hiện local 2026-05-11 (pre-existing, không phải bug task 07):
--    - Bảng `real_estate_subscribe`, `broker_phones` chưa có trong DB local.
--    - `real_estate` cột `district_id` (singular, query dùng) khác `districts_id` (DB có).
--    Đề xuất task riêng cho schema audit + sync FE-BE-DB.
