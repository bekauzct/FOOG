import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { ah, bad, conflict, notFound, parse, qstr } from '../http';
import { requireRole } from '../auth';
import { daySlots } from '../services/slots';
import { addDays, dateStr, dateVal, endHour, mondayOf, tashkentParts, timeHour, timeVal, weekdayOf } from '../time';
import { bookingOut, sizeOut, publicUser } from '../serialize';
import { assertStadiumAccess, ratingOf } from './stadiums';
import { audit, notify } from '../notify';

export const ownerRouter = Router();
ownerRouter.use(requireRole('owner', 'staff', 'admin'));

async function myStadiums(userId: string) {
  return prisma.stadium.findMany({
    where: { OR: [{ ownerId: userId }, { staff: { some: { userId } } }] },
    include: { pitches: { where: { active: true }, orderBy: { name: 'asc' } }, photos: { orderBy: { sort: 'asc' } }, schedule: { where: { type: 'hours' } } },
    orderBy: { createdAt: 'asc' },
  });
}

async function pickStadium(req: import('express').Request) {
  const id = qstr(req.query.stadiumId) ?? (req.body?.stadiumId as string | undefined);
  if (id) return assertStadiumAccess(req.user!.id, req.user!.role, id);
  const list = await myStadiums(req.user!.id);
  return list.find((s) => s.status === 'live') ?? list[0] ?? null;
}

const bInclude = { pitch: { include: { stadium: true } }, user: true } as const;

ownerRouter.get('/badges', ah(async (req, res) => {
  const pending = await prisma.booking.count({ where: { status: 'pending', pitch: { stadium: { OR: [{ ownerId: req.user!.id }, { staff: { some: { userId: req.user!.id } } }] } } } });
  res.json({ pending });
}));

ownerRouter.get('/stadiums', ah(async (req, res) => {
  const list = await myStadiums(req.user!.id);
  const ratings = await ratingOf(list.map((s) => s.id));
  res.json({
    items: list.map((s) => ({
      id: s.id, code: s.code, name: s.name, address: s.address, district: s.district, lat: Number(s.lat), lng: Number(s.lng), phone: s.phone,
      description: s.description, metro: s.metro, amenities: s.amenities, cancelPolicy: s.cancelPolicy, status: s.status, accepting: s.accepting,
      rejectReason: s.rejectReason, isOwner: s.ownerId === req.user!.id, rating: ratings.get(s.id) ?? null,
      photos: s.photos.map((p) => ({ id: p.id, url: p.url })),
      pitches: s.pitches.map((p) => ({ id: p.id, name: p.name, size: sizeOut(p.size), surface: p.surface, indoor: p.indoor, price: p.price, peakPrice: p.peakPrice, peakFrom: p.peakFrom, note: p.note })),
    })),
  });
}));

