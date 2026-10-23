import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { ah, bad, notFound, parse, qstr } from '../http';
import { requireRole } from '../auth';
import { addDays, dateStr, dateVal, tashkentParts, timeStr } from '../time';
import { bookingOut, sizeOut } from '../serialize';
import { audit, notify } from '../notify';
import { daySlots } from '../services/slots';
import { deleteTeam } from './matches';

export const adminRouter = Router();
adminRouter.use(requireRole('admin'));

export const CHECKS = [
  'Rasmlar haqiqiy va sifatli (kamida 5 ta)',
  'Manzil xaritada to‘g‘ri belgilangan',
  'Narxlar va ish vaqti kiritilgan',
  'Egasi telefonini Telegram orqali tasdiqlagan',
  'Stadion bilan qo‘ng‘iroq orqali bog‘lanildi',
];
export const REASONS = ['Rasmlar yetarli emas', 'Manzil noto‘g‘ri', 'Narx ko‘rsatilmagan', 'Takroriy ariza'];

adminRouter.get('/badges', ah(async (_req, res) => {
  const [mod, reports, payments, foogi] = await Promise.all([prisma.stadium.count({ where: { status: 'mod' } }), prisma.report.groupBy({ by: ['targetType', 'targetId'], where: { status: 'open' } }), prisma.payment.count({ where: { status: 'review' } }), prisma.foogiQuestion.count({ where: { status: { in: ['unanswered', 'wrong'] } } })]);
  res.json({ mod, reports: reports.length, payments, foogi });
}));

adminRouter.get('/overview', ah(async (req, res) => {
  const today = tashkentParts().date;
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const [users, usersWeek, live, mod, todayAll, todayConf, reportsOpen, disputesOpen, repeatNoShow] = await Promise.all([
    prisma.user.count(), prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.stadium.count({ where: { status: 'live' } }), prisma.stadium.count({ where: { status: 'mod' } }),
    prisma.booking.count({ where: { date: dateVal(today) } }), prisma.booking.count({ where: { date: dateVal(today), status: { in: ['confirmed', 'arrived'] } } }),
    prisma.report.groupBy({ by: ['targetType', 'targetId'], where: { status: 'open' } }).then((g) => g.length), prisma.dispute.count({ where: { status: 'open' } }),
    prisma.user.count({ where: { noShows: { gte: 3 } } }),
  ]);
  const from = addDays(today, -13);
  const rows = await prisma.booking.groupBy({ by: ['date'], where: { date: { gte: dateVal(from), lte: dateVal(today) } }, _count: true });
  const bars = Array.from({ length: 14 }, (_, i) => { const d = addDays(from, i); return { date: d, value: rows.find((r) => dateStr(r.date) === d)?._count ?? 0 }; });
  const prevRows = await prisma.booking.count({ where: { date: { gte: dateVal(addDays(from, -14)), lt: dateVal(from) } } });
  const total = bars.reduce((a, b) => a + b.value, 0);
  // Tumanlar bo‘yicha: faol stadionlar soni va bugungi bandlik
  const stads = await prisma.stadium.findMany({ where: { status: 'live' }, select: { id: true, district: true } });
  const byD = new Map<string, { n: number; open: number; busy: number }>();
  for (const s of stads) {
    const d = await daySlots(s.id, today);
    const e = byD.get(s.district) ?? { n: 0, open: 0, busy: 0 };
    e.n++;
    for (const p of d.pitches) for (const sl of p.slots) { if (sl.state === 'closed') continue; e.open++; if (sl.state === 'booked' || sl.state === 'pending') e.busy++; }
    byD.set(s.district, e);
  }
  const districts = [...byD.entries()].map(([name, e]) => ({ name, stadiums: e.n, occupancy: e.open ? Math.round((e.busy / e.open) * 100) : 0 })).sort((a, b) => b.stadiums - a.stadiums || b.occupancy - a.occupancy);
  const log = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 6, include: { actor: { select: { name: true } } } });
  res.json({
    admin: { name: req.user!.name },
    kpis: { users, usersWeek, live, mod, todayBookings: todayAll, todayConfirmedPct: todayAll ? Math.round((todayConf / todayAll) * 100) : 0, reportsOpen, disputesOpen },
    bars, total, delta: prevRows ? Math.round(((total - prevRows) / prevRows) * 100) : null,
    queue: { stadiums: mod, reports: reportsOpen, disputes: disputesOpen, noShows: repeatNoShow },
    districts, log: log.map((l) => ({ id: l.id, at: l.createdAt, who: l.actor?.name ?? 'Tizim', text: l.text })),
  });
}));

