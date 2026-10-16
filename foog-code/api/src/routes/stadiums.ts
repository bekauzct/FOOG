import { Router } from 'express';
import { z } from 'zod';
import type { Prisma, Stadium } from '@prisma/client';
import { prisma } from '../db';
import { ah, bad, forbidden, notFound, parse, qnum, qstr } from '../http';
import { requireAuth, requireRole } from '../auth';
import { daySlots } from '../services/slots';
import { distanceKm, DISTRICTS, originOf } from '../services/geo';
import { tashkentParts, timeVal } from '../time';
import { imageUpload, publicUrl } from '../uploads';
import { sizeIn, sizeOut } from '../serialize';
import { audit, notify } from '../notify';

export const stadiumsRouter = Router();

export async function ratingOf(stadiumIds: string[]) {
  if (!stadiumIds.length) return new Map<string, { avg: number; count: number }>();
  const g = await prisma.review.groupBy({ by: ['stadiumId'], where: { stadiumId: { in: stadiumIds } }, _avg: { rating: true }, _count: true });
  return new Map(g.map((x) => [x.stadiumId, { avg: Math.round((x._avg.rating ?? 0) * 10) / 10, count: x._count }]));
}

/** Stadion ustiga egasi yoki xodimi ekanini tekshiradi */
export async function assertStadiumAccess(userId: string, role: string, stadiumId: string, ownerOnly = false) {
  const st = await prisma.stadium.findUnique({ where: { id: stadiumId }, include: { staff: true } });
  if (!st) throw notFound('Stadion topilmadi');
  if (role === 'admin') return st;
  if (st.ownerId === userId) return st;
  if (!ownerOnly && st.staff.some((s) => s.userId === userId)) return st;
  throw forbidden('Bu stadion sizga tegishli emas');
}

const listQuery = z.object({
  q: z.string().optional(), district: z.string().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(), size: z.string().optional(), surface: z.string().optional(),
  setting: z.enum(['indoor', 'outdoor']).optional(), maxPrice: z.coerce.number().optional(), available: z.enum(['1', 'true']).optional(),
  lat: z.coerce.number().optional(), lng: z.coerce.number().optional(), radius: z.coerce.number().optional(),
  sort: z.enum(['distance', 'price', 'rating']).optional(), saved: z.enum(['1']).optional(), limit: z.coerce.number().optional(),
});

