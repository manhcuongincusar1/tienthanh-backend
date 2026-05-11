#!/usr/bin/env bash
# Build function.zip cho Lambda arm64 (sharp prebuilt binary).
# Chạy local trước khi `pulumi up`.
set -euo pipefail

cd "$(dirname "$0")"

echo "==> clean"
rm -rf node_modules function.zip

echo "==> install (arm64 / linux)"
npm install --omit=dev \
  --os=linux \
  --cpu=arm64 \
  --include=optional

echo "==> zip"
zip -qr function.zip index.mjs package.json node_modules
echo "function.zip ready: $(du -h function.zip | cut -f1)"
