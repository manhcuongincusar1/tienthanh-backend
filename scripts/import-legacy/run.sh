#!/usr/bin/env bash
# Pipeline orchestrator: chạy tuần tự 01-32 + 90 + 99.
# Usage:
#   bash scripts/import-legacy/run.sh [--skip-media]
#
# Env (defaults match local docker setup):
#   PG_TARGET_URL=postgresql://tita:123qwe@localhost:5432/tita
#   PG_LEGACY_URL=postgresql://postgres:x@localhost:5435/tita_prod_ref
#   MONGO_URL=mongodb://localhost:27017
#   MONGO_DB=tita
#   RUN_MEDIA_UPLOAD=0   # set 1 để upload S3 (cần AWS creds)
#   CDN_BASE=...          # set để rewrite cdn_path
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

SKIP_MEDIA=0
for arg in "$@"; do
  case "$arg" in
    --skip-media) SKIP_MEDIA=1 ;;
    *) echo "unknown flag: $arg"; exit 2 ;;
  esac
done

echo "=== Pipeline starts $(date -Iseconds) ==="
echo "  target:  ${PG_TARGET_URL:-postgresql://tita:123qwe@localhost:5432/tita}"
echo "  legacy:  ${PG_LEGACY_URL:-postgresql://postgres:x@localhost:5435/tita_prod_ref}"
echo "  mongo:   ${MONGO_URL:-mongodb://localhost:27017}"
echo "  skip-media: $SKIP_MEDIA"
echo ""

run_step() {
  local script="$1"
  echo "--- $(basename "$script") ---"
  node "$script"
}

# Phase 1: PG legacy → target (UUID→INT). Order theo FK dep.
for n in 10_branches 11_users 12_sales 13_roles 14_users_roles \
         15_customers 16_customer_phones 17_customer_detail 18_customer_demands \
         19_brokers 20_broker_phones \
         21_real_estate_status 22_real_estate_category 23_real_estate \
         24_real_estate_branch 25_real_estate_subscribe 26_real_estate_historical \
         27_media 28_sale_branch 29_sale_district 30_branch_district \
         31_queues 32_domain_setting; do
  run_step "$SCRIPT_DIR/$n.js"
done

# Phase 2: Mongo → target (FK lookup id_map).
for n in 01_settings 04_subscriptions 05_permissions \
         06_real_estate_details 07_real_estate_history; do
  run_step "$SCRIPT_DIR/$n.js"
done

# Phase 3: Resequence
run_step "$SCRIPT_DIR/90_resequence.js"

# Phase 4: Media (chỉ khi không skip)
if [[ $SKIP_MEDIA -eq 0 ]]; then
  run_step "$SCRIPT_DIR/40_media_upload_s3.js"
  run_step "$SCRIPT_DIR/41_media_rewrite_cdn.js"
  run_step "$SCRIPT_DIR/42_media_rewrite_listpath.js"
else
  echo "--- skipping media phase ---"
fi

# Phase 5: Verify
run_step "$SCRIPT_DIR/99_verify_counts.js"

echo ""
echo "=== Pipeline done $(date -Iseconds) ==="