stadiumsRouter.get('/', ah(async (req, res) => {
  const q = parse(listQuery, req.query);
  const now = tashkentParts();
  const date = q.date ?? now.date;
  const hour = q.time ? Number(q.time.slice(0, 2)) : Math.min(23, Math.max(now.hour + 1, 8));
  const sizes = q.size?.split(',').filter(Boolean);
  const surfaces = q.surface?.split(',').filter(Boolean);
  const where: Prisma.StadiumWhereInput = { status: 'live' };
  if (q.q) where.OR = [{ name: { contains: q.q, mode: 'insensitive' } }, { district: { contains: q.q, mode: 'insensitive' } }, { address: { contains: q.q, mode: 'insensitive' } }];
  if (q.district) where.district = q.district;
  if (q.saved && req.user) where.saves = { some: { userId: req.user.id } };
  const pitchWhere: Prisma.PitchWhereInput = { active: true };
  if (sizes?.length) pitchWhere.size = { in: sizes.map(sizeIn) };
  if (surfaces?.length) pitchWhere.surface = { in: surfaces };
  if (q.setting) pitchWhere.indoor = q.setting === 'indoor';
  where.pitches = { some: pitchWhere };
  const rows = await prisma.stadium.findMany({ where, include: { photos: { orderBy: { sort: 'asc' }, take: 1 }, pitches: { where: pitchWhere } } });
  const ratings = await ratingOf(rows.map((r) => r.id));
  const origin = originOf(req.user?.district, q.lat, q.lng);
  const savedIds = req.user ? new Set((await prisma.save.findMany({ where: { userId: req.user.id, stadiumId: { not: null } } })).map((s) => s.stadiumId)) : new Set();
  let out = await Promise.all(rows.map(async (s) => {
    const day = await daySlots(s.id, date);
    const pids = new Set(s.pitches.map((p) => p.id));
    const ps = day.pitches.filter((p) => pids.has(p.id));
    const free = ps.reduce((n, p) => n + p.slots.filter((x) => x.state === 'free').length, 0);
    const times = [hour - 1, hour, hour + 1, hour + 2].filter((h) => h >= 8 && h < 24).slice(0, 4).map((h) => {
      const any = ps.some((p) => p.slots.find((x) => x.hour === h)?.state === 'free');
      return { time: `${String(h).padStart(2, '0')}:00`, free: any };
    });
    const priceNow = Math.min(...ps.map((p) => (hour >= p.peakFrom ? p.peakPrice : p.price)));
    const freeAtTime = ps.some((p) => p.slots.find((x) => x.hour === hour)?.state === 'free');
    const r = ratings.get(s.id);
    return {
      id: s.id, name: s.name, district: s.district, address: s.address, lat: Number(s.lat), lng: Number(s.lng),
      distanceKm: distanceKm(origin, { lat: Number(s.lat), lng: Number(s.lng) }), rating: r?.avg ?? null, reviews: r?.count ?? 0,
      photo: s.photos[0]?.url ?? null, amenities: s.amenities, sizes: [...new Set(s.pitches.map((p) => sizeOut(p.size)))],
      surfaces: [...new Set(s.pitches.map((p) => p.surface))], indoor: [...new Set(s.pitches.map((p) => p.indoor))],
      price: priceNow, freeSlots: free, freeAtTime, times, saved: savedIds.has(s.id), partner: s.partner,
    };
  }));
  if (q.maxPrice) out = out.filter((s) => s.price <= q.maxPrice!);
  if (q.available) out = out.filter((s) => s.freeAtTime);
  if (q.radius) out = out.filter((s) => s.distanceKm <= q.radius!);
  const sort = q.sort ?? 'distance';
  out.sort((a, b) => (sort === 'price' ? a.price - b.price : sort === 'rating' ? (b.rating ?? 0) - (a.rating ?? 0) : a.distanceKm - b.distanceKm));
  if (q.limit) out = out.slice(0, q.limit);
  res.json({ date, time: `${String(hour).padStart(2, '0')}:00`, items: out, districts: Object.keys(DISTRICTS) });
}));

stadiumsRouter.get('/:id', ah(async (req, res) => {
  const s = await prisma.stadium.findUnique({
    where: { id: req.params.id },
    include: { photos: { orderBy: { sort: 'asc' } }, pitches: { where: { active: true }, orderBy: { name: 'asc' } }, schedule: { where: { type: 'hours' } }, owner: { select: { id: true, name: true } } },
  });
  if (!s) throw notFound('Stadion topilmadi');
  const canSee = s.status === 'live' || (req.user && (req.user.role === 'admin' || req.user.id === s.ownerId));
  if (!canSee) throw notFound('Stadion topilmadi yoki hali moderatsiyada');
  const reviews = await prisma.review.findMany({ where: { stadiumId: s.id }, orderBy: { createdAt: 'desc' }, take: 20, include: { user: { select: { id: true, name: true, avatarUrl: true, username: true } } } });
  const agg = await prisma.review.aggregate({ where: { stadiumId: s.id }, _avg: { rating: true, rPitch: true, rFacilities: true, rValue: true, rBooking: true }, _count: true });
  const origin = originOf(req.user?.district);
  const similar = await prisma.stadium.findMany({ where: { status: 'live', id: { not: s.id } }, include: { photos: { take: 1, orderBy: { sort: 'asc' } }, pitches: { where: { active: true } } } });
  const saved = req.user ? !!(await prisma.save.findFirst({ where: { userId: req.user.id, stadiumId: s.id } })) : false;
  const r1 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 10) / 10);
  const close = Math.max(...s.schedule.map((x) => (x.endTime.getUTCHours() === 0 ? 24 : x.endTime.getUTCHours())), 24);
  res.json({
    id: s.id, code: s.code, name: s.name, address: s.address, district: s.district, lat: Number(s.lat), lng: Number(s.lng), phone: s.phone,
    description: s.description, metro: s.metro, amenities: s.amenities, cancelPolicy: s.cancelPolicy, status: s.status, accepting: s.accepting, partner: s.partner,
    owner: s.owner, photos: s.photos.map((p) => ({ id: p.id, url: p.url, caption: p.caption })), saved,
    lightsUntil: `${String(close % 24).padStart(2, '0')}:00`,
    distanceKm: distanceKm(origin, { lat: Number(s.lat), lng: Number(s.lng) }),
    pitches: s.pitches.map((p) => ({ id: p.id, name: p.name, size: sizeOut(p.size), surface: p.surface, indoor: p.indoor, price: p.price, peakPrice: p.peakPrice, peakFrom: p.peakFrom, note: p.note })),
    rating: { avg: r1(agg._avg.rating), count: agg._count, pitch: r1(agg._avg.rPitch), facilities: r1(agg._avg.rFacilities), value: r1(agg._avg.rValue), booking: r1(agg._avg.rBooking) },
    reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, text: r.text, reply: r.reply, createdAt: r.createdAt, user: r.user })),
    similar: similar
      .map((x) => ({ id: x.id, name: x.name, photo: x.photos[0]?.url ?? null, distanceKm: distanceKm({ lat: Number(s.lat), lng: Number(s.lng) }, { lat: Number(x.lat), lng: Number(x.lng) }), price: Math.min(...x.pitches.map((p) => p.price)), size: sizeOut(x.pitches[0]?.size ?? 's5x5'), indoor: x.pitches.some((p) => p.indoor), surface: x.pitches[0]?.surface ?? 'turf' }))
      .sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 4),
  });
}));

