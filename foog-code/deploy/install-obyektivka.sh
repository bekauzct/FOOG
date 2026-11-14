#!/usr/bin/env bash
# Obyektivka'ni foog.uz/obyektivka manzilida ishga tushirish (FOOG serveri, Ubuntu 24.04).
# FOOG avval install.sh bilan o‘rnatilgan bo‘lishi kerak (nginx + SSL shu skriptda sozlangan).
#
#   curl -fsSL https://raw.githubusercontent.com/bekauzct/FOOG/claude/practical-hypatia-trzo8f/foog-code/deploy/install-obyektivka.sh -o ~/install-obyektivka.sh && sudo bash ~/install-obyektivka.sh
#
# Qayta ishga tushirsa – kodni yangilaydi va konteynerni qayta quradi (.env saqlanadi).
set -euo pipefail

DOMAIN="${DOMAIN:-foog.uz}"
PREFIX="/obyektivka"
REPO="https://github.com/bekauzct/1plus.git"
BRANCH="${OBV_BRANCH:-claude/obyektivka-foog-subpath}"
DIR=/opt/obyektivka
APP="$DIR/obyektivka"
PORT=8000
NGX_CONF=/etc/nginx/sites-available/foog
NGX_DIR=/etc/nginx/foog.d

say() { printf '\n\033[1;32m▶ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*"; exit 1; }

[ "$(id -u)" = 0 ] || die "sudo bilan ishga tushiring: sudo bash $0"
[ -f "$NGX_CONF" ] || die "$NGX_CONF topilmadi – avval FOOG install.sh ni ishga tushiring"

# Kirish tekshiruvi FOOG API’ning /auth/check yo‘liga tayanadi (FOOG install.sh bilan yangilangan bo‘lishi kerak)
CHK=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/api/v1/auth/check || true)
[ "$CHK" = "401" ] || [ "$CHK" = "204" ] || die "FOOG API eski (auth/check javobi: $CHK). Avval FOOG install.sh ni ishga tushiring."

# ---------------------------------------------------------------- Docker
say "Docker tekshirilmoqda…"
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1 || ! docker buildx version >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq docker.io docker-compose-v2 docker-buildx
fi
systemctl enable --now docker >/dev/null

# 8000-port boshqa dastur bilan band bo‘lmasin (o‘zimizning konteyner bo‘lsa – mayli)
if ss -ltn "sport = :$PORT" | grep -q LISTEN && ! docker ps --format '{{.Ports}}' | grep -q "127.0.0.1:$PORT->"; then
  die "$PORT-port boshqa dastur bilan band. Uni bo‘shating yoki skriptdagi PORT ni o‘zgartiring."
fi

# ---------------------------------------------------------------- kod
say "Kod GitHub’dan olinmoqda ($BRANCH)…"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q --depth 1 origin "$BRANCH"
  git -C "$DIR" checkout -q -B "$BRANCH" FETCH_HEAD
else
  git clone -q --depth 1 --branch "$BRANCH" "$REPO" "$DIR"
fi

# ---------------------------------------------------------------- sozlamalar (faqat birinchi marta)
if [ ! -f "$APP/.env" ]; then
  say ".env yaratilmoqda…"
  cat > "$APP/.env" <<ENV
DJANGO_SECRET_KEY=$(openssl rand -hex 32)
DJANGO_ALLOWED_HOSTS=$DOMAIN,www.$DOMAIN,127.0.0.1,localhost
DJANGO_CSRF_TRUSTED_ORIGINS=https://$DOMAIN,https://www.$DOMAIN
DJANGO_SECURE_COOKIES=1
DJANGO_SSL_REDIRECT=0
# HSTS butun foog.uz ga ta’sir qiladi – ilova uni qo‘ymaydi
DJANGO_HSTS_SECONDS=0
SITE_URL=https://$DOMAIN
URL_PREFIX=$PREFIX
TRUST_PROXY_HEADERS=1
WEB_CONCURRENCY=2
# Faqat ichkariga: tashqaridan kirish nginx (foog.uz/obyektivka) orqali
WEB_PORT=127.0.0.1:$PORT
ENV
  chmod 600 "$APP/.env"
