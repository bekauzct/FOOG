import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { ah, parse, qstr } from '../http';
import { requireAuth } from '../auth';
import { miniSelect } from '../serialize';
import { publish } from '../events';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', ah(async (req, res) => {
  const uid = req.user!.id;
  const tab = qstr(req.query.tab) ?? 'all';
  const where: Prisma.NotificationWhereInput = { userId: uid };
  if (['invite', 'match', 'booking', 'social'].includes(tab)) where.type = tab;
  if (tab === 'unread') where.readAt = null;
  const rows = await prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter(Boolean) as string[])];
  const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: miniSelect });
  const inviteIds = rows.filter((r) => r.refType === 'invite' && r.refId).map((r) => r.refId!);
  const invites = await prisma.matchInvite.findMany({ where: { id: { in: inviteIds } } });
  const following = new Set((await prisma.follow.findMany({ where: { followerId: uid, followingId: { in: actorIds } } })).map((f) => f.followingId));
  // Rasmli bildirishnomalar uchun kichik ko‘rinish (reel / post)
  const reelIds = rows.filter((r) => r.refType === 'reel' && r.refId).map((r) => r.refId!);
  const postIds = rows.filter((r) => r.refType === 'post' && r.refId).map((r) => r.refId!);
  const [reels, posts] = await Promise.all([
    prisma.reel.findMany({ where: { id: { in: reelIds } }, select: { id: true, posterUrl: true } }),
    prisma.post.findMany({ where: { id: { in: postIds } }, select: { id: true, mediaUrl: true, mediaType: true } }),
  ]);
  const counts = await prisma.notification.groupBy({ by: ['type'], where: { userId: uid, readAt: null }, _count: true });
  res.json({
    unread: counts.reduce((a, c) => a + c._count, 0),
    counts: Object.fromEntries(counts.map((c) => [c.type, c._count])),
    items: rows.map((r) => ({
      id: r.id, type: r.type, kind: r.kind, title: r.title, body: r.body, refType: r.refType, refId: r.refId, data: r.data, read: !!r.readAt, createdAt: r.createdAt,
      actor: actors.find((a) => a.id === r.actorId) ?? null, followingActor: r.actorId ? following.has(r.actorId) : false,
      invite: r.refType === 'invite' ? invites.find((i) => i.id === r.refId)?.status ?? null : null,
      thumb: r.refType === 'reel' ? reels.find((x) => x.id === r.refId)?.posterUrl ?? null : r.refType === 'post' ? (posts.find((x) => x.id === r.refId && x.mediaType === 'image')?.mediaUrl ?? null) : null,
    })),
  });
}));

notificationsRouter.get('/unread-count', ah(async (req, res) => {
  res.json({ unread: await prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }) });
}));

notificationsRouter.patch('/read', ah(async (req, res) => {
  const body = parse(z.object({ ids: z.array(z.string().uuid()).optional(), all: z.boolean().optional() }), req.body);
  await prisma.notification.updateMany({ where: { userId: req.user!.id, readAt: null, ...(body.all ? {} : { id: { in: body.ids ?? [] } }) }, data: { readAt: new Date() } });
  const unread = await prisma.notification.count({ where: { userId: req.user!.id, readAt: null } });
  await publish(req.user!.id, 'notification', { unread });
  res.json({ unread });
}));
