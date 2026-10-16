import { prisma } from './db';
import { redis } from './redis';
import { env } from './env';
import { tg } from './telegram';
import { getLogin, normalizePhone, setLogin } from './routes/auth';

type TgUpdate = {
  update_id: number;
  message?: {
    chat: { id: number };
    from?: { id: number; first_name?: string; last_name?: string; username?: string };
    text?: string;
    contact?: { phone_number: string; user_id?: number; first_name?: string };
  };
};

/** Telegram bot: /start <token> → raqam so‘raydi → raqamni login tokeniga bog‘laydi */
export async function handleUpdate(u: TgUpdate) {
  const m = u.message;
  if (!m?.from) return;
  const chatId = m.chat.id;
  if (m.text?.startsWith('/start')) {
    const token = m.text.split(' ')[1];
    if (!token || !(await getLogin(token))) {
      await tg('sendMessage', { chat_id: chatId, text: 'Salom! FOOG saytiga kirish uchun saytdagi «Telegram orqali kirish» tugmasini bosing.' });
      return;
    }
    await redis.set(`tgchat:${m.from.id}`, token, 'EX', 300);
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'FOOG ga xush kelibsiz! Kirish uchun raqamingizni ulashing.',
      reply_markup: { keyboard: [[{ text: '📱 Raqamni ulashish', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
    });
    return;
  }
  if (m.contact) {
    if (m.contact.user_id !== m.from.id) {
      await tg('sendMessage', { chat_id: chatId, text: 'Iltimos, faqat o‘z raqamingizni tugma orqali ulashing.' });
      return;
    }
    const token = await redis.get(`tgchat:${m.from.id}`);
    const s = token ? await getLogin(token) : null;
    if (!token || !s) {
      await tg('sendMessage', { chat_id: chatId, text: 'Kirish havolasi muddati tugadi. Saytda qaytadan «Telegram orqali kirish» ni bosing.', reply_markup: { remove_keyboard: true } });
      return;
    }
    const phone = normalizePhone(m.contact.phone_number);
    await setLogin(token, { status: 'shared', phone, telegramId: String(m.from.id), firstName: [m.from.first_name, m.from.last_name].filter(Boolean).join(' '), username: m.from.username });
    await redis.del(`tgchat:${m.from.id}`);
    // Mavjud foydalanuvchida telegram_id bo‘lmasa – bog‘laymiz
    await prisma.user.updateMany({ where: { phone, telegramId: null }, data: { telegramId: BigInt(m.from.id) } });
    await tg('sendMessage', { chat_id: chatId, text: '✅ Raqam tasdiqlandi. Saytga qayting – kirish avtomatik davom etadi.', reply_markup: { remove_keyboard: true } });
  }
}

let offset = 0;
let running = false;
export async function startBot() {
  if (!env.botToken) {
    console.log('[bot] TELEGRAM_BOT_TOKEN yo‘q – bot o‘chiq (AUTH_DEV_LOGIN bilan sinash mumkin)');
    return;
  }
  if (env.botMode === 'webhook') {
    if (env.webhookUrl) await tg('setWebhook', { url: env.webhookUrl, secret_token: env.webhookSecret, allowed_updates: ['message'] });
    console.log('[bot] webhook rejimi');
    return;
  }
  await tg('deleteWebhook', {});
  running = true;
  console.log('[bot] polling rejimi');
  (async function loop() {
    while (running) {
      const res = (await tg('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] })) as TgUpdate[] | null;
      if (!res) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      for (const u of res) {
        offset = u.update_id + 1;
        await handleUpdate(u).catch((e) => console.error('[bot]', e));
      }
    }
  })();
}
