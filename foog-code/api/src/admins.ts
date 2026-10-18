import { prisma } from './db';
import { env } from './env';

/** Telegram’dagi adminlar: .env dagi TELEGRAM_ADMIN_CHAT_IDS + admin rolidagi, Telegram ulangan foydalanuvchilar */
export async function adminChatIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({ where: { role: 'admin', status: 'active', telegramId: { not: null } }, select: { telegramId: true } });
  return [...new Set([...env.adminChatIds, ...admins.map((a) => a.telegramId!.toString())])];
}

/** Bot orqali kelgan so‘rov adminnikimi (faqat shaxsiy chat) */
export async function isAdminChat(chatId: number | string): Promise<{ ok: boolean; userId: string | null; name: string | null }> {
  const id = String(chatId);
  const u = /^\d+$/.test(id) ? await prisma.user.findUnique({ where: { telegramId: BigInt(id) }, select: { id: true, name: true, role: true, status: true } }) : null;
  if (u && u.role === 'admin' && u.status === 'active') return { ok: true, userId: u.id, name: u.name };
  if (env.adminChatIds.includes(id)) return { ok: true, userId: u?.id ?? null, name: u?.name ?? null };
  return { ok: false, userId: null, name: null };
}