ownerRouter.get('/dashboard', ah(async (req, res) => {
  const st = await pickStadium(req);
  if (!st) return res.json({ empty: true });
  const now = tashkentParts();
  const today = now.date;
  const day = await daySlots(st.id, today, { withWho: true });
  const todayB = await prisma.booking.findMany({ where: { pitch: { stadiumId: st.id }, date: dateVal(today), status: { in: ['pending', 'confirmed', 'arrived'] } }, include: { pitch: true } });
  const peak = todayB.filter((b) => timeHour(b.startTime) >= b.pitch.peakFrom).length;
  const pending = await prisma.booking.findMany({ where: { pitch: { stadiumId: st.id }, status: 'pending' }, include: bInclude, orderBy: { createdAt: 'desc' } });
  let open = 0, busy = 0;
  for (const p of day.pitches) for (const s of p.slots) {
    if (s.state === 'closed') continue;
    open++;
    if (s.state === 'booked' || s.state === 'pending') busy++;
  }
  const monthStart = today.slice(0, 8) + '01';
  const monthRev = await prisma.booking.aggregate({ where: { pitch: { stadiumId: st.id }, status: 'arrived', date: { gte: dateVal(monthStart), lte: dateVal(today) } }, _sum: { price: true } });
  const mon = mondayOf(today);
  const week = await revenueByDay(st.id, mon, 7);
  const prev = await revenueByDay(st.id, addDays(mon, -7), 7);
  const wkSum = week.reduce((a, b) => a + b.value, 0), prevSum = prev.reduce((a, b) => a + b.value, 0);
  const reviews = await prisma.review.findMany({ where: { stadiumId: st.id }, orderBy: { createdAt: 'desc' }, take: 2, include: { user: { select: { name: true, avatarUrl: true } } } });
  const rating = (await ratingOf([st.id])).get(st.id);
  res.json({
    stadium: { id: st.id, name: st.name, district: st.district, status: st.status, accepting: st.accepting },
    today, todayWeekday: weekdayOf(today), nowHour: now.hour,
    kpis: { todayBookings: todayB.length, peak, pending: pending.length, occupancy: open ? Math.round((busy / open) * 100) : 0, pitches: day.pitches.length, openHours: open, monthRevenue: monthRev._sum.price ?? 0 },
    timeline: day.pitches.map((p) => ({ id: p.id, name: p.name, size: p.size, slots: p.slots.map((s) => ({ hour: s.hour, state: s.state, who: s.who })) })),
    pending: pending.slice(0, 3).map(bookingOut),
    week, weekTotal: wkSum, weekDelta: prevSum ? Math.round(((wkSum - prevSum) / prevSum) * 100) : null,
    reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, text: r.text, reply: r.reply, createdAt: r.createdAt, user: r.user })), rating,
  });
}));

/** Kunlar bo‘yicha daromad: o‘tgan kunlar – «Keldi», kelgusi kunlar – tasdiqlangan (reja) */
async function revenueByDay(stadiumId: string, from: string, n: number) {
  const to = addDays(from, n - 1);
  const rows = await prisma.booking.findMany({ where: { pitch: { stadiumId }, date: { gte: dateVal(from), lte: dateVal(to) }, status: { in: ['arrived', 'confirmed'] } }, select: { date: true, price: true, status: true } });
  const today = tashkentParts().date;
  return Array.from({ length: n }, (_, i) => {
    const d = addDays(from, i);
    const isPast = d < today;
    const value = rows.filter((r) => dateStr(r.date) === d && (r.status === 'arrived' || (!isPast && r.status === 'confirmed'))).reduce((a, b) => a + b.price, 0);
    return { date: d, value, plan: d > today, today: d === today };
  });
}

ownerRouter.get('/bookings', ah(async (req, res) => {
  const st = await pickStadium(req);
  if (!st) return res.json({ items: [], counts: {} });
  const filter = qstr(req.query.filter) ?? 'pending';
  const q = qstr(req.query.q);
  const today = dateVal(tashkentParts().date);
  const base: Prisma.BookingWhereInput = { pitch: { stadiumId: st.id } };
  const F: Record<string, Prisma.BookingWhereInput> = {
    pending: { status: 'pending' },
    today: { date: today, status: { in: ['pending', 'confirmed', 'arrived', 'no_show'] } },
    confirmed: { status: 'confirmed' },
    history: { status: { in: ['arrived', 'no_show', 'rejected', 'expired', 'cancelled'] } },
    all: {},
  };
  const where: Prisma.BookingWhereInput = { ...base, ...(F[filter] ?? F.pending) };
  if (q) where.OR = [{ code: { contains: q, mode: 'insensitive' } }, { user: { name: { contains: q, mode: 'insensitive' } } }, { user: { phone: { contains: q.replace(/\s/g, '') } } }];
  const rows = await prisma.booking.findMany({ where, include: bInclude, orderBy: filter === 'history' || filter === 'all' ? [{ date: 'desc' }, { startTime: 'desc' }] : filter === 'pending' ? { createdAt: 'desc' } : [{ date: 'asc' }, { startTime: 'asc' }], take: 200 });
  const counts = { pending: await prisma.booking.count({ where: { ...base, status: 'pending' } }) };
  res.json({ stadium: { id: st.id, name: st.name }, items: rows.map(bookingOut), counts });
}));