adminRouter.get('/stadiums', ah(async (req, res) => {
  const status = (qstr(req.query.status) ?? 'mod') as 'mod' | 'live' | 'off' | 'rejected';
  const q = qstr(req.query.q);
  const where: Prisma.StadiumWhereInput = status === 'off' ? { status: { in: ['off', 'rejected'] } } : { status };
  if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }];
  const rows = await prisma.stadium.findMany({ where, include: { owner: { include: { ownerProfile: true } }, pitches: { where: { active: true } }, photos: { orderBy: { sort: 'asc' } } }, orderBy: { createdAt: 'desc' } });
  const counts = { mod: await prisma.stadium.count({ where: { status: 'mod' } }) };
  res.json({
    checks: CHECKS, reasons: REASONS, counts,
    items: rows.map((s) => ({
      id: s.id, code: s.code, name: s.name, district: s.district, address: s.address, lat: Number(s.lat), lng: Number(s.lng), status: s.status, createdAt: s.createdAt, rejectReason: s.rejectReason,
      checklist: (s.checklist as Record<string, boolean> | null) ?? { '3': !!s.owner.telegramId },
      owner: { id: s.owner.id, name: s.owner.name, username: s.owner.username, phone: s.owner.phone, telegram: !!s.owner.telegramId, stir: s.owner.ownerProfile?.stir ?? null },
      photos: s.photos.map((p) => p.url), pitches: s.pitches.map((p) => ({ name: p.name, size: sizeOut(p.size), surface: p.surface, indoor: p.indoor, price: p.price })),
    })),
  });
}));

adminRouter.put('/stadiums/:id/checklist', ah(async (req, res) => {
  const { checklist } = parse(z.object({ checklist: z.record(z.boolean()) }), req.body);
  await prisma.stadium.update({ where: { id: req.params.id }, data: { checklist } });
  res.json({ ok: true });
}));

