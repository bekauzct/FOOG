import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { publish } from './events';
import { sendTelegram } from './telegram';

export type NotifyInput = {
  type: 'invite' | 'match' | 'booking' | 'social' | 'system';
  kind: string;
  title: string;
  body?: string;
  actorId?: string | null;
  refType?: string;
  refId?: string | null;
  data?: Record<string, unknown>;
  /** Telegramga ham yuborilsinmi (muhim xabarlar: bron, moderatsiya) */
  telegram?: string;
};

export async function notify(userId: string, n: NotifyInput) {
  if (n.actorId && n.actorId === userId) return null;
  const row = await prisma.notification.create({
    data: {
      userId, type: n.type, kind: n.kind, title: n.title, body: n.body, actorId: n.actorId ?? undefined,
      refType: n.refType, refId: n.refId ?? undefined, data: (n.data ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
  const unread = await prisma.notification.count({ where: { userId, readAt: null } });
  await publish(userId, 'notification', { id: row.id, title: row.title, unread });
  if (n.telegram) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { telegramId: true } });
    await sendTelegram(u?.telegramId, n.telegram);
  }
  return row;
}

export async function audit(actorId: string | null, action: string, text: string, targetType?: string, targetId?: string) {
  await prisma.auditLog.create({ data: { actorId, action, text, targetType, targetId } });
}
