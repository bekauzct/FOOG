import { Router } from 'express';
import { z } from 'zod';
import type { Message, MessageType } from '@prisma/client';
import { prisma } from '../db';
import { ah, bad, forbidden, notFound, parse, qstr } from '../http';
import { requireAuth } from '../auth';
import { publish } from '../events';
import { mediaUpload, isVideo, publicUrl } from '../uploads';
import { miniSelect, sizeOut } from '../serialize';
import { dateStr, timeStr } from '../time';
import { notify } from '../notify';

export const chatRouter = Router();
chatRouter.use(requireAuth);

export async function ensureMember(chatId: string, userId: string) {
  await prisma.chatMember.upsert({ where: { chatId_userId: { chatId, userId } }, update: {}, create: { chatId, userId, lastReadAt: new Date() } });
}

export async function dmChat(a: string, b: string) {
  if (a === b) throw bad('O‘zingizga xabar yoza olmaysiz');
  const key = [a, b].sort().join(':');
  const ex = await prisma.chat.findUnique({ where: { dmKey: key } });
  if (ex) return ex;
  return prisma.chat.create({ data: { type: 'dm', dmKey: key, members: { create: [{ userId: a }, { userId: b }] } } });
}

/** Xabar kartalari uchun bog‘langan obyektni yuklaydi */
async function enrich(msgs: (Message & { sender: { id: string; name: string; avatarUrl: string | null; username: string | null } })[]) {
  const ids = (t: MessageType) => msgs.filter((m) => m.type === t && m.refId).map((m) => m.refId!);
  const [matches, stadiums, profiles, reels] = await Promise.all([
    prisma.match.findMany({ where: { id: { in: ids('match_invite') } }, include: { booking: { include: { pitch: { include: { stadium: true } } } }, _count: { select: { players: true } } } }),
    prisma.stadium.findMany({ where: { id: { in: ids('stadium') } }, include: { photos: { take: 1, orderBy: { sort: 'asc' } }, pitches: { where: { active: true } } } }),
    prisma.user.findMany({ where: { id: { in: ids('profile') } }, select: { ...miniSelect, level: true } }),
    prisma.reel.findMany({ where: { id: { in: ids('reel') } }, include: { author: { select: miniSelect } } }),
  ]);
  return msgs.map((m) => {
    let card: unknown = null;
    if (m.type === 'match_invite') {
      const x = matches.find((y) => y.id === m.refId);
      if (x) card = { id: x.id, title: x.title, date: dateStr(x.booking.date), start: timeStr(x.booking.startTime), stadium: x.booking.pitch.stadium.name, size: sizeOut(x.booking.pitch.size), filled: x._count.players, capacity: x.capacity, priceEach: x.priceEach, status: x.status };
    } else if (m.type === 'stadium') {
      const x = stadiums.find((y) => y.id === m.refId);
      if (x) card = { id: x.id, name: x.name, district: x.district, photo: x.photos[0]?.url ?? null, price: Math.min(...x.pitches.map((p) => p.price)) };
    } else if (m.type === 'profile') card = profiles.find((y) => y.id === m.refId) ?? null;
    else if (m.type === 'reel') {
      const x = reels.find((y) => y.id === m.refId);
      if (x) card = { id: x.id, caption: x.caption, posterUrl: x.posterUrl, author: x.author };
    }
    return { id: m.id, chatId: m.chatId, type: m.type, body: m.body, mediaUrl: m.mediaUrl, refId: m.refId, card, createdAt: m.createdAt, sender: m.sender };
  });
}

export async function sendMessage(chatId: string, senderId: string, d: { type: MessageType; body?: string; refId?: string | null; mediaUrl?: string | null }) {
  const msg = await prisma.message.create({ data: { chatId, senderId, type: d.type, body: d.body ?? '', refId: d.refId ?? undefined, mediaUrl: d.mediaUrl ?? undefined }, include: { sender: { select: { id: true, name: true, avatarUrl: true, username: true } } } });
  await prisma.chatMember.update({ where: { chatId_userId: { chatId, userId: senderId } }, data: { lastReadAt: msg.createdAt } }).catch(() => undefined);
  const [out] = await enrich([msg]);
  const members = await prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
  await publish(members.map((m) => m.userId), 'message', out);
  return out;
}