adminRouter.patch('/stadiums/:id', ah(async (req, res) => {
  const body = parse(z.object({ action: z.enum(['approve', 'reject', 'suspend', 'activate']), reason: z.string().optional(), checklist: z.record(z.boolean()).optional() }), req.body);
  const s = await prisma.stadium.findUnique({ where: { id: req.params.id } });
  if (!s) throw notFound('Stadion topilmadi');
  const me = req.user!;
  if (body.action === 'approve') {
    const ch = body.checklist ?? (s.checklist as Record<string, boolean> | null) ?? {};
    if (!CHECKS.every((_, i) => ch[i])) throw bad('Tasdiqlash uchun tekshiruv ro‘yxatining hammasini belgilang');
    if (s.status !== 'mod') throw bad('Ariza moderatsiyada emas');
    await prisma.stadium.update({ where: { id: s.id }, data: { status: 'live', checklist: ch, rejectReason: null } });
    await notify(s.ownerId, { type: 'system', kind: 'stadium_approved', title: `${s.name} tasdiqlandi`, body: 'Stadioningiz endi futbolchilarga ko‘rinadi va bron qabul qiladi.', refType: 'stadium', refId: s.id, telegram: `🎉 <b>Stadioningiz tasdiqlandi</b>: ${s.name}\nEndi u FOOG da futbolchilarga ko‘rinadi.` });
    await audit(me.id, 'stadium.approve', `${s.name} arizasini tasdiqladi`, 'stadium', s.id);
  } else if (body.action === 'reject') {
    if (!body.reason) throw bad('Rad etish sababini tanlang');
    await prisma.stadium.update({ where: { id: s.id }, data: { status: 'rejected', rejectReason: body.reason } });
    await notify(s.ownerId, { type: 'system', kind: 'stadium_rejected', title: `${s.name} arizasi rad etildi`, body: `Sabab: ${body.reason}. Tuzatib, qayta yuboring.`, refType: 'stadium', refId: s.id, telegram: `⚠️ ${s.name} arizasi rad etildi.\nSabab: ${body.reason}\nTuzatib, panel orqali qayta yuboring.` });
    await audit(me.id, 'stadium.reject', `${s.name} arizasini rad etdi: ${body.reason}`, 'stadium', s.id);
  } else if (body.action === 'suspend') {
    await prisma.stadium.update({ where: { id: s.id }, data: { status: 'off' } });
    await notify(s.ownerId, { type: 'system', kind: 'stadium_suspended', title: `${s.name} vaqtincha to‘xtatildi`, body: body.reason ?? 'Batafsil ma’lumot uchun FOOG bilan bog‘laning.', refType: 'stadium', refId: s.id, telegram: `⛔ ${s.name} vaqtincha to‘xtatildi.` });
    await audit(me.id, 'stadium.suspend', `${s.name} ni vaqtincha to‘xtatdi`, 'stadium', s.id);
  } else {
    await prisma.stadium.update({ where: { id: s.id }, data: { status: 'live' } });
    await audit(me.id, 'stadium.activate', `${s.name} ni qayta faollashtirdi`, 'stadium', s.id);
  }
  res.json({ ok: true });
}));

adminRouter.get('/users', ah(async (req, res) => {
  const filter = qstr(req.query.filter) ?? 'all';
  const q = qstr(req.query.q);
  const where: Prisma.UserWhereInput = {};
  if (filter === 'player') where.role = 'player';
  if (filter === 'owner') where.role = 'owner';
  if (filter === 'blocked') where.status = 'blocked';
  if (filter === 'noshow') where.noShows = { gte: 3 };
  if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { username: { contains: q.replace(/^@/, ''), mode: 'insensitive' } }, { phone: { contains: q.replace(/\s/g, '') } }];
  const rows = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200, include: { _count: { select: { bookings: true } }, staffOf: true } });
  res.json({
    items: rows.map((u) => ({ id: u.id, name: u.name, username: u.username, phone: u.phone, role: u.role, staff: u.staffOf.length > 0, district: u.district, createdAt: u.createdAt, bookings: u._count.bookings, noShows: u.noShows, status: u.status, blockedUntil: u.blockedUntil, blockReason: u.blockReason, avatarUrl: u.avatarUrl })),
  });
}));

adminRouter.patch('/users/:id', ah(async (req, res) => {
  const body = parse(z.object({ action: z.enum(['block', 'unblock']), days: z.number().int().min(1).max(3650).optional(), reason: z.string().max(200).optional() }), req.body);
  const u = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!u) throw notFound('Foydalanuvchi topilmadi');
  if (u.id === req.user!.id) throw bad('O‘zingizni bloklay olmaysiz');
  if (u.role === 'admin') throw bad('Administratorni bloklab bo‘lmaydi');
  if (body.action === 'block') {
    await prisma.user.update({ where: { id: u.id }, data: { status: 'blocked', blockedUntil: body.days ? new Date(Date.now() + body.days * 864e5) : null, blockReason: body.reason ?? 'Qoidabuzarlik' } });
    // Bloklangan foydalanuvchining kutilayotgan bronlari bekor bo‘ladi
    await prisma.booking.updateMany({ where: { userId: u.id, status: 'pending' }, data: { status: 'cancelled', decidedAt: new Date() } });
    await audit(req.user!.id, 'user.block', `@${u.username} ni blokladi${body.days ? ` (${body.days} kun)` : ''}`, 'user', u.id);
  } else {
    await prisma.user.update({ where: { id: u.id }, data: { status: 'active', blockedUntil: null, blockReason: null } });
    await audit(req.user!.id, 'user.unblock', `@${u.username} ni blokdan chiqardi`, 'user', u.id);
  }
  res.json({ ok: true });
}));

