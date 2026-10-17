#!/usr/bin/env bash
# FOOG – Ubuntu 22.04 / 24.04 VPS ga bitta buyruq bilan o‘rnatish (root sifatida).
#
#   curl -fsSL https://raw.githubusercontent.com/bekauzct/FOOG/claude/practical-hypatia-trzo8f/foog-code/deploy/install.sh -o install.sh
#   sudo bash install.sh
#
# Qayta ishga tushirsa – kodni yangilaydi, qayta build qiladi va xizmatlarni qayta yuklaydi
# (.env dagi parollar va kalitlar saqlanib qoladi).
#
# Savollarsiz ishlatish uchun o‘zgaruvchilar:
#   DOMAIN=foog.uz EMAIL=siz@mail.uz BOT_TOKEN=... BOT_USERNAME=foogtest55bot DEMO=y sudo -E bash install.sh
set -euo pipefail

REPO="${REPO:-https://github.com/bekauzct/FOOG.git}"
BRANCH="${BRANCH:-claude/practical-hypatia-trzo8f}"
APP_DIR=/opt/foog
CODE="$APP_DIR/foog-code"
UPLOADS=/var/lib/foog/uploads
APP_USER=foog

say() { printf '\n\033[1;32m▶ %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m! %s\033[0m\n' "$*"; }
ask() { local v="$1" q="$2" d="${3:-}"; if [ -z "${!v:-}" ]; then read -rp "$q${d:+ [$d]}: " "$v" </dev/tty || true; fi; printf -v "$v" '%s' "${!v:-$d}"; }

[ "$(id -u)" = 0 ] || { echo "root sifatida ishga tushiring: sudo bash install.sh"; exit 1; }
. /etc/os-release
[ "${ID:-}" = ubuntu ] || warn "Bu skript Ubuntu uchun yozilgan (sizda: ${PRETTY_NAME:-noma’lum})."

FIRST_RUN=1; [ -f "$CODE/api/.env" ] && FIRST_RUN=0
if [ "$FIRST_RUN" = 1 ]; then
  ask DOMAIN "Domen" "foog.uz"
  ask EMAIL "Email (SSL sertifikat xabarlari uchun)" ""
  ask BOT_TOKEN "Telegram bot tokeni (@BotFather)" ""
  ask BOT_USERNAME "Bot username (@ belgisiz)" "foogtest55bot"
  ask DEMO "Namunaviy ma’lumot va «Sinov rejimi · botsiz» kirish yoqilsinmi? (y/n)" "y"
fi

# ---------------------------------------------------------------- tizim paketlari
say "Tizim paketlari o‘rnatilmoqda…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates gnupg openssl nginx certbot python3-certbot-nginx \
  postgresql postgresql-contrib redis-server ffmpeg ufw >/dev/null
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
command -v pm2 >/dev/null || npm i -g pm2 --silent
systemctl enable --now postgresql redis-server nginx >/dev/null

# Next.js build 2 GB RAM da xotira yetmasligi mumkin – swap qo‘shamiz
if [ "$(swapon --show | wc -l)" = 0 ] && [ "$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)" -lt 3500 ]; then
  say "2 GB swap yaratilmoqda…"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null

# ---------------------------------------------------------------- foydalanuvchi va kod
id "$APP_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$APP_USER"
mkdir -p "$APP_DIR" "$UPLOADS"
chown -R "$APP_USER:$APP_USER" "$APP_DIR" /var/lib/foog
say "Kod GitHub’dan olinmoqda ($BRANCH)…"
if [ -d "$APP_DIR/.git" ]; then
  sudo -H -u "$APP_USER" git -C "$APP_DIR" fetch -q origin "$BRANCH"
  sudo -H -u "$APP_USER" git -C "$APP_DIR" checkout -q -B "$BRANCH" "origin/$BRANCH"
else
  sudo -H -u "$APP_USER" git clone -q --branch "$BRANCH" "$REPO" "$APP_DIR"
fi

# ---------------------------------------------------------------- baza va .env (faqat birinchi marta)
if [ "$FIRST_RUN" = 1 ]; then
  say "PostgreSQL bazasi yaratilmoqda…"
  DB_PASS="$(openssl rand -hex 16)"
  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='foog'" | grep -q 1; then
    sudo -u postgres psql -qc "ALTER ROLE foog WITH LOGIN PASSWORD '$DB_PASS';"
  else
    sudo -u postgres psql -qc "CREATE ROLE foog WITH LOGIN PASSWORD '$DB_PASS';"
  fi
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='foog'" | grep -q 1 || sudo -u postgres createdb -O foog foog

  JWT="$(openssl rand -hex 32)"
  HOOK="$(openssl rand -hex 16)"
  DEV=false; [[ "$DEMO" =~ ^[yY] ]] && DEV=true
  cat > "$CODE/api/.env" <<ENV