stadiumsRouter.get('/:id/slots', ah(async (req, res) => {
  const date = qstr(req.query.date) ?? tashkentParts().date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad('Sana noto‘g‘ri');
  res.json(await daySlots(req.params.id, date));
}));

stadiumsRouter.get('/:id/reviews', ah(async (req, res) => {
  const take = Math.min(qnum(req.query.limit) ?? 50, 100);
  const reviews = await prisma.review.findMany({ where: { stadiumId: req.params.id }, orderBy: { createdAt: 'desc' }, take, include: { user: { select: { id: true, name: true, avatarUrl: true, username: true } } } });
  res.json({ items: reviews });
}));

stadiumsRouter.post('/:id/save', requireAuth, ah(async (req, res) => {
  const where = { userId_stadiumId: { userId: req.user!.id, stadiumId: req.params.id } };
  const ex = await prisma.save.findUnique({ where });
  if (ex) await prisma.save.delete({ where });
  else await prisma.save.create({ data: { userId: req.user!.id, stadiumId: req.params.id } });
  res.json({ saved: !ex });
}));

// ---------- Stadion egasi: qo‘shish va tahrirlash ----------
const pitchSchema = z.object({
  id: z.string().uuid().optional(), name: z.string().trim().min(1).max(40), size: z.enum(['5x5', '7x7', '11x11']),
  surface: z.enum(['turf', 'grass', 'hybrid', 'futsal']), indoor: z.boolean(), price: z.number().int().min(10000).max(10000000),
  peakPrice: z.number().int().min(10000).max(10000000), peakFrom: z.number().int().min(8).max(23).default(18), note: z.string().max(80).optional().nullable(),
});
const stadiumSchema = z.object({
  name: z.string().trim().min(3).max(80), address: z.string().trim().min(5).max(200), district: z.string().min(2),
  lat: z.number().min(40.9).max(41.6), lng: z.number().min(68.9).max(69.7), phone: z.string().max(30).optional().nullable(),
  description: z.string().max(1000).optional().nullable(), metro: z.string().max(80).optional().nullable(),
  amenities: z.array(z.string()).max(20).default([]), cancelPolicy: z.string().max(200).optional(),
});

stadiumsRouter.post('/', requireRole('owner'), ah(async (req, res) => {
  const body = parse(stadiumSchema.extend({ pitches: z.array(pitchSchema).min(1).max(10) }), req.body);
  const n = await prisma.stadium.count();
  const st = await prisma.stadium.create({
    data: {
      code: `ST-${String(n + 1).padStart(4, '0')}`, ownerId: req.user!.id, name: body.name, address: body.address, district: body.district,
      lat: body.lat, lng: body.lng, phone: body.phone, description: body.description, metro: body.metro, amenities: body.amenities,
      cancelPolicy: body.cancelPolicy, status: 'mod',
      pitches: { create: body.pitches.map((p) => ({ name: p.name, size: sizeIn(p.size), surface: p.surface, indoor: p.indoor, price: p.price, peakPrice: p.peakPrice, peakFrom: p.peakFrom, note: p.note })) },
      schedule: { create: Array.from({ length: 7 }, (_, d) => ({ type: 'hours' as const, weekday: d, startTime: timeVal('08:00'), endTime: timeVal('00:00') })) },
    },
  });
  await audit(req.user!.id, 'stadium.create', `${st.name} arizasini yubordi`, 'stadium', st.id);
  const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
  await Promise.all(admins.map((a) => notify(a.id, { type: 'system', kind: 'stadium_application', title: `Yangi stadion arizasi: ${st.name}`, refType: 'stadium', refId: st.id })));
  res.status(201).json({ id: st.id, status: st.status });
}));

