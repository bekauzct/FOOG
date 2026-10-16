import 'dotenv/config';

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error(`.env: ${name} berilmagan`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  databaseUrl: req('DATABASE_URL'),
  redisUrl: req('REDIS_URL', 'redis://localhost:6379'),
  jwtSecret: req('JWT_SECRET'),
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  botUsername: process.env.TELEGRAM_BOT_USERNAME ?? 'foog_uz_bot',
  botMode: (process.env.TELEGRAM_MODE ?? 'polling') as 'polling' | 'webhook',
  webhookUrl: process.env.TELEGRAM_WEBHOOK_URL ?? '',
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
  devLogin: process.env.AUTH_DEV_LOGIN === 'true',
  bookingTtlMin: Number(process.env.BOOKING_TTL_MINUTES ?? 120),
};

if (env.jwtSecret.length < 32) throw new Error('.env: JWT_SECRET kamida 32 belgi bo‘lsin');
