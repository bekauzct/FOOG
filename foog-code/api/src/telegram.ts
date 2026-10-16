import { env } from './env';

const api = (method: string) => `https://api.telegram.org/bot${env.botToken}/${method}`;

export async function tg(method: string, body: Record<string, unknown>) {
  if (!env.botToken) return null;
  try {
    const r = await fetch(api(method), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = (await r.json()) as { ok: boolean; result?: unknown; description?: string };
    if (!j.ok) console.warn('[telegram]', method, j.description);
    return j.result ?? null;
  } catch (e) {
    console.warn('[telegram] ulanib bo‘lmadi:', (e as Error).message);
    return null;
  }
}

/** Foydalanuvchiga Telegram orqali xabar (bot tokeni bo‘lmasa jim o‘tadi) */
export async function sendTelegram(chatId: bigint | null | undefined, text: string) {
  if (!chatId) return;
  await tg('sendMessage', { chat_id: chatId.toString(), text, parse_mode: 'HTML', disable_web_page_preview: true });
}
