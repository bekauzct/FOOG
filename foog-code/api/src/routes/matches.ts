import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { acquireLocks, releaseLocks } from '../redis';
import { ah, bad, conflict, forbidden, notFound, parse, qstr } from '../http';
import { requireAuth } from '../auth';
import { dateStr, dateVal, tashkentParts, timeStr } from '../time';
import { miniSelect, sizeOut } from '../serialize';
import { distanceKm, originOf } from '../services/geo';
import { notify } from '../notify';
import { publish } from '../events';
import { postSystemMessage, ensureMember, sendMessage } from './chat';
import { awardAfterMatch } from '../services/achievements';

export const matchesRouter = Router();

export const POS_GROUP: Record<string, string[]> = { GK: ['GK'], DEF: ['CB', 'LB', 'RB', 'DEF'], MID: ['CM', 'CDM', 'CAM', 'LM', 'RM', 'MID'], FWD: ['ST', 'LW', 'RW', 'CF', 'FWD'] };

type MatchRow = Prisma.MatchGetPayload<{ include: { booking: { include: { pitch: { include: { stadium: true } } } }; _count: { select: { players: true } } } }>;
export function matchCard(m: MatchRow & { players?: { user: { id: string; name: string; avatarUrl: string | null } }[] }, origin: { lat: number; lng: number }) {
  const st = m.booking.pitch.stadium;
  return {
    id: m.id, title: m.title, status: m.status, level: m.level, needs: m.needs, capacity: m.capacity, priceEach: m.priceEach,
    filled: m._count.players, date: dateStr(m.booking.date), start: timeStr(m.booking.startTime), end: timeStr(m.booking.endTime),
    size: sizeOut(m.booking.pitch.size), pitch: m.booking.pitch.name, stadium: { id: st.id, name: st.name, district: st.district },
    distanceKm: distanceKm(origin, { lat: Number(st.lat), lng: Number(st.lng) }),
    players: m.players?.map((p) => p.user) ?? [],
  };
}

const cardInclude = { booking: { include: { pitch: { include: { stadium: true } } } }, _count: { select: { players: true } }, players: { include: { user: { select: { id: true, name: true, avatarUrl: true } } }, take: 5 } } as const;

// ---------- O‘yinchilar ----------
export async function playerStats(userIds: string[]) {
  if (!userIds.length) return new Map<string, { matches: number; goals: number; assists: number; mvp: number; rating: number }>();
  const rows = await prisma.matchPlayer.groupBy({ by: ['userId'], where: { userId: { in: userIds }, match: { status: 'done' } }, _count: true, _sum: { goals: true, assists: true } });
  const mvps = await prisma.match.groupBy({ by: ['mvpId'], where: { mvpId: { in: userIds }, status: 'done' }, _count: true });
  const mm = new Map(mvps.map((x) => [x.mvpId!, x._count]));
  const out = new Map<string, { matches: number; goals: number; assists: number; mvp: number; rating: number }>();
  for (const id of userIds) {
    const r = rows.find((x) => x.userId === id);
    const matches = r?._count ?? 0, goals = r?._sum.goals ?? 0, assists = r?._sum.assists ?? 0, mvp = mm.get(id) ?? 0;
    // Reyting (0–10): asos 6, gol+assist va MVP ulushi qo‘shiladi
    const rating = matches ? Math.min(10, Math.round((6 + ((goals + assists) / matches) * 1.2 + (mvp / matches) * 4) * 10) / 10) : 0;
    out.set(id, { matches, goals, assists, mvp, rating });
  }
  return out;
}

