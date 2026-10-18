import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { ah, bad, forbidden, notFound, parse, qstr } from '../http';
import { requireAuth } from '../auth';
import { mediaUpload, imageUpload, isVideo, publicUrl } from '../uploads';
import { miniSelect } from '../serialize';
import { notify } from '../notify';
import { distanceKm, originOf } from '../services/geo';
import { dateVal, mondayOf, tashkentParts, timeHour } from '../time';
import { daySlots } from '../services/slots';
import { matchCard } from './matches';
import { env } from '../env';
import { tg } from '../telegram';
import { adminChatIds } from '../admins';

export const socialRouter = Router();

const postInclude = (uid?: string) => ({
  author: { select: miniSelect },
  stadium: { select: { id: true, name: true, district: true } },
  _count: { select: { likes: true, comments: true } },
  likes: uid ? { where: { userId: uid }, select: { id: true } } : false,
  saves: uid ? { where: { userId: uid }, select: { id: true } } : false,
} satisfies Prisma.PostInclude);

type PostRow = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;
export const postOut = (p: PostRow) => ({
  id: p.id, text: p.text, mediaUrl: p.mediaUrl, mediaType: p.mediaType, kind: p.kind, stats: p.stats, createdAt: p.createdAt,
  author: p.author, stadium: p.stadium, likes: p._count.likes, comments: p._count.comments,
  liked: Array.isArray(p.likes) && p.likes.length > 0, saved: Array.isArray(p.saves) && p.saves.length > 0,
});

// ---------- Lenta ----------
socialRouter.get('/feed', ah(async (req, res) => {
  const tab = qstr(req.query.tab) ?? 'foryou';
  const uid = req.user?.id;
  const cursor = qstr(req.query.cursor);
  const where: Prisma.PostWhereInput = { hidden: false, author: { status: 'active' } };
  if (tab === 'following' && uid) where.author = { status: 'active', followers: { some: { followerId: uid } } };
  if (tab === 'nearby' && req.user?.district) where.OR = [{ stadium: { district: req.user.district } }, { author: { district: req.user.district } }];
  if (cursor) where.createdAt = { lt: new Date(cursor) };
  const rows = await prisma.post.findMany({ where, include: postInclude(uid), orderBy: { createdAt: 'desc' }, take: 10 });
  res.json({ items: rows.map(postOut), next: rows.length === 10 ? rows[rows.length - 1].createdAt.toISOString() : null });
}));

socialRouter.post('/posts', requireAuth, mediaUpload('posts', 50).single('media'), ah(async (req, res) => {
  const body = parse(z.object({
    text: z.string().trim().min(1, 'Matn yozing').max(2000), kind: z.enum(['post', 'result', 'find_players']).default('post'), stadiumId: z.string().uuid().optional().or(z.literal('')),
    stats: z.string().optional(),
  }), req.body);
  let stats: Prisma.InputJsonValue | undefined;
  if (body.stats) {
    const s = z.object({ result: z.string().max(12), played: z.string().max(8).optional(), goals: z.coerce.number().int().min(0).max(30), assists: z.coerce.number().int().min(0).max(30) }).parse(JSON.parse(body.stats));
    stats = s;
  }
  const f = req.file;
  const post = await prisma.post.create({
    data: { authorId: req.user!.id, text: body.text, kind: body.kind, stadiumId: body.stadiumId || undefined, stats, mediaUrl: f ? publicUrl('posts', f.filename) : undefined, mediaType: f ? (isVideo(f.mimetype) ? 'video' : 'image') : undefined },
    include: postInclude(req.user!.id),
  });
  res.status(201).json(postOut(post));
}));

socialRouter.delete('/posts/:id', requireAuth, ah(async (req, res) => {
  const p = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!p) throw notFound();
  if (p.authorId !== req.user!.id && req.user!.role !== 'admin') throw forbidden();
  await prisma.post.delete({ where: { id: p.id } });
  res.json({ ok: true });
}));