stadiumsRouter.put('/:id', requireRole('owner', 'admin'), ah(async (req, res) => {
  await assertStadiumAccess(req.user!.id, req.user!.role, req.params.id, true);
  const body = parse(stadiumSchema.partial().extend({ pitches: z.array(pitchSchema).max(10).optional() }), req.body);
  const { pitches, ...data } = body;
  await prisma.$transaction(async (tx) => {
    await tx.stadium.update({ where: { id: req.params.id }, data });
    if (pitches) {
      const existing = await tx.pitch.findMany({ where: { stadiumId: req.params.id, active: true } });
      const keep = new Set(pitches.filter((p) => p.id).map((p) => p.id));
      for (const e of existing) if (!keep.has(e.id)) await tx.pitch.update({ where: { id: e.id }, data: { active: false } });
      for (const p of pitches) {
        const d = { name: p.name, size: sizeIn(p.size), surface: p.surface, indoor: p.indoor, price: p.price, peakPrice: p.peakPrice, peakFrom: p.peakFrom, note: p.note };
        if (p.id) await tx.pitch.update({ where: { id: p.id }, data: d });
        else await tx.pitch.create({ data: { ...d, stadiumId: req.params.id } });
      }
    }
  });
  await audit(req.user!.id, 'stadium.update', `${body.name ?? 'Stadion'} ma’lumotlarini yangiladi`, 'stadium', req.params.id);
  res.json({ ok: true });
}));

stadiumsRouter.patch('/:id/accepting', requireRole('owner', 'staff'), ah(async (req, res) => {
  await assertStadiumAccess(req.user!.id, req.user!.role, req.params.id);
  const { accepting } = parse(z.object({ accepting: z.boolean() }), req.body);
  await prisma.stadium.update({ where: { id: req.params.id }, data: { accepting } });
  res.json({ accepting });
}));

stadiumsRouter.post('/:id/resubmit', requireRole('owner'), ah(async (req, res) => {
  const st: Stadium = await assertStadiumAccess(req.user!.id, req.user!.role, req.params.id, true);
  if (st.status !== 'rejected') throw bad('Faqat rad etilgan arizani qayta yuborish mumkin');
  await prisma.stadium.update({ where: { id: st.id }, data: { status: 'mod', rejectReason: null } });
  await audit(req.user!.id, 'stadium.resubmit', `${st.name} arizasini qayta yubordi`, 'stadium', st.id);
  res.json({ status: 'mod' });
}));

stadiumsRouter.post('/:id/photos', requireRole('owner', 'admin'), imageUpload('stadiums').array('photos', 12), ah(async (req, res) => {
  await assertStadiumAccess(req.user!.id, req.user!.role, req.params.id, true);
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) throw bad('Rasm tanlanmagan');
  const max = await prisma.stadiumPhoto.aggregate({ where: { stadiumId: req.params.id }, _max: { sort: true } });
  let sort = (max._max.sort ?? -1) + 1;
  const rows = await prisma.$transaction(files.map((f) => prisma.stadiumPhoto.create({ data: { stadiumId: req.params.id, url: publicUrl('stadiums', f.filename), sort: sort++ } })));
  res.status(201).json({ items: rows });
}));

stadiumsRouter.delete('/:id/photos/:photoId', requireRole('owner', 'admin'), ah(async (req, res) => {
  await assertStadiumAccess(req.user!.id, req.user!.role, req.params.id, true);
  await prisma.stadiumPhoto.deleteMany({ where: { id: req.params.photoId, stadiumId: req.params.id } });
  res.json({ ok: true });
}));
