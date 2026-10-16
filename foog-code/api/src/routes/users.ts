import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { ah, bad, notFound, parse } from '../http';
import { requireAuth } from '../auth';
import { imageUpload, publicUrl } from '../uploads';
import { miniSelect, publicUser, sizeOut } from '../serialize';
import { notify } from '../notify';
import { playerStats } from './matches';
import { dateStr, timeStr } from '../time';
import { ACHIEVEMENTS } from '../services/achievements';

export const usersRouter = Router();

async function findUser(key: string) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(key);
  const u = await prisma.user.findFirst({ where: isUuid ? { id: key } : { username: key.replace(/^@/, '') } });
  if (!u) throw notFound('Foydalanuvchi topilmadi');
  return u;
}

usersRouter.put('/me', requireAuth, imageUpload('avatars').fields([{ name: 'avatar', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), ah(async (req, res) => {
  const body = parse(z.object({
    name: z.string().trim().min(2).max(60).optional(), username: z.string().trim().regex(/^[a-z0-9_.]{3,24}$/, 'Faqat lotin harflari, raqam, _ va .').optional(),
    bio: z.string().max(300).optional(), position: z.string().max(4).optional(), foot: z.enum(['left', 'right', 'both']).optional(), district: z.string().max(40).optional(),
    skill: z.enum(['beginner', 'intermediate', 'advanced']).optional(), jersey: z.coerce.number().int().min(1).max(99).optional(), available: z.string().optional(),
  }), req.body);
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const data: Record<string, unknown> = { ...body };
  if (body.available !== undefined) data.available = body.available.split(',').filter(Boolean);
  if (files?.avatar?.[0]) data.avatarUrl = publicUrl('avatars', files.avatar[0].filename);
  if (files?.cover?.[0]) data.coverUrl = publicUrl('avatars', files.cover[0].filename);
  if (body.username) {
    const ex = await prisma.user.findFirst({ where: { username: body.username, id: { not: req.user!.id } } });
    if (ex) throw bad('Bu username band');
  }
  const u = await prisma.user.update({ where: { id: req.user!.id }, data });
  res.json({ user: { ...publicUser(u), phone: u.phone } });
}));

usersRouter.get('/:key', ah(async (req, res) => {
  const u = await findUser(req.params.key);
  if (u.status === 'blocked' && req.user?.role !== 'admin' && req.user?.id !== u.id) throw notFound('Profil mavjud emas yoki bloklangan');
  const uid = req.user?.id;
  const [followers, following, isFollowing, followsMe, team, stats] = await Promise.all([
    prisma.follow.count({ where: { followingId: u.id } }), prisma.follow.count({ where: { followerId: u.id } }),
    uid ? prisma.follow.findUnique({ where: { followerId_followingId: { followerId: uid, followingId: u.id } } }) : null,
    uid ? prisma.follow.findUnique({ where: { followerId_followingId: { followerId: u.id, followingId: uid } } }) : null,
    prisma.teamMember.findFirst({ where: { userId: u.id }, include: { team: true } }),
    playerStats([u.id]),
  ]);
  let mutual: { id: string; name: string; avatarUrl: string | null }[] = [];
  let mutualCount = 0;
  if (uid && uid !== u.id) {
    const mine = (await prisma.follow.findMany({ where: { followerId: uid } })).map((f) => f.followingId);
    const where = { followingId: u.id, followerId: { in: mine } };
    mutualCount = await prisma.follow.count({ where });
    mutual = (await prisma.follow.findMany({ where, take: 2, include: { follower: { select: { id: true, name: true, avatarUrl: true } } } })).map((f) => f.follower);
  }
  res.json({
    user: { ...publicUser(u), ...(uid === u.id ? { phone: u.phone } : {}) },
    me: uid === u.id, followers, following, isFollowing: !!isFollowing, followsMe: !!followsMe, mutual, mutualCount,
    team: team && { id: team.team.id, name: team.team.name, captain: team.team.captainId === u.id },
    stats: stats.get(u.id), nextXp: u.level * 500, prevXp: (u.level - 1) * 500,
  });
}));

usersRouter.get('/:key/posts', ah(async (req, res) => {
  const u = await findUser(req.params.key);
  const rows = await prisma.post.findMany({ where: { authorId: u.id, hidden: false }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { likes: true, comments: true } } }, take: 60 });
  res.json({ items: rows.map((p) => ({ id: p.id, text: p.text, mediaUrl: p.mediaUrl, mediaType: p.mediaType, stats: p.stats, kind: p.kind, likes: p._count.likes, comments: p._count.comments, createdAt: p.createdAt })) });
}));

usersRouter.get('/:key/reels', ah(async (req, res) => {
  const u = await findUser(req.params.key);
  const mine = req.user?.id === u.id;
  const rows = await prisma.reel.findMany({ where: { authorId: u.id, hidden: false, ...(mine ? {} : { status: 'published' }) }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { likes: true } } }, take: 60 });
  res.json({ items: rows.map((r) => ({ id: r.id, caption: r.caption, posterUrl: r.posterUrl, videoUrl: r.videoUrl, status: r.status, views: r.views, likes: r._count.likes, createdAt: r.createdAt })) });
}));