async function reportTarget(type: string, id: string) {
  if (type === 'post') { const p = await prisma.post.findUnique({ where: { id }, include: { author: true } }); return p && { author: p.author, text: p.text, mediaUrl: p.mediaUrl, hidden: p.hidden }; }
  if (type === 'reel') { const r = await prisma.reel.findUnique({ where: { id }, include: { author: true } }); return r && { author: r.author, text: r.caption, mediaUrl: r.posterUrl ?? r.videoUrl, video: r.videoUrl, hidden: r.hidden }; }
  if (type === 'comment') { const c = await prisma.comment.findUnique({ where: { id }, include: { user: true } }); return c && { author: c.user, text: c.text, mediaUrl: null, hidden: c.hidden }; }
  const u = await prisma.user.findUnique({ where: { id } }); return u && { author: u, text: u.bio ?? '', mediaUrl: u.avatarUrl, hidden: u.status === 'blocked' };
}

adminRouter.get('/reports', ah(async (_req, res) => {
  const open = await prisma.report.findMany({ where: { status: 'open' }, orderBy: { createdAt: 'asc' } });
  const groups = new Map<string, typeof open>();
  for (const r of open) { const k = `${r.targetType}:${r.targetId}`; groups.set(k, [...(groups.get(k) ?? []), r]); }
  const items = [];
  for (const [k, list] of groups) {
    const [type, id] = k.split(':');
    const t = await reportTarget(type, id);
    if (!t) continue;
    const reasons = [...new Set(list.map((r) => r.reason))];
    items.push({ targetType: type, targetId: id, count: list.length, reason: reasons.join(', '), note: list.find((r) => r.text)?.text ?? null, author: { id: t.author.id, name: t.author.name, username: t.author.username }, text: t.text, mediaUrl: t.mediaUrl, video: (t as { video?: string }).video ?? null, hidden: t.hidden, firstAt: list[0].createdAt });
  }
  items.sort((a, b) => b.count - a.count);
  res.json({ items });
}));

adminRouter.patch('/reports', ah(async (req, res) => {
  const body = parse(z.object({ targetType: z.enum(['post', 'reel', 'comment', 'user']), targetId: z.string().uuid(), action: z.enum(['keep', 'warn', 'remove']) }), req.body);
  const t = await reportTarget(body.targetType, body.targetId);
  if (!t) throw notFound('Kontent topilmadi');
  const status = body.action === 'keep' ? 'kept' : body.action === 'warn' ? 'warned' : 'removed';
  await prisma.report.updateMany({ where: { targetType: body.targetType, targetId: body.targetId, status: 'open' }, data: { status } });
  const KIND: Record<string, string> = { post: 'Post', reel: 'Reel', comment: 'Izoh', user: 'Profil' };
  if (body.action === 'keep') {
    if (body.targetType === 'post') await prisma.post.update({ where: { id: body.targetId }, data: { hidden: false } });
    if (body.targetType === 'reel') await prisma.reel.update({ where: { id: body.targetId }, data: { hidden: false } });
    if (body.targetType === 'comment') await prisma.comment.update({ where: { id: body.targetId }, data: { hidden: false } });
    await audit(req.user!.id, 'report.keep', `@${t.author.username} ${KIND[body.targetType].toLowerCase()}ini qoldirdi · shikoyat yopildi`, body.targetType, body.targetId);
  } else if (body.action === 'warn') {
    await notify(t.author.id, { type: 'system', kind: 'warning', title: 'FOOG moderatsiyasidan ogohlantirish', body: `${KIND[body.targetType]}ingiz bo‘yicha shikoyat tushdi. Hamjamiyat qoidalariga rioya qiling.`, telegram: '⚠️ FOOG moderatsiyasi: kontentingiz bo‘yicha shikoyat tushdi. Iltimos, hamjamiyat qoidalariga rioya qiling.' });
    await audit(req.user!.id, 'report.warn', `@${t.author.username} ga ogohlantirish yubordi`, body.targetType, body.targetId);
  } else {
    if (body.targetType === 'post') await prisma.post.delete({ where: { id: body.targetId } });
    if (body.targetType === 'reel') await prisma.reel.delete({ where: { id: body.targetId } });
    if (body.targetType === 'comment') await prisma.comment.delete({ where: { id: body.targetId } });
    if (body.targetType === 'user') await prisma.user.update({ where: { id: body.targetId }, data: { status: 'blocked', blockReason: 'Shikoyatlar bo‘yicha' } });
    await notify(t.author.id, { type: 'system', kind: 'removed', title: `${KIND[body.targetType]}ingiz qoidabuzarlik sababli o‘chirildi` });
    await audit(req.user!.id, 'report.remove', `@${t.author.username} ${KIND[body.targetType].toLowerCase()}ini o‘chirdi`, body.targetType, body.targetId);
  }
  res.json({ ok: true });
}));