export async function postSystemMessage(chatId: string, senderId: string, body: string) {
  return sendMessage(chatId, senderId, { type: 'system', body });
}

async function assertMember(chatId: string, userId: string) {
  const m = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId } } });
  if (!m) throw forbidden('Siz bu chat a’zosi emassiz');
  return m;
}

const PREVIEW: Record<string, string> = { photo: 'Rasm', video: 'Video', match_invite: 'O‘yin taklifi', stadium: 'Stadion', profile: 'Profil', reel: 'Reel' };

chatRouter.get('/', ah(async (req, res) => {
  const uid = req.user!.id;
  const type = qstr(req.query.type);
  const mem = await prisma.chatMember.findMany({
    where: { userId: uid, ...(type ? { chat: { type: type as 'dm' } } : {}) },
    include: { chat: { include: { members: { include: { user: { select: { ...miniSelect, lastSeenAt: true } } } }, messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { name: true } } } }, team: true } } },
  });
  const items = await Promise.all(mem.map(async (m) => {
    const c = m.chat;
    const last = c.messages[0];
    const other = c.type === 'dm' ? c.members.find((x) => x.userId !== uid)?.user : null;
    const unread = await prisma.message.count({ where: { chatId: c.id, senderId: { not: uid }, ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}) } });
    const preview = last ? (last.type === 'text' || last.type === 'system' ? last.body : PREVIEW[last.type] ?? '') : '';
    return {
      id: c.id, type: c.type, name: other?.name ?? c.name ?? 'Chat', short: c.team?.short ?? null, avatarUrl: other?.avatarUrl ?? null, other,
      online: !!other?.lastSeenAt && Date.now() - other.lastSeenAt.getTime() < 5 * 60 * 1000, muted: m.muted,
      last: last ? { text: c.type !== 'dm' && last.type === 'text' ? `${last.sender.name.split(' ')[0]}: ${preview}` : preview, at: last.createdAt, mine: last.senderId === uid } : null,
      unread, members: c.members.length, at: last?.createdAt ?? c.createdAt,
    };
  }));
  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  res.json({ items });
}));

chatRouter.post('/dm', ah(async (req, res) => {
  const { userId } = parse(z.object({ userId: z.string().uuid() }), req.body);
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) throw notFound('Foydalanuvchi topilmadi');
  const c = await dmChat(req.user!.id, userId);
  res.json({ id: c.id });
}));

chatRouter.get('/communities', ah(async (req, res) => {
  const rows = await prisma.chat.findMany({ where: { type: 'community' }, include: { _count: { select: { members: true } }, members: { where: { userId: req.user!.id } } } });
  res.json({ items: rows.map((c) => ({ id: c.id, name: c.name, members: c._count.members, joined: c.members.length > 0 })) });
}));

chatRouter.post('/:id/join', ah(async (req, res) => {
  const c = await prisma.chat.findUnique({ where: { id: req.params.id } });
  if (!c || c.type !== 'community') throw notFound('Hamjamiyat topilmadi');
  await ensureMember(c.id, req.user!.id);
  res.json({ ok: true });
}));

chatRouter.get('/:id', ah(async (req, res) => {
  const uid = req.user!.id;
  const me = await assertMember(req.params.id, uid);
  const c = await prisma.chat.findUniqueOrThrow({ where: { id: req.params.id }, include: { members: { include: { user: { select: { ...miniSelect, lastSeenAt: true, level: true } } } }, team: true, match: { include: { booking: { include: { pitch: { include: { stadium: true } } } } } } } });
  const other = c.type === 'dm' ? c.members.find((x) => x.userId !== uid)?.user ?? null : null;
  let otherTeam: string | null = null;
  let mutual = 0;
  if (other) {
    const t = await prisma.teamMember.findFirst({ where: { userId: other.id }, include: { team: true } });
    otherTeam = t?.team.name ?? null;
    const mine = (await prisma.follow.findMany({ where: { followerId: uid } })).map((f) => f.followingId);
    mutual = await prisma.follow.count({ where: { followerId: { in: mine }, followingId: other.id } });
  }
  const media = await prisma.message.findMany({ where: { chatId: c.id, type: { in: ['photo', 'video'] } }, orderBy: { createdAt: 'desc' }, take: 9, select: { id: true, mediaUrl: true, type: true } });
  res.json({
    id: c.id, type: c.type, name: other?.name ?? c.name, muted: me.muted, other, otherTeam, mutual,
    online: !!other?.lastSeenAt && Date.now() - other.lastSeenAt.getTime() < 5 * 60 * 1000,
    members: c.members.map((m) => m.user), media,
    match: c.match && { id: c.match.id, title: c.match.title, date: dateStr(c.match.booking.date), start: timeStr(c.match.booking.startTime), stadium: c.match.booking.pitch.stadium.name },
    team: c.team && { id: c.team.id, name: c.team.name, short: c.team.short },
  });
}));