ownerRouter.get('/schedule', ah(async (req, res) => {
  const st = await pickStadium(req);
  if (!st) return res.json({ empty: true });
  const full = await prisma.stadium.findUniqueOrThrow({ where: { id: st.id }, include: { pitches: { where: { active: true }, orderBy: { name: 'asc' } }, schedule: { where: { type: 'hours', pitchId: null } } } });
  const pitchId = qstr(req.query.pitchId) ?? full.pitches[0]?.id;
  const today = tashkentParts().date;
  const mon = mondayOf(qstr(req.query.week) ?? today);
  const days = await Promise.all(Array.from({ length: 7 }, (_, i) => daySlots(st.id, addDays(mon, i), { withWho: true })));
  const hours = Array.from({ length: 7 }, (_, d) => {
    const r = full.schedule.find((x) => x.weekday === d);
    return { weekday: d, closed: r?.closed ?? false, open: r ? timeHour(r.startTime) : 8, close: r ? endHour(r.endTime) : 24 };
  });
  res.json({
    stadium: { id: st.id, name: st.name }, pitches: full.pitches.map((p) => ({ id: p.id, name: p.name, size: sizeOut(p.size) })), pitchId, today, week: mon, hours,
    days: days.map((d) => ({ date: d.date, slots: d.pitches.find((p) => p.id === pitchId)?.slots ?? [] })),
  });
}));

ownerRouter.put('/schedule/hours', ah(async (req, res) => {
  const body = parse(z.object({ stadiumId: z.string().uuid(), days: z.array(z.object({ weekday: z.number().int().min(0).max(6), closed: z.boolean(), open: z.number().int().min(0).max(23), close: z.number().int().min(1).max(24) })).length(7) }), req.body);
  await assertStadiumAccess(req.user!.id, req.user!.role, body.stadiumId);
  for (const d of body.days) if (!d.closed && d.close <= d.open) throw bad('Yopilish vaqti ochilishdan keyin bo‘lsin');
  await prisma.$transaction([
    prisma.schedule.deleteMany({ where: { stadiumId: body.stadiumId, type: 'hours', pitchId: null } }),
    prisma.schedule.createMany({ data: body.days.map((d) => ({ stadiumId: body.stadiumId, type: 'hours' as const, weekday: d.weekday, closed: d.closed, startTime: timeVal(d.open), endTime: timeVal(d.close % 24) })) }),
  ]);
  res.json({ ok: true });
}));

ownerRouter.post('/schedule/block', ah(async (req, res) => {
  const body = parse(z.object({ pitchId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), hour: z.number().int().min(0).max(23) }), req.body);
  const pitch = await prisma.pitch.findUnique({ where: { id: body.pitchId } });
  if (!pitch) throw notFound('Maydon topilmadi');
  await assertStadiumAccess(req.user!.id, req.user!.role, pitch.stadiumId);
  const day = await daySlots(pitch.stadiumId, body.date);
  const slot = day.pitches.find((p) => p.id === pitch.id)?.slots.find((s) => s.hour === body.hour);
  if (slot && (slot.state === 'booked' || slot.state === 'pending')) throw conflict('Band soatni yopib bo‘lmaydi. Avval bronni bekor qiling.');
  if (slot?.state === 'blocked') return res.json({ ok: true });
  const row = await prisma.schedule.create({ data: { stadiumId: pitch.stadiumId, pitchId: pitch.id, type: 'blocked', date: dateVal(body.date), startTime: timeVal(body.hour), endTime: timeVal((body.hour + 1) % 24) } });
  res.status(201).json({ id: row.id });
}));

