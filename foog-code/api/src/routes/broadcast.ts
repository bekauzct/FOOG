import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { ah, conflict, parse } from '../http';
import { requireRole } from '../auth';
import { audit, notify } from '../notify';
import { publish } from '../events';
import { tgSend } from '../telegram';
import { env } from '../env';

/** Admin e’lonlari: hamma (yoki tanlangan rol) foydalanuvchilarga sayt bildirishnomasi + Telegram xabari */
export const adminBroadcastRouter = Router();
adminBroadcastRouter.use(requireRole('admin'));

const TARGETS = ['all', 'player', 'owner'] as const;
type Target = (typeof TARGETS)[number];
// Bloklanganlar olmaydi; "all" – adminlar ham oladi
const whereOf = (t: Target): Prisma.UserWhereInput => ({ status: 'active', ...(t === 'all' ? {} : { role: t }) });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tgText = (title: string, body: string) => `📣 <b>${esc(title)}</b>\n\n${esc(body)}\n\n${env.webOrigin}`;
const TG_GAP_MS = 50; // ~20 ta/soniya – Telegram chegarasidan (30/s) past

adminBroadcastRouter.get('/', ah(async (_req, res) => {
  const [counts, tg, items] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], where: { status: 'active' }, _count: true }),
    prisma.user.groupBy({ by: ['role'], where: { status: 'active', telegramId: { not: null } }, _count: true }),
    prisma.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
  ]);
  const sum = (rows: { role: string; _count: number }[], t: Target) => rows.filter((r) => t === 'all' || r.role === t).reduce((a, r) => a + r._count, 0);
  res.json({ audience: Object.fromEntries(TARGETS.map((t) => [t, { users: sum(counts, t), telegram: sum(tg, t) }])), botOn: !!env.botToken, items });
}));

const bodySchema = z.object({ title: z.string().trim().min(3).max(80), body: z.string().trim().min(3).max(1500), target: z.enum(TARGETS), test: z.boolean().optional() });

adminBroadcastRouter.post('/', ah(async (req, res) => {
  const b = parse(bodySchema, req.body);
  const me = req.user!;
  // Sinov: faqat adminning o‘ziga – ko‘rinishini tekshirish uchun
  if (b.test) {
    await notify(me.id, { type: 'system', kind: 'announcement', title: b.title, body: b.body });
    const tg = me.telegramId ? await tgSend(me.telegramId, tgText(b.title, b.body)) : 'off';
    return res.json({ test: true, telegram: tg });
  }
  if (await prisma.broadcast.findFirst({ where: { status: 'sending' } })) throw conflict('Oldingi e’lon hali yuborilmoqda. Tugashini kuting.');
  const users = await prisma.user.findMany({ where: whereOf(b.target), select: { id: true, telegramId: true } });
  const tgUsers = users.filter((u) => u.telegramId);
  const bc = await prisma.broadcast.create({ data: { actorId: me.id, title: b.title, body: b.body, target: b.target, recipients: users.length, tgTotal: env.botToken ? tgUsers.length : 0 } });
  // Sayt bildirishnomalari darhol (qo‘ng‘iroqcha), Telegram – fonda navbat bilan
  await prisma.notification.createMany({ data: users.map((u) => ({ userId: u.id, type: 'system', kind: 'announcement', title: b.title, body: b.body, refType: 'broadcast', refId: bc.id })) });
  await audit(me.id, 'broadcast.send', `E’lon yubordi (${b.target}, ${users.length} kishi): ${b.title}`, 'broadcast', bc.id);
  res.json({ id: bc.id, recipients: users.length, telegram: bc.tgTotal });

  void (async () => {
    // Ochiq sahifalarda qo‘ng‘iroqcha sanog‘i darhol yangilanadi
    for (const u of users) {
      const unread = await prisma.notification.count({ where: { userId: u.id, readAt: null } });
      await publish(u.id, 'notification', { title: b.title, unread }).catch(() => undefined);
    }
    let sent = 0, failed = 0;
    if (env.botToken) {
      const text = tgText(b.title, b.body);
      for (const [i, u] of tgUsers.entries()) {
        if ((await tgSend(u.telegramId!, text)) === 'sent') sent++; else failed++;
        if (i % 20 === 19) await prisma.broadcast.update({ where: { id: bc.id }, data: { tgSent: sent, tgFailed: failed } });
        await new Promise((r) => setTimeout(r, TG_GAP_MS));
      }
    }
    await prisma.broadcast.update({ where: { id: bc.id }, data: { tgSent: sent, tgFailed: failed, status: 'done', finishedAt: new Date() } });
  })().catch((e) => console.error('[broadcast]', e));
}));

/** Server qayta ishga tushganda yarim yo‘lda qolgan yuborishlar "uzilgan" deb belgilanadi (qayta yuborilmaydi – takror xabar bo‘lmasin) */
export const markInterruptedBroadcasts = () => prisma.broadcast.updateMany({ where: { status: 'sending' }, data: { status: 'interrupted', finishedAt: new Date() } });
