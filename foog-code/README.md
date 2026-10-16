# FOOG – Football Ecosystem for Everyone

Toshkentdagi futbolchilar va stadionlar uchun veb-sayt. Faqat veb (mobil ilova yo‘q), faqat o‘zbek tili (lotin), narxlar so‘mda, barcha vaqtlar **Asia/Tashkent**. Kirish – faqat **Telegram orqali** (bot raqam so‘raydi). Onlayn to‘lov yo‘q – **to‘lov stadionda**.

```
foog-code/
  api/   Express + TypeScript + Prisma (PostgreSQL) + Redis + WebSocket (ws) + Telegram bot
  web/   Next.js 14 (App Router, TypeScript)
  deploy/ nginx.conf, ecosystem.config.js (PM2)
  docker-compose.yml  PostgreSQL 16 + Redis 7
```

## Lokal ishga tushirish

Talablar: Node.js 20+, PostgreSQL 16, Redis 7, ffmpeg (reel videolarini qayta ishlash uchun).

```bash
docker compose up -d                 # yoki o‘zingizning Postgres/Redis
cd api && cp .env.example .env && npm ci
npx prisma migrate deploy            # jadvallar + bron kesishmasi cheklovi (EXCLUDE)
npm run seed                         # Toshkent bo‘yicha namunaviy ma’lumot
npm run dev                          # http://localhost:4000

cd ../web && cp .env.example .env.local && npm ci
npm run dev                          # http://localhost:3000
```

### Sinov hisoblari (seed)

`AUTH_DEV_LOGIN=true` va `NEXT_PUBLIC_DEV_LOGIN=true` bo‘lsa, kirish sahifasida bot o‘rniga «Sinov rejimi · botsiz» maydoni chiqadi – raqamni kiritib «Ulashish» ni bosing.

| Rol | Telefon | Kim |
|---|---|---|
| Futbolchi | +998 90 111 22 33 | Sardor Aliyev |
| Futbolchi | +998 97 300 12 45 | Diyor Mahmudov |
| Stadion egasi | +998 90 123 45 67 | Jasur Karimov (Arena Yunusobod) |
| Stadion xodimi | +998 90 100 20 31 | Otabek Yusupov |
| Admin | +998 90 000 00 01 | Nodira Azimova |

Yangi raqam kiritilsa – rol tanlash (futbolchi / stadion egasi) ekrani ochiladi.

## Muhim qoidalar qanday ta’minlangan

* **Bitta soatni ikki kishi bron qila olmaydi** – ikki qatlam: Redis qulfi (`SET NX PX`, har 30 daqiqalik bo‘lak uchun) va PostgreSQL `EXCLUDE USING gist (pitch_id WITH =, tsrange(...) WITH &&) WHERE status IN ('pending','confirmed','arrived')` cheklovi (`api/prisma/migrations/20261016130000_booking_constraints`).
* **Bron oqimi**: futbolchi so‘rov yuboradi (`pending`) → egasi/xodim tasdiqlaydi yoki sabab bilan rad etadi → 2 soatda javob bo‘lmasa worker har daqiqada `expired` qiladi (`BOOKING_TTL_MINUTES`). O‘yin kuni «Keldi» / «Kelmadi»; 3-marta kelmagan futbolchi 7 kunga avtomatik bloklanadi, u admin orqali nizo ochishi mumkin.
* **Rollar**: `player` → `/home…`, `owner` (va stadion xodimlari) → `/owner`, `admin` → `/admin`. Next.js middleware yo‘naltiradi, API har so‘rovda rolni va stadionga egalikni tekshiradi.
* **Real vaqt**: `/ws` WebSocket (qisqa muddatli token bilan). Hodisalar Redis pub/sub orqali tarqatiladi – bir nechta API nusxasi bilan ham ishlaydi.

## Build

```bash
cd api && npm run build     # prisma generate + tsc → dist/
cd web && npm run build     # next build
```

## Serverga chiqarish (Ubuntu 22.04/24.04, bitta domen)

1. **Server**: Node.js 20, PostgreSQL 16, Redis 7, ffmpeg, nginx, certbot, pm2 (`npm i -g pm2`).
2. **Kod**: `git clone … && cd foog-code`.
3. **API `.env`** (`api/.env`):
   ```env
   NODE_ENV=production
   PORT=4000
   WEB_ORIGIN=https://foog.uz
   DATABASE_URL=postgresql://foog:KUCHLI_PAROL@localhost:5432/foog?schema=public
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=<openssl rand -hex 32>
   UPLOAD_DIR=/var/lib/foog/uploads
   TELEGRAM_BOT_TOKEN=<BotFather tokeni>
   TELEGRAM_BOT_USERNAME=foog_uz_bot
   TELEGRAM_MODE=webhook
   TELEGRAM_WEBHOOK_URL=https://foog.uz/telegram/webhook
   TELEGRAM_WEBHOOK_SECRET=<openssl rand -hex 16>
   AUTH_DEV_LOGIN=false
   BOOKING_TTL_MINUTES=120
   ```
4. **Web `.env.local`** (`web/.env.local`) – build’dan **oldin**:
   ```env
   API_URL=http://127.0.0.1:4000
   NEXT_PUBLIC_WS_URL=wss://foog.uz/ws
   JWT_SECRET=<API dagi bilan bir xil>
   NEXT_PUBLIC_DEV_LOGIN=false
   NEXT_PUBLIC_BOT_USERNAME=foog_uz_bot
   ```
5. **O‘rnatish va build**:
   ```bash
   cd api && npm ci && npx prisma migrate deploy && npm run build
   # (ixtiyoriy, faqat demo uchun) npm run seed
   cd ../web && npm ci && npm run build
   cd .. && pm2 start deploy/ecosystem.config.js && pm2 save && pm2 startup
   ```
6. **Domen**: DNS’da `foog.uz` A-yozuvi → server IP. `deploy/nginx.conf` ni `/etc/nginx/sites-available/` ga ko‘chiring, `ln -s` bilan yoqing, `sudo certbot --nginx -d foog.uz -d www.foog.uz`, `nginx -t && systemctl reload nginx`.
7. **Telegram bot**:
   * @BotFather → `/newbot` → nom va username (`foog_uz_bot`) → tokenni `TELEGRAM_BOT_TOKEN` ga yozing.
   * `/setdomain` – `foog.uz` (ixtiyoriy), `/setdescription` va `/setuserpic`.
   * API ishga tushganda webhook avtomatik o‘rnatiladi (`setWebhook` + `secret_token`). Tekshirish: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`.
   * Lokal ishlab chiqishda `TELEGRAM_MODE=polling` – webhook kerak emas.
   * Oqim: saytda «Telegram orqali kirish» → `t.me/foog_uz_bot?start=<token>` → bot «Raqamni ulashish» tugmasini so‘raydi → raqam tokenga bog‘lanadi → sayt avtomatik kiradi (token 3 daqiqa amal qiladi).
8. **Zaxira nusxa**: `pg_dump foog` (kunlik cron) va `UPLOAD_DIR` papkasi.

## Tekshiruv

`foog-code` ildizida: API build, web build va lint xatosiz. Brauzer orqali (Playwright) tekshirilgan oqimlar: kirish → stadion bron → egasi tasdiqlaydi → futbolchiga bildirishnoma; o‘yinga qo‘shilish; reel yuklash (processing → published, WebSocket xabari); chatda xabar va «yozmoqda» real vaqtda; admin stadionni tekshiruv ro‘yxati bilan tasdiqlaydi; yangi foydalanuvchi rol tanlaydi; rol himoyasi (403).
