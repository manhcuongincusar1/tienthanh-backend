# Multi-stage Dockerfile cho Tita API (production).
# Build qua GHA task 11, push lên ECR.

# === Stage 1: deps ===
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 build-essential \
    && npm ci --omit=dev --no-audit --no-fund \
    && apt-get purge -y python3 build-essential \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* /root/.npm

# === Stage 2: runtime ===
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# tini = PID 1, forward signal SIGTERM cho graceful shutdown.
RUN apt-get update && apt-get install -y --no-install-recommends \
      tini ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user — UID 1500 đồng bộ với `tita` trên host.
RUN groupadd --gid 1500 tita && useradd --uid 1500 --gid tita --shell /bin/false --create-home tita

COPY --from=deps --chown=tita:tita /app/node_modules ./node_modules
COPY --chown=tita:tita . .

USER tita
ENV NODE_ENV=production
ENV PORT=3002

EXPOSE 3002

# Healthcheck — Caddy gọi /health (config sẵn trong Caddyfile).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3002/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "bin/www"]