ownerRouter.delete('/schedule/block/:id', ah(async (req, res) => {
  const row = await prisma.schedule.findUnique({ where: { id: req.params.id } });
  if (!row || row.type !== 'blocked') throw notFound();
  await assertStadiumAccess(req.user!.id, req.user!.role, row.stadiumId);
  await prisma.schedule.delete({ where: { id: row.id } });
  res.json({ ok: true });
}));

ownerRouter.get('/reports', ah(async (req, res) => {
  const st = await pickStadium(req);
  if (!st) return res.json({ empty: true });
  // Hisobot va biznes ma’lumotlarini faqat egasi ko‘radi (xodim – yo‘q)
  await assertStadiumAccess(req.user!.id, req.user!.role, st.id, true);
  const range = qstr(req.query.range) === 'year' ? 'year' : 'week';
  const today = tashkentParts().date;
  const full = await prisma.stadium.findUniqueOrThrow({ where: { id: st.id }, include: { pitches: { where: { active: true }, orderBy: { name: 'asc' } } } });
  let from: string, to: string, bars: { label: string; value: number; current: boolean; plan?: boolean }[];
  const MON = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
  if (range === 'week') {
    from = mondayOf(today); to = addDays(from, 6);
    const days = await revenueByDay(st.id, from, 7);
    bars = days.map((d, i) => ({ label: ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'][i], value: d.value, current: d.today, plan: d.plan }));
  } else {
    const y = +today.slice(0, 4), m = +today.slice(5, 7);
    const months = Array.from({ length: 6 }, (_, i) => { const mm = m - 5 + i; const yy = mm <= 0 ? y - 1 : y; const m1 = ((mm - 1 + 12) % 12) + 1; return { y: yy, m: m1 }; });
    from = `${months[0].y}-${String(months[0].m).padStart(2, '0')}-01`; to = today;
    const rows = await prisma.booking.findMany({ where: { pitch: { stadiumId: st.id }, status: 'arrived', date: { gte: dateVal(from), lte: dateVal(to) } }, select: { date: true, price: true } });
    bars = months.map((x, i) => ({ label: MON[x.m - 1], value: rows.filter((r) => { const d = dateStr(r.date); return +d.slice(0, 4) === x.y && +d.slice(5, 7) === x.m; }).reduce((a, b) => a + b.price, 0), current: i === 5 }));
  }
  const all = await prisma.booking.findMany({ where: { pitch: { stadiumId: st.id }, date: { gte: dateVal(from), lte: dateVal(to) } }, include: { pitch: true, user: true } });
  const counted = all.filter((b) => ['arrived', 'confirmed', 'no_show', 'pending'].includes(b.status));
  const arrived = all.filter((b) => b.status === 'arrived');
  const noShows = all.filter((b) => b.status === 'no_show');
  const nDays = Math.round((dateVal(to).getTime() - dateVal(from).getTime()) / 864e5) + 1;
  const hoursOf = (b: { startTime: Date; endTime: Date }) => (endHour(b.endTime) * 60 - (timeHour(b.startTime) * 60 + b.startTime.getUTCMinutes()) + b.endTime.getUTCMinutes()) / 60;
  const capacity = full.pitches.length * 16 * nDays;
  const busyHours = counted.reduce((a, b) => a + hoursOf(b), 0);
  // Issiqlik xaritasi: hafta kuni × soat
  const heat = Array.from({ length: 7 }, (_, d) => Array.from({ length: 16 }, (_, i) => counted.filter((b) => weekdayOf(dateStr(b.date)) === d && timeHour(b.startTime) <= 8 + i && endHour(b.endTime) > 8 + i).length));
  const heatMax = Math.max(1, ...heat.flat());
  res.json({
    range, from, to, stadium: { id: st.id, name: st.name },
    kpis: { revenue: arrived.reduce((a, b) => a + b.price, 0), bookings: counted.length, occupancy: capacity ? Math.round((busyHours / capacity) * 100) : 0, noShows: noShows.length, noShowRate: counted.length ? Math.round((noShows.length / counted.length) * 1000) / 10 : 0 },
    bars,
    pitches: full.pitches.map((p) => {
      const pb = counted.filter((b) => b.pitchId === p.id);
      return { id: p.id, name: p.name, bookings: pb.length, revenue: arrived.filter((b) => b.pitchId === p.id).reduce((a, b) => a + b.price, 0), occupancy: Math.round((pb.reduce((a, b) => a + hoursOf(b), 0) / (16 * nDays)) * 100) };
    }),
    heat, heatMax,
    noShowList: noShows.slice(0, 20).map((b) => ({ ...bookingOut(b), user: { id: b.user.id, name: b.user.name, phone: b.user.phone, noShows: b.user.noShows } })),
  });
}));

ownerRouter.get('/reviews', ah(async (req, res) => {
  const st = await pickStadium(req);
  if (!st) return res.json({ items: [] });
  const rows = await prisma.review.findMany({ where: { stadiumId: st.id }, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true, avatarUrl: true } }, booking: { include: { pitch: true } } } });
  res.json({ stadium: { id: st.id, name: st.name }, rating: (await ratingOf([st.id])).get(st.id) ?? null, items: rows.map((r) => ({ id: r.id, rating: r.rating, text: r.text, reply: r.reply, repliedAt: r.repliedAt, createdAt: r.createdAt, user: r.user, pitch: r.booking?.pitch.name ?? null })) });
}));