usersRouter.get('/:key/matches', ah(async (req, res) => {
  const u = await findUser(req.params.key);
  const rows = await prisma.matchPlayer.findMany({ where: { userId: u.id }, include: { match: { include: { booking: { include: { pitch: { include: { stadium: true } } } }, homeTeam: true, awayTeam: true } } }, orderBy: { joinedAt: 'desc' }, take: 50 });
  res.json({
    items: rows.map((p) => {
      const m = p.match;
      const my = p.side === 'home' ? m.homeScore : m.awayScore, their = p.side === 'home' ? m.awayScore : m.homeScore;
      return { id: m.id, title: m.title, status: m.status, date: dateStr(m.booking.date), start: timeStr(m.booking.startTime), stadium: m.booking.pitch.stadium.name, size: sizeOut(m.booking.pitch.size), home: m.homeTeam?.name ?? 'Oqlar', away: m.awayTeam?.name ?? 'Qoralar', homeScore: m.homeScore, awayScore: m.awayScore, side: p.side, goals: p.goals, assists: p.assists, mvp: m.mvpId === u.id, result: m.status !== 'done' || my == null || their == null ? null : my > their ? 'W' : my === their ? 'D' : 'L' };
    }).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start)),
  });
}));

usersRouter.get('/:key/stats', ah(async (req, res) => {
  const u = await findUser(req.params.key);
  const done = await prisma.matchPlayer.findMany({ where: { userId: u.id, match: { status: 'done' } }, include: { match: { include: { booking: true } } } });
  const s = (await playerStats([u.id])).get(u.id)!;
  let w = 0, d = 0, l = 0, clean = 0;
  const byMonth = new Map<string, { goals: number; assists: number; matches: number }>();
  for (const p of done) {
    const my = (p.side === 'home' ? p.match.homeScore : p.match.awayScore) ?? 0, th = (p.side === 'home' ? p.match.awayScore : p.match.homeScore) ?? 0;
    if (my > th) w++; else if (my === th) d++; else l++;
    if (th === 0) clean++;
    const k = dateStr(p.match.booking.date).slice(0, 7);
    const e = byMonth.get(k) ?? { goals: 0, assists: 0, matches: 0 };
    e.goals += p.goals; e.assists += p.assists; e.matches++;
    byMonth.set(k, e);
  }
  const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([month, v]) => ({ month, ...v }));
  res.json({ ...s, wins: w, draws: d, losses: l, cleanSheets: clean, winRate: done.length ? Math.round((w / done.length) * 100) : 0, goalsPerMatch: done.length ? Math.round((s.goals / done.length) * 100) / 100 : 0, months });
}));

usersRouter.get('/:key/achievements', ah(async (req, res) => {
  const u = await findUser(req.params.key);
  const mine = await prisma.userAchievement.findMany({ where: { userId: u.id } });
  const totalPlayers = Math.max(1, await prisma.user.count({ where: { role: 'player' } }));
  const earnedCounts = await prisma.userAchievement.groupBy({ by: ['achievementId'], where: { earnedAt: { not: null } }, _count: true });
  res.json({
    items: ACHIEVEMENTS.map((a) => {
      const m = mine.find((x) => x.achievementId === a.id);
      const share = Math.round(((earnedCounts.find((x) => x.achievementId === a.id)?._count ?? 0) / totalPlayers) * 100);
      return { ...a, progress: m?.progress ?? 0, earnedAt: m?.earnedAt ?? null, share };
    }),
  });
}));

usersRouter.post('/:key/follow', requireAuth, ah(async (req, res) => {
  const u = await findUser(req.params.key);
  if (u.id === req.user!.id) throw bad('O‘zingizni kuzata olmaysiz');
  const where = { followerId_followingId: { followerId: req.user!.id, followingId: u.id } };
  const ex = await prisma.follow.findUnique({ where });
  if (ex) await prisma.follow.delete({ where });
  else {
    await prisma.follow.create({ data: { followerId: req.user!.id, followingId: u.id } });
    await notify(u.id, { type: 'social', kind: 'follow', title: `${req.user!.name} sizni kuzata boshladi`, actorId: req.user!.id, refType: 'user', refId: req.user!.id });
  }
  res.json({ following: !ex, followers: await prisma.follow.count({ where: { followingId: u.id } }) });
}));

usersRouter.get('/:key/:list(followers|following)', ah(async (req, res) => {
  const u = await findUser(req.params.key);
  const rows = req.params.list === 'followers'
    ? (await prisma.follow.findMany({ where: { followingId: u.id }, include: { follower: { select: miniSelect } }, take: 200 })).map((f) => f.follower)
    : (await prisma.follow.findMany({ where: { followerId: u.id }, include: { following: { select: miniSelect } }, take: 200 })).map((f) => f.following);
  res.json({ items: rows });
}));
