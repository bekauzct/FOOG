#!/usr/bin/env bash
# GitHub Codespaces: PostgreSQL + Redis + ffmpeg o‘rnatish, .env yozish, API va web’ni ishga tushirish.
#   bash foog-code/scripts/codespace.sh setup   – bir marta (postCreateCommand)
#   bash foog-code/scripts/codespace.sh start   – har ishga tushganda (postStartCommand)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG=/tmp/foog
mkdir -p "$LOG"

if [ -n "${CODESPACE_NAME:-}" ]; then
  DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  WEB="https://${CODESPACE_NAME}-3000.${DOMAIN}"
  WS="wss://${CODESPACE_NAME}-4000.${DOMAIN}/ws"
else
  WEB="http://localhost:3000"
  WS="ws://localhost:4000/ws"
fi

services() {
  sudo service postgresql start >/dev/null
  sudo service redis-server start >/dev/null
  for _ in $(seq 30); do pg_isready -q && break; sleep 1; done
}

write_env() {
  local secret
  secret="$(cat "$ROOT/.codespace-jwt" 2>/dev/null || true)"
  if [ -z "$secret" ]; then secret="$(openssl rand -hex 32)"; echo "$secret" > "$ROOT/.codespace-jwt"; fi
  cat > "$ROOT/api/.env" <<ENV
NODE_ENV=development
PORT=4000
WEB_ORIGIN=$WEB
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/foog?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=$secret
UPLOAD_DIR=./uploads
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
TELEGRAM_BOT_USERNAME=${TELEGRAM_BOT_USERNAME:-foog_uz_bot}
TELEGRAM_MODE=polling
AUTH_DEV_LOGIN=true
BOOKING_TTL_MINUTES=120
ENV
  cat > "$ROOT/web/.env.local" <<ENV
API_URL=http://127.0.0.1:4000
NEXT_PUBLIC_WS_URL=$WS
JWT_SECRET=$secret
NEXT_PUBLIC_DEV_LOGIN=true
NEXT_PUBLIC_BOT_USERNAME=${TELEGRAM_BOT_USERNAME:-foog_uz_bot}
ENV
}

setup() {
  echo "▶ PostgreSQL, Redis, ffmpeg o‘rnatilmoqda…"
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib redis-server ffmpeg >/dev/null
  services
  sudo -u postgres psql -qc "ALTER USER postgres PASSWORD 'postgres';"
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='foog'" | grep -q 1 || sudo -u postgres createdb foog
  write_env
  echo "▶ npm paketlar…"
  (cd "$ROOT/api" && npm ci --no-audit --no-fund)
  (cd "$ROOT/web" && npm ci --no-audit --no-fund)
  echo "▶ Baza: migratsiya + namunaviy ma’lumot…"
  (cd "$ROOT/api" && npx prisma migrate deploy && npm run seed)
}

start() {
  services
  write_env
  pkill -f "tsx watch src/index.ts" 2>/dev/null || true
  pkill -f "next dev" 2>/dev/null || true
  (cd "$ROOT/api" && nohup npm run dev > "$LOG/api.log" 2>&1 &)
  (cd "$ROOT/web" && nohup npm run dev > "$LOG/web.log" 2>&1 &)
  # WebSocket brauzerdan to‘g‘ridan-to‘g‘ri 4000-portga ulanadi – port ochiq bo‘lishi kerak
  if [ -n "${CODESPACE_NAME:-}" ] && command -v gh >/dev/null; then
    gh codespace ports visibility 4000:public 3000:public -c "$CODESPACE_NAME" >/dev/null 2>&1 || true
  fi
  echo "✅ FOOG ishga tushdi: $WEB  (loglar: $LOG/api.log, $LOG/web.log)"
}

"${1:-start}"