fi
# Ichki tekshiruvlar (skript va Docker healthcheck) 127.0.0.1 orqali keladi – ruxsat berilgan bo‘lsin
if ! grep -q '^DJANGO_ALLOWED_HOSTS=.*127\.0\.0\.1' "$APP/.env"; then
  sed -i 's/^DJANGO_ALLOWED_HOSTS=\(.*\)$/DJANGO_ALLOWED_HOSTS=\1,127.0.0.1,localhost/' "$APP/.env"
fi

# ---------------------------------------------------------------- qurish va ishga tushirish
say "Konteyner qurilmoqda (birinchi marta 5–10 daqiqa)…"
cd "$APP"
docker compose up -d --build --remove-orphans

say "Ilova ishga tushishi kutilmoqda…"
for _ in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break
  sleep 3
done
curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null || { docker compose logs --tail 40 web; die "Ilova javob bermadi"; }

# ---------------------------------------------------------------- nginx: foog.uz/obyektivka
say "nginx sozlanmoqda…"
mkdir -p "$NGX_DIR"
cat > "$NGX_DIR/obyektivka.conf" <<NGINX
# foog.uz$PREFIX -> Obyektivka (Docker, 127.0.0.1:$PORT).
# Faqat FOOG’ga Telegram orqali kirganlar uchun: nginx har so‘rovda FOOG API’dan so‘raydi,
# kirmagan bo‘lsa /login?next=... ga yuboradi. Prefiks olib tashlanib, ilova havolalarni o‘zi tuzadi.
location = /_foog_auth {
  internal;
  proxy_pass http://127.0.0.1:4000/api/v1/auth/check;
  proxy_pass_request_body off;
  proxy_set_header Content-Length "";
  proxy_set_header Host \$host;
  proxy_set_header Cookie \$http_cookie;
}
# reauth=1: sayt bu holatda kirish sahifasini ochadi (hisob bloklangan bo‘lsa ham aylanib qolmaydi)
location @obyektivka_login { return 302 /login?reauth=1&next=\$uri; }
location = $PREFIX { return 301 $PREFIX/; }
location ^~ $PREFIX/ {
  auth_request /_foog_auth;
  error_page 401 = @obyektivka_login;
  proxy_pass http://127.0.0.1:$PORT/;
  proxy_set_header Host \$host;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto \$scheme;
  client_max_body_size 6m;
  proxy_read_timeout 60s;
}
NGINX

# FOOG server blokiga bir marta include qo‘shiladi (certbot qo‘shgan SSL blok ham)
if ! grep -q "foog.d/\*.conf" "$NGX_CONF"; then
  BAK="$NGX_CONF.bak-$(date +%Y%m%d%H%M%S)"
  cp "$NGX_CONF" "$BAK"
  sed -i "s|^\([[:space:]]*\)location / {|\1include $NGX_DIR/*.conf;\n\1location / {|" "$NGX_CONF"
  if ! nginx -t -q 2>/dev/null; then
    cp "$BAK" "$NGX_CONF"
    die "nginx sozlamasi xato berdi – eski holatiga qaytarildi ($BAK)"
  fi
fi
nginx -t -q && systemctl reload nginx

# ---------------------------------------------------------------- tekshiruv
sleep 1
# Kirmagan foydalanuvchi /login ga yo‘naltirilishi kerak (302)
CODE=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN$PREFIX/uzb/obyektivka/" || true)
if [ "$CODE" = "302" ]; then
  say "Tayyor: https://$DOMAIN$PREFIX/ (Telegram orqali kirgandan keyin ochiladi)"
else
  say "Ilova ishlayapti, lekin https://$DOMAIN$PREFIX/ javobi: $CODE. Tekshiring: sudo nginx -T | grep -n obyektivka"
fi
echo "Loglar: cd $APP && sudo docker compose logs -f web"