ownerRouter.post('/reviews/:id/reply', ah(async (req, res) => {
  const { text } = parse(z.object({ text: z.string().trim().min(2).max(600) }), req.body);
  const r = await prisma.review.findUnique({ where: { id: req.params.id }, include: { stadium: true } });
  if (!r) throw notFound('Sharh topilmadi');
  await assertStadiumAccess(req.user!.id, req.user!.role, r.stadiumId);
  await prisma.review.update({ where: { id: r.id }, data: { reply: text, repliedAt: new Date() } });
  await notify(r.userId, { type: 'social', kind: 'review_reply', title: `${r.stadium.name} sharhingizga javob berdi`, body: text.slice(0, 140), refType: 'stadium', refId: r.stadiumId });
  res.json({ ok: true });
}));

ownerRouter.get('/staff', ah(async (req, res) => {
  const st = await pickStadium(req);
  if (!st) return res.json({ items: [] });
  const rows = await prisma.stadiumStaff.findMany({ where: { stadiumId: st.id }, include: { user: true } });
  res.json({ stadium: { id: st.id, name: st.name }, items: rows.map((r) => ({ role: r.role, user: { id: r.user.id, name: r.user.name, username: r.user.username, phone: r.user.phone, avatarUrl: r.user.avatarUrl } })) });
}));

ownerRouter.post('/staff', ah(async (req, res) => {
  const body = parse(z.object({ stadiumId: z.string().uuid(), contact: z.string().trim().min(3) }), req.body);
  const st = await assertStadiumAccess(req.user!.id, req.user!.role, body.stadiumId, true);
  const c = body.contact.replace(/^@/, '');
  const phone = '+' + c.replace(/\D/g, '');
  const user = await prisma.user.findFirst({ where: { OR: [{ username: c }, { phone }] } });
  if (!user) throw notFound('Bunday foydalanuvchi topilmadi. Avval u FOOG ga Telegram orqali kirsin.');
  if (user.id === st.ownerId) throw bad('Siz stadion egasisiz');
  await prisma.stadiumStaff.upsert({ where: { stadiumId_userId: { stadiumId: st.id, userId: user.id } }, update: {}, create: { stadiumId: st.id, userId: user.id, role: 'admin' } });
  await notify(user.id, { type: 'system', kind: 'staff_added', title: `Siz ${st.name} xodimi etib qo‘shildingiz`, body: 'Stadion paneliga kirish: /owner. Qayta kiring.', refType: 'stadium', refId: st.id, telegram: `👔 Siz <b>${st.name}</b> stadioni administratori etib qo‘shildingiz.` });
  await audit(req.user!.id, 'staff.add', `${st.name} ga @${user.username} ni xodim qildi`, 'stadium', st.id);
  res.status(201).json({ ok: true });
}));