matchesRouter.get('/players', ah(async (req, res) => {
  const q = qstr(req.query.q);
  const pos = qstr(req.query.position)?.split(',').flatMap((p) => POS_GROUP[p] ?? []);
  const skill = qstr(req.query.skill)?.split(',');
  const avail = qstr(req.query.available)?.split(',');
  const where: Prisma.UserWhereInput = { role: 'player', status: 'active' };
  if (req.user) where.id = { not: req.user.id };
  if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { district: { contains: q, mode: 'insensitive' } }, { username: { contains: q.replace(/^@/, ''), mode: 'insensitive' } }];
  if (pos?.length) where.position = { in: pos };
  if (skill?.length) where.skill = { in: skill };
  if (avail?.length) where.available = { hasSome: avail };
  const rows = await prisma.user.findMany({ where, take: 60, orderBy: { level: 'desc' } });
  const stats = await playerStats(rows.map((r) => r.id));
  const origin = originOf(req.user?.district);
  const following = req.user ? new Set((await prisma.follow.findMany({ where: { followerId: req.user.id } })).map((f) => f.followingId)) : new Set<string>();
  const { DISTRICTS } = await import('../services/geo');
  const items = rows.map((u) => ({
    id: u.id, name: u.name, username: u.username, avatarUrl: u.avatarUrl, verified: u.verified, position: u.position, skill: u.skill, level: u.level,
    district: u.district, available: u.available, online: !!u.lastSeenAt && Date.now() - u.lastSeenAt.getTime() < 5 * 60 * 1000,
    distanceKm: u.district && DISTRICTS[u.district] ? distanceKm(origin, DISTRICTS[u.district]) : null, following: following.has(u.id), ...stats.get(u.id)!,
  })).sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99));
  res.json({ items });
}));

// ---------- Jamoalar ----------
matchesRouter.get('/teams', ah(async (req, res) => {
  const q = qstr(req.query.q);
  const where: Prisma.TeamWhereInput = q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { district: { contains: q, mode: 'insensitive' } }] } : {};
  const rows = await prisma.team.findMany({ where, include: { _count: { select: { members: true } }, members: req.user ? { where: { userId: req.user.id } } : false, chats: { select: { id: true } }, homeGames: { where: { status: 'done' }, include: { booking: true } }, awayGames: { where: { status: 'done' }, include: { booking: true } } } });
  res.json({
    items: rows.map((t) => {
      const games = [...t.homeGames.map((g) => ({ d: g.booking.date, f: g.homeScore ?? 0, a: g.awayScore ?? 0 })), ...t.awayGames.map((g) => ({ d: g.booking.date, f: g.awayScore ?? 0, a: g.homeScore ?? 0 }))].sort((a, b) => b.d.getTime() - a.d.getTime());
      const res1 = games.map((g) => (g.f > g.a ? 'W' : g.f === g.a ? 'D' : 'L'));
      return { id: t.id, name: t.name, short: t.short, captainId: t.captainId, district: t.district, level: t.level, lookingFor: t.lookingFor, plays: t.plays, members: t._count.members, isMember: Array.isArray(t.members) && t.members.length > 0, chatId: t.chats[0]?.id ?? null, wins: res1.filter((x) => x === 'W').length, draws: res1.filter((x) => x === 'D').length, losses: res1.filter((x) => x === 'L').length, form: res1.slice(0, 5) };
    }).sort((a, b) => b.members - a.members),
  });
}));