async function toggle(kind: 'like' | 'save', target: 'post' | 'reel', id: string, userId: string) {
  const field = target === 'post' ? 'postId' : 'reelId';
  const model = kind === 'like' ? prisma.like : prisma.save;
  const where = { userId, [field]: id };
  // @ts-expect-error – like va save bir xil tuzilishga ega
  const ex = await model.findFirst({ where });
  // @ts-expect-error – yuqoridagi kabi
  if (ex) await model.delete({ where: { id: ex.id } });
  // @ts-expect-error – yuqoridagi kabi
  else await model.create({ data: where });
  const count = kind === 'like' ? await prisma.like.count({ where: { [field]: id } }) : undefined;
  return { on: !ex, count };
}

socialRouter.post('/posts/:id/like', requireAuth, ah(async (req, res) => {
  const p = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!p) throw notFound();
  const r = await toggle('like', 'post', p.id, req.user!.id);
  if (r.on) await notify(p.authorId, { type: 'social', kind: 'like', title: `${req.user!.name} postingizni yoqtirdi`, body: p.text.slice(0, 80), actorId: req.user!.id, refType: 'post', refId: p.id });
  res.json({ liked: r.on, likes: r.count });
}));
socialRouter.post('/posts/:id/save', requireAuth, ah(async (req, res) => {
  const r = await toggle('save', 'post', req.params.id, req.user!.id);
  res.json({ saved: r.on });
}));

// ---------- Izohlar (post va reel) ----------
socialRouter.get('/:target(posts|reels)/:id/comments', ah(async (req, res) => {
  const field = req.params.target === 'posts' ? 'postId' : 'reelId';
  const rows = await prisma.comment.findMany({ where: { [field]: req.params.id, hidden: false }, include: { user: { select: miniSelect } }, orderBy: { createdAt: 'asc' }, take: 200 });
  res.json({ items: rows.map((c) => ({ id: c.id, text: c.text, createdAt: c.createdAt, user: c.user })) });
}));
socialRouter.post('/:target(posts|reels)/:id/comments', requireAuth, ah(async (req, res) => {
  const { text } = parse(z.object({ text: z.string().trim().min(1).max(500) }), req.body);
  const isPost = req.params.target === 'posts';
  const owner = isPost ? await prisma.post.findUnique({ where: { id: req.params.id } }) : await prisma.reel.findUnique({ where: { id: req.params.id } });
  if (!owner) throw notFound();
  const c = await prisma.comment.create({ data: { userId: req.user!.id, text, ...(isPost ? { postId: owner.id } : { reelId: owner.id }) }, include: { user: { select: miniSelect } } });
  await notify(owner.authorId, { type: 'social', kind: 'comment', title: `${req.user!.name} ${isPost ? 'postingizga' : 'reelingizga'} izoh yozdi`, body: `“${text.slice(0, 80)}”`, actorId: req.user!.id, refType: isPost ? 'post' : 'reel', refId: owner.id });
  res.status(201).json({ id: c.id, text: c.text, createdAt: c.createdAt, user: c.user });
}));

// ---------- Shikoyat ----------
socialRouter.post('/reports', requireAuth, ah(async (req, res) => {
  const body = parse(z.object({ targetType: z.enum(['post', 'reel', 'comment', 'user']), targetId: z.string().uuid(), reason: z.string().min(2).max(60), text: z.string().max(500).optional() }), req.body);
  const dup = await prisma.report.findFirst({ where: { reporterId: req.user!.id, targetType: body.targetType, targetId: body.targetId, status: 'open' } });
  if (dup) return res.json({ ok: true, duplicate: true });
  await prisma.report.create({ data: { ...body, reporterId: req.user!.id } });
  // 5+ shikoyatda kontent avtomatik yashiriladi (admin ko‘rib chiqquncha)
  const n = await prisma.report.count({ where: { targetType: body.targetType, targetId: body.targetId, status: 'open' } });
  if (n >= 5) {
    if (body.targetType === 'post') await prisma.post.updateMany({ where: { id: body.targetId }, data: { hidden: true } });
    if (body.targetType === 'reel') await prisma.reel.updateMany({ where: { id: body.targetId }, data: { hidden: true } });
    if (body.targetType === 'comment') await prisma.comment.updateMany({ where: { id: body.targetId }, data: { hidden: true } });
    await prisma.auditLog.create({ data: { action: 'report.autohide', text: `${body.targetType} ${n} ta shikoyatdan keyin yashirildi`, targetType: body.targetType, targetId: body.targetId } });
  }
  res.status(201).json({ ok: true });
}));