ownerRouter.delete('/staff/:stadiumId/:userId', ah(async (req, res) => {
  const st = await assertStadiumAccess(req.user!.id, req.user!.role, req.params.stadiumId, true);
  await prisma.stadiumStaff.deleteMany({ where: { stadiumId: st.id, userId: req.params.userId } });
  res.json({ ok: true });
}));

ownerRouter.get('/reels', ah(async (req, res) => {
  const st = await pickStadium(req);
  const mine = await prisma.reel.findMany({ where: { authorId: req.user!.id }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { likes: true, comments: true } } } });
  const books = await prisma.booking.groupBy({ by: ['sourceReelId'], where: { sourceReelId: { in: mine.map((r) => r.id) } }, _count: true });
  const bmap = new Map(books.map((b) => [b.sourceReelId, b._count]));
  res.json({
    stadium: st ? { id: st.id, name: st.name } : null,
    totals: { views: mine.reduce((a, r) => a + r.views, 0), bookings: [...bmap.values()].reduce((a, b) => a + b, 0) },
    items: mine.map((r) => ({ id: r.id, caption: r.caption, type: r.type, status: r.status, views: r.views, likes: r._count.likes, comments: r._count.comments, bookings: bmap.get(r.id) ?? 0, bookCta: r.bookCta, videoUrl: r.videoUrl, posterUrl: r.posterUrl, createdAt: r.createdAt })),
  });
}));

ownerRouter.get('/profile', ah(async (req, res) => {
  const u = req.user!;
  const prof = await prisma.ownerProfile.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id } });
  const list = await myStadiums(u.id);
  const ratings = await ratingOf(list.map((s) => s.id));
  const total = [...ratings.values()];
  const year = tashkentParts().date.slice(0, 4);
  const bookings = await prisma.booking.count({ where: { pitch: { stadiumId: { in: list.map((s) => s.id) } }, date: { gte: dateVal(`${year}-01-01`) }, status: { in: ['confirmed', 'arrived', 'no_show'] } } });
  const reviews = total.reduce((a, r) => a + r.count, 0);
  res.json({
    user: { ...publicUser(u), phone: u.phone }, profile: prof, staff: !!req.isStaff,
    stats: { stadiums: list.length, pitches: list.reduce((a, s) => a + s.pitches.length, 0), rating: reviews ? Math.round((total.reduce((a, r) => a + r.avg * r.count, 0) / reviews) * 10) / 10 : null, reviews, bookingsYear: bookings, year },
    stadiums: list.map((s) => ({ id: s.id, name: s.name, district: s.district, status: s.status, photo: s.photos[0]?.url ?? null, pitches: s.pitches.length, rating: ratings.get(s.id) ?? null })),
  });
}));

ownerRouter.put('/profile', ah(async (req, res) => {
  const body = parse(z.object({ name: z.string().trim().min(2).max(60).optional(), company: z.string().max(120).optional().nullable(), stir: z.string().max(20).optional().nullable(), legalAddress: z.string().max(200).optional().nullable(), payMethods: z.string().max(200).optional() }), req.body);
  const { name, ...p } = body;
  if (name) await prisma.user.update({ where: { id: req.user!.id }, data: { name } });
  await prisma.ownerProfile.upsert({ where: { userId: req.user!.id }, update: p, create: { userId: req.user!.id, ...p } });
  res.json({ ok: true });
}));