matchesRouter.post('/teams', requireAuth, ah(async (req, res) => {
  const body = parse(z.object({ name: z.string().trim().min(2).max(40), short: z.string().trim().min(2).max(4), district: z.string().max(40).optional(), level: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'), lookingFor: z.array(z.string()).max(6).default([]), plays: z.string().max(60).optional() }), req.body);
  const t = await prisma.team.create({ data: { ...body, short: body.short.toUpperCase(), captainId: req.user!.id, members: { create: { userId: req.user!.id } }, chats: { create: { type: 'team', name: body.name, members: { create: { userId: req.user!.id } } } } }, include: { chats: true } });
  res.status(201).json({ id: t.id, chatId: t.chats[0].id });
}));

matchesRouter.post('/teams/:id/join', requireAuth, ah(async (req, res) => {
  const t = await prisma.team.findUnique({ where: { id: req.params.id }, include: { chats: true } });
  if (!t) throw notFound('Jamoa topilmadi');
  await prisma.teamMember.upsert({ where: { teamId_userId: { teamId: t.id, userId: req.user!.id } }, update: {}, create: { teamId: t.id, userId: req.user!.id } });
  let chatId = t.chats[0]?.id;
  if (!chatId) chatId = (await prisma.chat.create({ data: { type: 'team', teamId: t.id, name: t.name } })).id;
  await ensureMember(chatId, req.user!.id);
  await postSystemMessage(chatId, req.user!.id, `${req.user!.name} jamoaga qo‘shildi`);
  await notify(t.captainId, { type: 'social', kind: 'team_join', title: `${req.user!.name} ${t.name} jamoasiga qo‘shildi`, actorId: req.user!.id, refType: 'team', refId: t.id });
  res.json({ joined: true, chatId });
}));

// ---------- O‘yinlar ----------
matchesRouter.get('/matches', ah(async (req, res) => {
  const now = tashkentParts();
  const date = qstr(req.query.date);
  const level = qstr(req.query.level);
  const district = qstr(req.query.district);
  const where: Prisma.MatchWhereInput = { status: { in: ['open', 'full'] }, booking: { status: { in: ['confirmed', 'pending'] }, date: date ? dateVal(date) : { gte: dateVal(now.date) } } };
  if (level && level !== 'any') where.level = { in: [level, 'any'] };
  if (district) where.booking = { ...(where.booking as object), pitch: { stadium: { district } } };
  const rows = await prisma.match.findMany({ where, include: cardInclude, take: 60 });
  const origin = originOf(req.user?.district);
  const mine = req.user ? new Set((await prisma.matchPlayer.findMany({ where: { userId: req.user.id, matchId: { in: rows.map((r) => r.id) } } })).map((p) => p.matchId)) : new Set<string>();
  const items = rows.map((m) => ({ ...matchCard(m, origin), joined: mine.has(m.id) }))
    .filter((m) => m.date > now.date || Number(m.start.slice(0, 2)) > now.hour)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  res.json({ items });
}));

matchesRouter.get('/matches/:id', ah(async (req, res) => {
  const m = await prisma.match.findUnique({ where: { id: req.params.id }, include: { ...cardInclude, players: { include: { user: { select: { ...miniSelect, level: true } } }, orderBy: { joinedAt: 'asc' } }, organizer: { select: miniSelect }, homeTeam: true, awayTeam: true, mvp: { select: miniSelect }, chats: { select: { id: true } } } });
  if (!m) throw notFound('O‘yin topilmadi');
  const origin = originOf(req.user?.district);
  const joined = req.user ? m.players.some((p) => p.userId === req.user!.id) : false;
  res.json({
    ...matchCard({ ...m, players: [] }, origin), organizer: m.organizer, joined, isOrganizer: req.user?.id === m.organizerId,
    players: m.players.map((p) => ({ ...p.user, side: p.side, goals: p.goals, assists: p.assists })), chatId: joined ? m.chats[0]?.id ?? null : null,
    homeTeam: m.homeTeam && { id: m.homeTeam.id, name: m.homeTeam.name, short: m.homeTeam.short }, awayTeam: m.awayTeam && { id: m.awayTeam.id, name: m.awayTeam.name, short: m.awayTeam.short },
    homeScore: m.homeScore, awayScore: m.awayScore, mvp: m.mvp,
  });
}));

matchesRouter.post('/matches', requireAuth, ah(async (req, res) => {
  const body = parse(z.object({ bookingId: z.string().uuid(), title: z.string().trim().min(3).max(60), capacity: z.number().int().min(2).max(30), level: z.enum(['any', 'beginner', 'intermediate', 'advanced']).default('any'), needs: z.array(z.string()).max(6).default([]), homeTeamId: z.string().uuid().optional() }), req.body);
  const b = await prisma.booking.findUnique({ where: { id: body.bookingId }, include: { match: true } });
  if (!b || b.userId !== req.user!.id) throw notFound('Bron topilmadi');
  if (!['pending', 'confirmed'].includes(b.status)) throw bad('O‘yin faqat faol bron asosida ochiladi');
  if (b.match) throw bad('Bu bron uchun o‘yin allaqachon ochilgan');
  const priceEach = Math.ceil(b.price / body.capacity / 1000) * 1000;
  const m = await prisma.match.create({
    data: { ...body, organizerId: req.user!.id, priceEach, players: { create: { userId: req.user!.id, side: 'home' } }, chats: { create: { type: 'match', name: body.title, members: { create: { userId: req.user!.id } } } } },
    include: { chats: true },
  });
  res.status(201).json({ id: m.id, chatId: m.chats[0].id });
}));

/** O‘yinga qo‘shilish: Redis qulfi bilan – oxirgi bo‘sh joyni ikki kishi ololmaydi */
export async function joinMatch(matchId: string, user: { id: string; name: string }) {
  const lockKey = `lock:match:${matchId}`;
  const token = await acquireLocks([lockKey], 5000);
  if (!token) throw conflict('Hozir boshqa o‘yinchi qo‘shilmoqda, qayta urinib ko‘ring');
  try {
    const m = await prisma.match.findUnique({ where: { id: matchId }, include: { players: true, chats: true, booking: true } });
    if (!m) throw notFound('O‘yin topilmadi');
    if (m.players.some((p) => p.userId === user.id)) return { joined: true, chatId: m.chats[0]?.id ?? null, already: true };
    if (m.status === 'cancelled' || m.status === 'done') throw bad('O‘yin yakunlangan yoki bekor qilingan');
    if (m.players.length >= m.capacity) throw conflict('O‘yin to‘ldi', 'full');
    const home = m.players.filter((p) => p.side === 'home').length;
    const side = home <= m.players.length - home ? 'home' : 'away';
    await prisma.matchPlayer.create({ data: { matchId, userId: user.id, side } });
    const full = m.players.length + 1 >= m.capacity;
    if (full) await prisma.match.update({ where: { id: matchId }, data: { status: 'full' } });
    let chatId = m.chats[0]?.id;
    if (!chatId) chatId = (await prisma.chat.create({ data: { type: 'match', matchId, name: m.title } })).id;
    await ensureMember(chatId, user.id);
    await postSystemMessage(chatId, user.id, `${user.name} o‘yinga qo‘shildi · ${m.players.length + 1}/${m.capacity}`);
    await notify(m.organizerId, { type: 'match', kind: 'match_join', title: `${user.name} «${m.title}» o‘yiniga qo‘shildi`, body: `${m.players.length + 1}/${m.capacity} o‘yinchi`, actorId: user.id, refType: 'match', refId: m.id });
    await publish(m.players.map((p) => p.userId), 'match', { id: m.id, filled: m.players.length + 1 });
    return { joined: true, chatId, full };
  } finally {
    await releaseLocks([lockKey], token);
  }
}

matchesRouter.post('/matches/:id/join', requireAuth, ah(async (req, res) => {
  res.json(await joinMatch(req.params.id, req.user!));
}));

matchesRouter.post('/matches/:id/leave', requireAuth, ah(async (req, res) => {
  const m = await prisma.match.findUnique({ where: { id: req.params.id }, include: { chats: true } });
  if (!m) throw notFound();
  if (m.organizerId === req.user!.id) throw bad('Tashkilotchi o‘yindan chiqa olmaydi – bronni bekor qiling');
  await prisma.matchPlayer.deleteMany({ where: { matchId: m.id, userId: req.user!.id } });
  if (m.status === 'full') await prisma.match.update({ where: { id: m.id }, data: { status: 'open' } });
  if (m.chats[0]) await prisma.chatMember.deleteMany({ where: { chatId: m.chats[0].id, userId: req.user!.id } });
  res.json({ joined: false });
}));

matchesRouter.post('/matches/:id/invite', requireAuth, ah(async (req, res) => {
  const { userId } = parse(z.object({ userId: z.string().uuid() }), req.body);
  const m = await prisma.match.findUnique({ where: { id: req.params.id }, include: { players: true, booking: { include: { pitch: { include: { stadium: true } } } } } });
  if (!m) throw notFound('O‘yin topilmadi');
  if (!m.players.some((p) => p.userId === req.user!.id)) throw forbidden('Faqat o‘yin ishtirokchilari taklif qila oladi');
  if (m.players.some((p) => p.userId === userId)) throw bad('Bu o‘yinchi allaqachon o‘yinda');
  const inv = await prisma.matchInvite.upsert({ where: { matchId_toId: { matchId: m.id, toId: userId } }, update: { status: 'pending', fromId: req.user!.id }, create: { matchId: m.id, fromId: req.user!.id, toId: userId } });
  const when = `${dateStr(m.booking.date)} ${timeStr(m.booking.startTime)}`;
  await notify(userId, { type: 'invite', kind: 'match_invite', title: `${req.user!.name} sizni «${m.title}» o‘yiniga taklif qildi`, body: `${m.booking.pitch.stadium.name} · ${when}`, actorId: req.user!.id, refType: 'invite', refId: inv.id, data: { matchId: m.id, date: dateStr(m.booking.date), start: timeStr(m.booking.startTime), stadium: m.booking.pitch.stadium.name } });
  // Shaxsiy chatga o‘yin taklifi kartasi
  const { dmChat } = await import('./chat');
  const chat = await dmChat(req.user!.id, userId);
  await sendMessage(chat.id, req.user!.id, { type: 'match_invite', body: '', refId: m.id });
  res.status(201).json({ id: inv.id, chatId: chat.id });
}));

matchesRouter.post('/invites/:id/:action(accept|decline)', requireAuth, ah(async (req, res) => {
  const inv = await prisma.matchInvite.findUnique({ where: { id: req.params.id } });
  if (!inv || inv.toId !== req.user!.id) throw notFound('Taklif topilmadi');
  if (req.params.action === 'decline') {
    await prisma.matchInvite.update({ where: { id: inv.id }, data: { status: 'declined' } });
    return res.json({ status: 'declined' });
  }
  const r = await joinMatch(inv.matchId, req.user!);
  await prisma.matchInvite.update({ where: { id: inv.id }, data: { status: 'accepted' } });
  res.json({ status: 'accepted', ...r });
}));

matchesRouter.get('/me/matches', requireAuth, ah(async (req, res) => {
  const now = tashkentParts();
  const rows = await prisma.match.findMany({ where: { players: { some: { userId: req.user!.id } }, status: { in: ['open', 'full'] }, booking: { date: { gte: dateVal(now.date) } } }, include: cardInclude });
  const origin = originOf(req.user!.district);
  const bookings = await prisma.booking.findMany({ where: { userId: req.user!.id, status: { in: ['pending', 'confirmed'] }, date: { gte: dateVal(now.date) }, match: null }, include: { pitch: { include: { stadium: true } } }, orderBy: [{ date: 'asc' }, { startTime: 'asc' }] });
  res.json({ matches: rows.map((m) => matchCard(m, origin)), bookingsWithoutMatch: bookings.map((b) => ({ id: b.id, code: b.code, date: dateStr(b.date), start: timeStr(b.startTime), end: timeStr(b.endTime), stadium: b.pitch.stadium.name, pitch: b.pitch.name, size: sizeOut(b.pitch.size), price: b.price })) });
}));

matchesRouter.post('/matches/:id/result', requireAuth, ah(async (req, res) => {
  const body = parse(z.object({ homeScore: z.number().int().min(0).max(50), awayScore: z.number().int().min(0).max(50), mvpId: z.string().uuid().optional(), players: z.array(z.object({ userId: z.string().uuid(), goals: z.number().int().min(0).max(30), assists: z.number().int().min(0).max(30), side: z.enum(['home', 'away']).optional() })).default([]) }), req.body);
  const m = await prisma.match.findUnique({ where: { id: req.params.id }, include: { players: true, booking: true, homeTeam: true, awayTeam: true } });
  if (!m) throw notFound();
  if (m.organizerId !== req.user!.id) throw forbidden('Natijani faqat tashkilotchi kiritadi');
  const now = tashkentParts();
  const d = dateStr(m.booking.date);
  if (d > now.date || (d === now.date && m.booking.startTime.getUTCHours() > now.hour)) throw bad('O‘yin hali boshlanmagan');
  await prisma.$transaction([
    prisma.match.update({ where: { id: m.id }, data: { homeScore: body.homeScore, awayScore: body.awayScore, mvpId: body.mvpId, status: 'done' } }),
    ...body.players.filter((p) => m.players.some((x) => x.userId === p.userId)).map((p) => prisma.matchPlayer.update({ where: { matchId_userId: { matchId: m.id, userId: p.userId } }, data: { goals: p.goals, assists: p.assists, ...(p.side ? { side: p.side } : {}) } })),
  ]);
  await awardAfterMatch(m.id);
  const home = m.homeTeam?.name ?? 'Oqlar', away = m.awayTeam?.name ?? 'Qoralar';
  for (const p of m.players) {
    const mine = body.players.find((x) => x.userId === p.userId);
    await notify(p.userId, { type: 'match', kind: 'match_result', title: `Yakuniy hisob: ${home} ${body.homeScore}–${body.awayScore} ${away}${body.mvpId === p.userId ? '. Siz MVP bo‘ldingiz' : ''}`, body: mine ? `${mine.goals} gol · ${mine.assists} assist` : undefined, actorId: req.user!.id, refType: 'match', refId: m.id });
  }
  res.json({ ok: true });
}));