adminRouter.get('/bookings', ah(async (req, res) => {
  const filter = qstr(req.query.filter) ?? 'all';
  const q = qstr(req.query.q);
  const today = tashkentParts().date;
  const where: Prisma.BookingWhereInput = {};
  if (filter === 'today') where.date = dateVal(today);
  if (filter === 'dispute') where.disputes = { some: { status: 'open' } };
  if (q) where.OR = [{ code: { contains: q, mode: 'insensitive' } }, { user: { name: { contains: q, mode: 'insensitive' } } }];
  const rows = await prisma.booking.findMany({ where, include: { pitch: { include: { stadium: true } }, user: true, disputes: { orderBy: { createdAt: 'desc' } } }, orderBy: [{ date: 'desc' }, { startTime: 'desc' }], take: 100 });
  const disputes = await prisma.dispute.count({ where: { status: 'open' } });
  res.json({ counts: { disputes }, items: rows.map((b) => ({ ...bookingOut(b), dispute: b.disputes[0] ? { id: b.disputes[0].id, reason: b.disputes[0].reason, status: b.disputes[0].status, createdAt: b.disputes[0].createdAt } : null })) });
}));

adminRouter.patch('/disputes/:id', ah(async (req, res) => {
  const body = parse(z.object({ decision: z.enum(['owner', 'player']), note: z.string().max(300).optional() }), req.body);
  const d = await prisma.dispute.findUnique({ where: { id: req.params.id }, include: { booking: { include: { pitch: { include: { stadium: true } }, user: true } } } });
  if (!d) throw notFound('Nizo topilmadi');
  if (d.status !== 'open') throw bad('Nizo allaqachon yopilgan');
  await prisma.dispute.update({ where: { id: d.id }, data: { status: body.decision, resolution: body.note, resolvedAt: new Date() } });
  const b = d.booking;
  if (body.decision === 'player') {
    // Futbolchi haq: «Kelmadi» bekor qilinadi, hisoblagich kamayadi
    await prisma.booking.update({ where: { id: b.id }, data: { status: 'cancelled' } });
    await prisma.user.update({ where: { id: b.userId }, data: { noShows: { decrement: b.user.noShows > 0 ? 1 : 0 } } });
  }
  const verdict = body.decision === 'player' ? 'futbolchi foydasiga' : 'egasi foydasiga';
  await notify(b.userId, { type: 'booking', kind: 'dispute_resolved', title: `${b.code} nizosi ${verdict} yopildi`, body: body.note, refType: 'booking', refId: b.id });
  await notify(b.pitch.stadium.ownerId, { type: 'booking', kind: 'dispute_resolved', title: `${b.code} nizosi ${verdict} yopildi`, body: body.note, refType: 'booking', refId: b.id });
  await audit(req.user!.id, 'dispute.resolve', `${b.code} nizosini ${verdict} yopdi`, 'booking', b.id);
  res.json({ ok: true });
}));

