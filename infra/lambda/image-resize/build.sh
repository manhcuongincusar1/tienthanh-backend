#!/usr/bin/env bash
# Build function.zip cho Lambda arm64.
# Sharp cần native binary linux-arm64 (libvips-cpp.so.42). npm CLI flag
# `--os=linux --cpu=arm64` không reliable cho prebuilt binary (npm 10.x bỏ
# qua `@img/sharp-linux-arm64` khi chạy trên macOS). Dùng docker container
# linux/arm64 để npm install thật → binaries match Lambda runtime arm64.
#
# Chạy local trước khi `pulumi up`. Yêu cầu: docker desktop.
set -euo pipefail

cd "$(dirname "$0")"

echo "==> clean"
rm -rf node_modules function.zip

echo "==> install in linux/arm64 docker container"
docker run --rm --platform linux/arm64 -v "$PWD":/work -w /work \
  node:20-bookworm \
  npm install --omit=dev --include=optional --no-audit --no-fund

echo "==> verify sharp native binary present"
if [ ! -f node_modules/@img/sharp-libvips-linux-arm64/lib/libvips-cpp.so.42 ]; then
  echo "ERR: sharp-libvips-linux-arm64/lib/libvips-cpp.so.42 missing" >&2
  exit 1
fi

echo "==> zip"
zip -qr function.zip index.mjs package.json node_modules
echo "function.zip ready: $(du -h function.zip | cut -f1)"