chatRouter.get('/:id/messages', ah(async (req, res) => {
  await assertMember(req.params.id, req.user!.id);
  const before = qstr(req.query.before);
  const rows = await prisma.message.findMany({ where: { chatId: req.params.id, ...(before ? { createdAt: { lt: new Date(before) } } : {}) }, orderBy: { createdAt: 'desc' }, take: 50, include: { sender: { select: { id: true, name: true, avatarUrl: true, username: true } } } });
  const items = await enrich(rows.reverse());
  res.json({ items, hasMore: rows.length === 50 });
}));

chatRouter.post('/:id/messages', mediaUpload('chat', 50).single('media'), ah(async (req, res) => {
  await assertMember(req.params.id, req.user!.id);
  const body = parse(z.object({ type: z.enum(['text', 'photo', 'video', 'match_invite', 'stadium', 'profile', 'reel']).default('text'), body: z.string().max(4000).optional(), refId: z.string().uuid().optional() }), req.body);
  let type: MessageType = body.type;
  let mediaUrl: string | undefined;
  if (req.file) {
    mediaUrl = publicUrl('chat', req.file.filename);
    type = isVideo(req.file.mimetype) ? 'video' : 'photo';
  }
  if (type === 'text' && !body.body?.trim()) throw bad('Xabar bo‘sh');
  if (['match_invite', 'stadium', 'profile', 'reel'].includes(type) && !body.refId) throw bad('Karta uchun obyekt tanlanmagan');
  const out = await sendMessage(req.params.id, req.user!.id, { type, body: body.body?.trim(), refId: body.refId, mediaUrl });
  // Agar o‘yin taklifi DM orqali yuborilsa, taklif yozuvi ham yaratiladi
  if (type === 'match_invite' && body.refId) {
    const chat = await prisma.chat.findUnique({ where: { id: req.params.id }, include: { members: true } });
    const to = chat?.type === 'dm' ? chat.members.find((m) => m.userId !== req.user!.id)?.userId : null;
    if (to) {
      const inv = await prisma.matchInvite.upsert({ where: { matchId_toId: { matchId: body.refId, toId: to } }, update: { status: 'pending', fromId: req.user!.id }, create: { matchId: body.refId, fromId: req.user!.id, toId: to } });
      await notify(to, { type: 'invite', kind: 'match_invite', title: `${req.user!.name} sizni o‘yinga taklif qildi`, body: (out.card as { title?: string } | null)?.title, actorId: req.user!.id, refType: 'invite', refId: inv.id, data: { matchId: body.refId } });
    }
  }
  res.status(201).json(out);
}));

chatRouter.post('/:id/read', ah(async (req, res) => {
  await assertMember(req.params.id, req.user!.id);
  await prisma.chatMember.update({ where: { chatId_userId: { chatId: req.params.id, userId: req.user!.id } }, data: { lastReadAt: new Date() } });
  await publish(req.user!.id, 'chat:read', { chatId: req.params.id });
  res.json({ ok: true });
}));

chatRouter.post('/:id/mute', ah(async (req, res) => {
  const m = await assertMember(req.params.id, req.user!.id);
  await prisma.chatMember.update({ where: { chatId_userId: { chatId: req.params.id, userId: req.user!.id } }, data: { muted: !m.muted } });
  res.json({ muted: !m.muted });
}));

export { assertMember };