// ---------- Jamoalar va o‘yinlar ----------
adminRouter.get('/teams', ah(async (req, res) => {
  const q = qstr(req.query.q);
  const rows = await prisma.team.findMany({ where: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { captain: { name: { contains: q, mode: 'insensitive' } } }] } : {}, include: { captain: { select: { id: true, name: true, username: true } }, _count: { select: { members: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
  res.json({ items: rows.map((t) => ({ id: t.id, name: t.name, short: t.short, district: t.district, level: t.level, members: t._count.members, captain: t.captain, createdAt: t.createdAt, status: t.status, paidUntil: t.paidUntil })) });
}));

adminRouter.delete('/teams/:id', ah(async (req, res) => {
  const t = await prisma.team.findUnique({ where: { id: req.params.id } });
  if (!t) throw notFound('Jamoa topilmadi');
  await deleteTeam(t, req.user!.id, `«${t.name}» jamoasi moderator tomonidan o‘chirildi`);
  await notify(t.captainId, { type: 'system', kind: 'removed', title: `«${t.name}» jamoangiz qoidabuzarlik sababli o‘chirildi` });
  await audit(req.user!.id, 'team.delete', `«${t.name}» jamoasini o‘chirdi`, 'team', t.id);
  res.json({ ok: true });
}));

adminRouter.get('/matches', ah(async (req, res) => {
  const status = qstr(req.query.status) ?? 'active';
  const q = qstr(req.query.q);
  const where: Prisma.MatchWhereInput = status === 'active' ? { status: { in: ['open', 'full'] } } : status === 'all' ? {} : { status: status as 'done' | 'cancelled' };
  if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { organizer: { name: { contains: q, mode: 'insensitive' } } }];
  const rows = await prisma.match.findMany({ where, include: { organizer: { select: { id: true, name: true, username: true } }, booking: { include: { pitch: { include: { stadium: { select: { name: true } } } } } }, _count: { select: { players: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
  res.json({ items: rows.map((m) => ({ id: m.id, title: m.title, status: m.status, capacity: m.capacity, filled: m._count.players, date: dateStr(m.booking.date), start: timeStr(m.booking.startTime), stadium: m.booking.pitch.stadium.name, organizer: m.organizer, createdAt: m.createdAt })) });
}));

adminRouter.post('/matches/:id/cancel', ah(async (req, res) => {
  const m = await prisma.match.findUnique({ where: { id: req.params.id }, include: { players: true } });
  if (!m) throw notFound('O‘yin topilmadi');
  if (!['open', 'full'].includes(m.status)) throw bad('O‘yin allaqachon yakunlangan yoki bekor qilingan');
  await prisma.match.update({ where: { id: m.id }, data: { status: 'cancelled' } });
  await Promise.all(m.players.map((p) => notify(p.userId, { type: 'match', kind: 'match_cancelled', title: `«${m.title}» o‘yini moderator tomonidan bekor qilindi`, body: p.userId === m.organizerId ? 'Stadiondagi bron saqlanib qoldi – kerak bo‘lmasa uni bekor qiling.' : undefined, refType: 'match', refId: m.id })));
  await audit(req.user!.id, 'match.cancel', `«${m.title}» o‘yinini bekor qildi`, 'match', m.id);
  res.json({ ok: true });
}));

adminRouter.get('/audit', ah(async (req, res) => {
  const q = qstr(req.query.q);
  const where: Prisma.AuditLogWhereInput = q ? { OR: [{ text: { contains: q, mode: 'insensitive' } }, { action: { contains: q } }] } : {};
  const rows = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200, include: { actor: { select: { name: true, role: true } } } });
  res.json({ items: rows.map((l) => ({ id: l.id, at: l.createdAt, who: l.actor?.name ?? 'Tizim', role: l.actor?.role ?? null, action: l.action, text: l.text, targetType: l.targetType, targetId: l.targetId })) });
}));