// ---------- Hikoyalar ----------
socialRouter.get('/stories', requireAuth, ah(async (req, res) => {
  const uid = req.user!.id;
  const rows = await prisma.story.findMany({
    where: { expiresAt: { gt: new Date() }, OR: [{ authorId: uid }, { author: { followers: { some: { followerId: uid } } } }] },
    include: { author: { select: miniSelect } }, orderBy: { createdAt: 'desc' },
  });
  const byAuthor = new Map<string, { author: (typeof rows)[0]['author']; live: boolean; items: { id: string; mediaUrl: string | null; text: string | null; createdAt: Date }[] }>();
  for (const s of rows) {
    const e = byAuthor.get(s.authorId) ?? { author: s.author, live: false, items: [] };
    e.live ||= s.live;
    e.items.push({ id: s.id, mediaUrl: s.mediaUrl, text: s.text, createdAt: s.createdAt });
    byAuthor.set(s.authorId, e);
  }
  const mine = byAuthor.get(uid) ?? null;
  byAuthor.delete(uid);
  res.json({ mine, items: [...byAuthor.values()] });
}));
socialRouter.post('/stories', requireAuth, imageUpload('stories').single('media'), ah(async (req, res) => {
  const { text } = parse(z.object({ text: z.string().max(200).optional() }), req.body);
  if (!req.file && !text) throw bad('Rasm tanlang yoki matn yozing');
  const s = await prisma.story.create({ data: { authorId: req.user!.id, text, mediaUrl: req.file ? publicUrl('stories', req.file.filename) : null, expiresAt: new Date(Date.now() + 864e5) } });
  res.status(201).json(s);
}));

