import http from 'http';
import { env } from './env';
import { createApp } from './app';
import { startWs } from './ws';
import { startBot } from './bot';
import { expirePending } from './routes/bookings';
import { freezeExpired } from './payments/service';
import { ensureAchievements } from './services/achievements';
import { ensureFoogiDefaults } from './foogi/defaults';

async function main() {
  const app = createApp();
  const server = http.createServer(app);
  await startWs(server);
  await ensureAchievements();
  await ensureFoogiDefaults();
  server.listen(env.port, () => console.log(`FOOG API: http://localhost:${env.port} (ws: /ws)`));
  // 2 soatda javob bo‘lmagan bron so‘rovlarini avtomatik bekor qilish – har daqiqada
  const tick = () => {
    expirePending().catch((e) => console.error('[expire]', e));
    freezeExpired().catch((e) => console.error('[freeze]', e));
  };
  tick();
  setInterval(tick, 60 * 1000);
  void startBot();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