NODE_ENV=production
PORT=4000
WEB_ORIGIN=https://$DOMAIN
DATABASE_URL=postgresql://foog:$DB_PASS@localhost:5432/foog?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=$JWT
UPLOAD_DIR=$UPLOADS
TELEGRAM_BOT_TOKEN=$BOT_TOKEN
TELEGRAM_BOT_USERNAME=$BOT_USERNAME
TELEGRAM_MODE=webhook
TELEGRAM_WEBHOOK_URL=https://$DOMAIN/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=$HOOK
AUTH_DEV_LOGIN=$DEV
BOOKING_TTL_MINUTES=120
ENV
  cat > "$CODE/web/.env.local" <<ENV
API_URL=http://127.0.0.1:4000
NEXT_PUBLIC_WS_URL=
JWT_SECRET=$JWT
NEXT_PUBLIC_DEV_LOGIN=$DEV
NEXT_PUBLIC_BOT_USERNAME=$BOT_USERNAME
ENV
  chmod 600 "$CODE/api/.env" "$CODE/web/.env.local"
  chown "$APP_USER:$APP_USER" "$CODE/api/.env" "$CODE/web/.env.local"
fi
DOMAIN="$(sed -n 's#^WEB_ORIGIN=https\?://##p' "$CODE/api/.env")"

# ---------------------------------------------------------------- build
say "API: paketlar, migratsiya, build…"
sudo -H -u "$APP_USER" bash -c "cd '$CODE/api' && npm ci --no-audit --no-fund --silent && npx prisma migrate deploy && npm run build --silent"
if [ "$FIRST_RUN" = 1 ] && [[ "${DEMO:-n}" =~ ^[yY] ]]; then
  say "Namunaviy ma’lumot (seed)…"
  sudo -H -u "$APP_USER" bash -c "cd '$CODE/api' && npm run seed --silent"
fi
say "Web: paketlar va build (bir necha daqiqa)…"
sudo -H -u "$APP_USER" bash -c "cd '$CODE/web' && npm ci --no-audit --no-fund --silent && NODE_OPTIONS=--max-old-space-size=1536 npm run build"

# ---------------------------------------------------------------- nginx + SSL
say "nginx sozlanmoqda…"
CONF=/etc/nginx/sites-available/foog
if [ ! -f "$CONF" ]; then
  # HTTP konfiguratsiya; certbot keyin SSL va 80→443 yo‘naltirishni o‘zi qo‘shadi
  cat > "$CONF" <<NGINX
server {
  listen 80;
  server_name $DOMAIN www.$DOMAIN;
  client_max_body_size 200m;
  location /ws {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_read_timeout 3600s;
  }
  location ~ ^/(api/v1|uploads|telegram/webhook|health) {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
NGINX
  ln -sf "$CONF" /etc/nginx/sites-enabled/foog
  rm -f /etc/nginx/sites-enabled/default
fi
nginx -t -q && systemctl reload nginx

SSL=0
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then SSL=1
else
  say "SSL sertifikat (Let’s Encrypt)…"
  if certbot --nginx -n --agree-tos --redirect ${EMAIL:+-m "$EMAIL"} ${EMAIL:---register-unsafely-without-email} -d "$DOMAIN" -d "www.$DOMAIN"; then SSL=1
  elif certbot --nginx -n --agree-tos --redirect ${EMAIL:+-m "$EMAIL"} ${EMAIL:---register-unsafely-without-email} -d "$DOMAIN"; then SSL=1
  else warn "SSL olinmadi: $DOMAIN DNS’da hali bu server IP siga yo‘nalmagan bo‘lishi mumkin. DNS tayyor bo‘lgach skriptni qayta ishga tushiring."
  fi
fi

# ---------------------------------------------------------------- ishga tushirish
say "PM2 orqali ishga tushirilmoqda…"
if sudo -H -u "$APP_USER" pm2 describe foog-api >/dev/null 2>&1; then
  sudo -H -u "$APP_USER" bash -c "cd '$CODE' && pm2 reload deploy/ecosystem.config.js --update-env"
else
  sudo -H -u "$APP_USER" bash -c "cd '$CODE' && pm2 start deploy/ecosystem.config.js"
fi
sudo -H -u "$APP_USER" pm2 save >/dev/null
env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null

sleep 5
API_OK=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/health || true)
WEB_OK=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || true)
IP=$(curl -s -4 https://ifconfig.me || hostname -I | awk '{print $1}')

echo
echo "================================================================"
echo " FOOG o‘rnatildi"
echo "   API:  $API_OK   Web: $WEB_OK   (200 bo‘lishi kerak)"
if [ "$SSL" = 1 ]; then echo "   Sayt: https://$DOMAIN"; else echo "   Sayt: http://$IP  (SSL hali yo‘q – kirish ishlashi uchun HTTPS kerak)"; fi
echo "   DNS:  $DOMAIN va www.$DOMAIN  A-yozuvi → $IP"
echo "   Loglar:      sudo -u $APP_USER pm2 logs"
echo "   Yangilash:   sudo bash $CODE/deploy/install.sh"
echo "   Sozlamalar:  $CODE/api/.env  (o‘zgartirgach: sudo -u $APP_USER pm2 reload all --update-env)"
echo "================================================================"