// ---------- Home: yaqin bronlar, ochiq o‘yinlar, stadionlar, tavsiyalar, o‘yin yangiliklari ----------
socialRouter.get('/home', requireAuth, ah(async (req, res) => {
  const u = req.user!;
  const now = tashkentParts();
  const mon = mondayOf(now.date);
  const weekMatches = await prisma.matchPlayer.findMany({ where: { userId: u.id, match: { booking: { date: { gte: dateVal(mon), lte: dateVal(now.date) } } } }, include: { match: { include: { booking: true } } } });
  const hours = weekMatches.reduce((a, m) => a + ((m.match.booking.endTime.getUTCHours() || 24) - m.match.booking.startTime.getUTCHours()), 0);
  const upcomingB = await prisma.booking.findMany({ where: { userId: u.id, status: { in: ['pending', 'confirmed'] }, date: { gte: dateVal(now.date) } }, include: { pitch: { include: { stadium: true } } }, orderBy: [{ date: 'asc' }, { startTime: 'asc' }], take: 3 });
  const myMatches = await prisma.match.findMany({ where: { players: { some: { userId: u.id } }, status: { in: ['open', 'full'] }, booking: { date: { gte: dateVal(now.date) }, userId: { not: u.id } } }, include: { booking: { include: { pitch: { include: { stadium: true } } } } }, take: 3 });
  const upcoming = [
    ...upcomingB.map((b) => ({ kind: 'booking' as const, id: b.id, date: b.date.toISOString().slice(0, 10), start: b.startTime.toISOString().slice(11, 16), title: `${b.pitch.stadium.name} · ${b.pitch.name}`, size: b.pitch.size.replace(/^s/, ''), status: b.status })),
    ...myMatches.map((m) => ({ kind: 'match' as const, id: m.id, date: m.booking.date.toISOString().slice(0, 10), start: m.booking.startTime.toISOString().slice(11, 16), title: m.title, size: m.booking.pitch.size.replace(/^s/, ''), status: m.status })),
  ].filter((x) => x.date > now.date || Number(x.start.slice(0, 2)) >= now.hour).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).slice(0, 3);

  const origin = originOf(u.district);
  const open = await prisma.match.findMany({ where: { status: 'open', booking: { status: 'confirmed', date: { gte: dateVal(now.date) } }, players: { none: { userId: u.id } } }, include: { booking: { include: { pitch: { include: { stadium: true } } } }, _count: { select: { players: true } } }, take: 20 });
  const openMatches = open.map((m) => matchCard(m, origin)).filter((m) => m.date > now.date || Number(m.start.slice(0, 2)) > now.hour).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start) || a.distanceKm - b.distanceKm).slice(0, 2);

  const stads = await prisma.stadium.findMany({ where: { status: 'live' }, include: { pitches: { where: { active: true } } } });
  const near = stads.map((s) => ({ s, d: distanceKm(origin, { lat: Number(s.lat), lng: Number(s.lng) }) })).sort((a, b) => a.d - b.d).slice(0, 3);
  const stadiums = await Promise.all(near.map(async ({ s, d }) => {
    const day = await daySlots(s.id, now.date);
    const free = day.pitches.reduce((n, p) => n + p.slots.filter((x) => x.state === 'free').length, 0);
    const photo = await prisma.stadiumPhoto.findFirst({ where: { stadiumId: s.id }, orderBy: { sort: 'asc' } });
    return { id: s.id, name: s.name, distanceKm: d, freeSlots: free, price: Math.min(...s.pitches.map((p) => p.price)), photo: photo?.url ?? null };
  }));

  const following = await prisma.follow.findMany({ where: { followerId: u.id }, select: { followingId: true } });
  const fset = new Set(following.map((f) => f.followingId));
  const cand = await prisma.user.findMany({ where: { role: 'player', status: 'active', id: { notIn: [u.id, ...fset] } }, select: { ...miniSelect, level: true, followers: { where: { followerId: { in: [...fset] } }, select: { followerId: true } } }, take: 30 });
  const suggested = cand.map((c) => ({ ...c, mutual: c.followers.length, followers: undefined })).sort((a, b) => b.mutual - a.mutual || (a.district === u.district ? -1 : 1)).slice(0, 3);

  // O‘yin yangiliklari: kuzatilganlar o‘ynagan so‘nggi o‘yin natijasi
  const news = await prisma.match.findFirst({
    where: { status: 'done', players: { some: { userId: { in: [...fset, u.id] } } } },
    include: { homeTeam: true, awayTeam: true, booking: { include: { pitch: { include: { stadium: true } } } }, players: { include: { user: { select: miniSelect } }, orderBy: { goals: 'desc' } }, mvp: { select: miniSelect } },
    orderBy: { booking: { date: 'desc' } },
  });
  const tonight = await prisma.match.count({ where: { status: 'open', booking: { status: 'confirmed', date: dateVal(now.date), startTime: { gte: new Date(`1970-01-01T${String(Math.max(now.hour, 17)).padStart(2, '0')}:00:00Z`) } } } });
  res.json({
    greetingHour: now.hour, date: now.date, matchesTonight: tonight,
    week: { matches: weekMatches.length, goals: weekMatches.reduce((a, m) => a + m.goals, 0), hours, level: u.level, xp: u.xp, nextXp: u.level * 500 },
    upcoming, openMatches, stadiums, suggested,
    news: news && {
      id: news.id, title: news.title, date: news.booking.date.toISOString().slice(0, 10), stadium: news.booking.pitch.stadium.name,
      home: news.homeTeam?.name ?? 'Oqlar', homeShort: news.homeTeam?.short ?? 'OQ', away: news.awayTeam?.name ?? 'Qoralar', awayShort: news.awayTeam?.short ?? 'QR',
      homeScore: news.homeScore, awayScore: news.awayScore, mvp: news.mvp, followed: news.players.filter((p) => fset.has(p.userId)).length,
      scorer: news.players.find((p) => p.goals > 0) ? { name: news.players.find((p) => p.goals > 0)!.user.name, goals: news.players.find((p) => p.goals > 0)!.goals } : null,
    },
  });
}));

// ---------- Qidiruv ----------
socialRouter.get('/search', ah(async (req, res) => {
  const q = qstr(req.query.q);
  if (!q) return res.json({ players: [], stadiums: [], teams: [] });
  const [players, stadiums, teams] = await Promise.all([
    prisma.user.findMany({ where: { status: 'active', role: 'player', OR: [{ name: { contains: q, mode: 'insensitive' } }, { username: { contains: q.replace(/^@/, ''), mode: 'insensitive' } }] }, select: miniSelect, take: 6 }),
    prisma.stadium.findMany({ where: { status: 'live', OR: [{ name: { contains: q, mode: 'insensitive' } }, { district: { contains: q, mode: 'insensitive' } }] }, select: { id: true, name: true, district: true }, take: 6 }),
    prisma.team.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, select: { id: true, name: true, short: true, district: true }, take: 6 }),
  ]);
  res.json({ players, stadiums, teams });
}));

// ---------- Landing: Erta kirish va Stadion qo‘shish arizasi ----------
socialRouter.post('/early-access', ah(async (req, res) => {
  const body = parse(z.object({
    role: z.enum(['player', 'owner']),
    phone: z.string().regex(/^\+?[\d\s()-]{9,20}$/, 'Telefon raqam noto‘g‘ri'),
    name: z.string().trim().min(2, 'Ismingizni kiriting').max(80),
    telegram: z.string().trim().max(40).regex(/^@?[A-Za-z0-9_]{0,32}$/, 'Telegram username noto‘g‘ri').optional().transform((v) => (v ? v.replace(/^@/, '') : undefined)),
    district: z.string().max(40).optional(),
    stadiumName: z.string().max(80).optional(),
  }), req.body);
  const phone = '+' + body.phone.replace(/\D/g, '').replace(/^(?=\d{9}$)/, '998');
  const before = await prisma.earlyAccess.findUnique({ where: { phone_role: { phone, role: body.role } } });
  const data = { name: body.name, telegram: body.telegram ?? null, district: body.district, stadiumName: body.stadiumName };
  await prisma.earlyAccess.upsert({ where: { phone_role: { phone, role: body.role } }, update: data, create: { ...data, role: body.role, phone } });
  const total = await prisma.earlyAccess.count();
  void alertAdmins([
    `${body.role === 'owner' ? '🏟 <b>Yangi stadion egasi</b>' : '⚽️ <b>Yangi erta kirish arizasi</b>'}${before ? ' (qayta yubordi)' : ''}`,
    `👤 ${esc(body.name)}`,
    `📞 ${fmtPhone(phone)}`,
    body.telegram ? `✈️ @${esc(body.telegram)}` : '✈️ Telegram ko‘rsatilmagan',
    body.role === 'owner' ? `🏟 ${esc(body.stadiumName ?? '—')}` : `📍 ${esc(body.district ?? 'Tuman ko‘rsatilmagan')}`,
    `Jami arizalar: ${total}`,
  ].join('\n'));
  res.status(201).json({ ok: true, total, bot: `https://t.me/${env.botUsername}` });
}));

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtPhone = (p: string) => (/^\+998\d{9}$/.test(p) ? `+998 ${p.slice(4, 6)} ${p.slice(6, 9)} ${p.slice(9, 11)} ${p.slice(11)}` : p);

/** Arizani adminlarga Telegram orqali yuborish */
async function alertAdmins(text: string) {
  const ids = await adminChatIds();
  if (!ids.length) console.warn('[early-access] adminlar chati sozlanmagan: TELEGRAM_ADMIN_CHAT_IDS');
  await Promise.all(ids.map((id) => tg('sendMessage', { chat_id: id, text, parse_mode: 'HTML', disable_web_page_preview: true })));
}

socialRouter.get('/early-access/stats', ah(async (_req, res) => {
  const [players, owners, stadiums] = await Promise.all([
    prisma.user.count({ where: { role: 'player' } }).then(async (n) => n + (await prisma.earlyAccess.count({ where: { role: 'player' } }))),
    prisma.earlyAccess.count({ where: { role: 'owner' } }),
    prisma.stadium.count({ where: { status: 'live' } }),
  ]);
  res.json({ players, stadiums: stadiums + owners });
}));

