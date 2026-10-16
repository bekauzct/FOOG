import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { redis, acquireLocks, releaseLocks } from '../redis';
import { env } from '../env';
import { ah, bad, conflict, notFound, parse } from '../http';
import { requireAuth } from '../auth';
import { ACTIVE, endMins, fmtT, hoursFor, mins, priceAt, slotKey } from '../services/slots';
import { addDays, dateStr, dateVal, tashkentParts, timeVal, weekdayOf } from '../time';
import { bookingOut } from '../serialize';
import { audit, notify } from '../notify';
import { publish } from '../events';
import { assertStadiumAccess } from './stadiums';
import { fmtDateShort, sum } from '../format';

export const bookingsRouter = Router();
bookingsRouter.use(requireAuth);

const include = { pitch: { include: { stadium: { include: { photos: { take: 1, orderBy: { sort: 'asc' as const } } } } } } };

export async function nextBookingCode() {
  if (!(await redis.exists('seq:booking'))) {
    const rows = await prisma.$queryRaw<{ m: number | null }[]>`SELECT max(substring(code from 4)::int) AS m FROM bookings WHERE code ~ '^FG-[0-9]+$'`;
    await redis.setnx('seq:booking', String(rows[0]?.m ?? 2400));
  }
  return `FG-${await redis.incr('seq:booking')}`;
}

async function staffAndOwner(stadiumId: string) {
  const st = await prisma.stadium.findUniqueOrThrow({ where: { id: stadiumId }, include: { staff: true } });
  return [st.ownerId, ...st.staff.map((s) => s.userId)];
}

const createSchema = z.object({
  pitchId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:(00|30)$/),
  minutes: z.number().int().refine((n) => [60, 90, 120, 180].includes(n), 'Davomiylik 1, 1,5, 2 yoki 3 soat'),
  note: z.string().max(200).optional(),
  sourceReelId: z.string().uuid().optional(),
});

/** Bron so‘rovi: Redis qulfi + bazadagi EXCLUDE cheklovi ikki kishining bitta soatni olishiga yo‘l qo‘ymaydi */
bookingsRouter.post('/', ah(async (req, res) => {
  const body = parse(createSchema, req.body);
  const u = req.user!;
  const pitch = await prisma.pitch.findUnique({ where: { id: body.pitchId }, include: { stadium: { include: { schedule: true } } } });
  if (!pitch || !pitch.active) throw notFound('Maydon topilmadi');
  const st = pitch.stadium;
  if (st.status !== 'live') throw bad('Stadion hozircha bron qabul qilmaydi');
  if (!st.accepting) throw bad('Stadion vaqtincha yangi bron qabul qilmayapti');
  const now = tashkentParts();
  if (body.date < now.date || body.date > addDays(now.date, 14)) throw bad('Faqat bugundan 14 kungacha bron qilish mumkin');
  const startM = Number(body.start.slice(0, 2)) * 60 + Number(body.start.slice(3));
  const endM = startM + body.minutes;
  if (body.date === now.date && startM <= now.hour * 60 + now.minute) throw bad('Bu vaqt o‘tib ketgan');
  const h = hoursFor(st.schedule, weekdayOf(body.date), pitch.id);
  if (h.closed || startM < h.open * 60 || endM > h.close * 60) throw bad('Tanlangan vaqt ish vaqtidan tashqarida');
  const blocked = st.schedule.some((s) => s.type === 'blocked' && s.date && dateStr(s.date) === body.date && (!s.pitchId || s.pitchId === pitch.id) && mins(s.startTime) < endM && endMins(s.endTime) > startM);
  if (blocked) throw conflict('Bu soat stadion tomonidan yopilgan', 'slot_taken');

  // Narx: har yarim soat o‘z narxida (peak soatlar qimmatroq)
  let price = 0;
  for (let m = startM; m < endM; m += 30) price += priceAt(pitch, Math.floor(m / 60)) / 2;

  const keys: string[] = [];
  for (let m = startM; m < endM; m += 30) keys.push(slotKey(pitch.id, body.date, m));
  const token = await acquireLocks(keys);
  if (!token) throw conflict('Bu soat hozir boshqa futbolchi tomonidan band qilinmoqda. Boshqa soatni tanlang.', 'slot_locked');
  try {
    const all = await prisma.booking.findMany({ where: { pitchId: pitch.id, date: dateVal(body.date), status: { in: [...ACTIVE] } }, select: { startTime: true, endTime: true } });
    if (all.some((x) => mins(x.startTime) < endM && endMins(x.endTime) > startM)) throw conflict('Bu soat band bo‘ldi. Boshqa soatni tanlang.', 'slot_taken');
    const code = await nextBookingCode();
    let booking;
    try {
      booking = await prisma.booking.create({
        data: { code, userId: u.id, pitchId: pitch.id, date: dateVal(body.date), startTime: timeVal(fmtT(startM)), endTime: timeVal(fmtT(endM)), price, note: body.note, sourceReelId: body.sourceReelId },
        include,
      });
    } catch (e) {
      // 23P01 – exclusion_violation: parallel so‘rov bazada to‘xtatildi
      if (String((e as Error).message).includes('bookings_no_overlap') || (e as { code?: string }).code === 'P2010') throw conflict('Bu soat band bo‘ldi. Boshqa soatni tanlang.', 'slot_taken');
      throw e;
    }
    const out = bookingOut(booking);
    const recipients = await staffAndOwner(st.id);
    const when = `${fmtDateShort(body.date)}, ${out.start}–${out.end}`;
    await Promise.all(recipients.map((id) => notify(id, {
      type: 'booking', kind: 'booking_request', title: `Yangi bron so‘rovi: ${u.name}`, body: `${pitch.name} · ${when} · ${sum(price)}`,
      actorId: u.id, refType: 'booking', refId: booking.id,
      telegram: `🆕 <b>Yangi bron so‘rovi</b> ${code}\n${u.name} · ${u.phone ?? ''}\n${st.name}, ${pitch.name}\n${when}\n${sum(price)} · to‘lov stadionda\n\nJavob berish: 2 soat ichida`,
    })));
    await publish(recipients, 'booking', { id: booking.id, status: 'pending' });
    res.status(201).json(out);
  } finally {
    await releaseLocks(keys, token);
  }
}));

bookingsRouter.get('/my', ah(async (req, res) => {
  const now = tashkentParts();
  const rows = await prisma.booking.findMany({ where: { userId: req.user!.id }, include: { ...include, review: true, match: { select: { id: true, title: true } }, disputes: true }, orderBy: [{ date: 'desc' }, { startTime: 'desc' }] });
  const items = rows.map((b) => ({ ...bookingOut(b), reviewed: !!b.review, match: b.match, disputed: b.disputes.length > 0 }));
  const upcoming = items.filter((b) => ['pending', 'confirmed'].includes(b.status) && (b.date > now.date || (b.date === now.date && Number(b.end.slice(0, 2) || 24) > now.hour))).reverse();
  const past = items.filter((b) => !upcoming.includes(b));
  res.json({ upcoming, past });
}));

bookingsRouter.get('/:id', ah(async (req, res) => {
  const b = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { ...include, user: true, match: true } });
  if (!b) throw notFound('Bron topilmadi');
  if (b.userId !== req.user!.id) await assertStadiumAccess(req.user!.id, req.user!.role, b.pitch.stadiumId);
  res.json({ ...bookingOut(b), match: b.match });
}));

bookingsRouter.post('/:id/cancel', ah(async (req, res) => {
  const b = await prisma.booking.findUnique({ where: { id: req.params.id }, include });
  if (!b || b.userId !== req.user!.id) throw notFound('Bron topilmadi');
  if (!['pending', 'confirmed'].includes(b.status)) throw bad('Bu bronni bekor qilib bo‘lmaydi');
  await prisma.booking.update({ where: { id: b.id }, data: { status: 'cancelled', decidedAt: new Date() } });
  await prisma.match.updateMany({ where: { bookingId: b.id }, data: { status: 'cancelled' } });
  const recipients = await staffAndOwner(b.pitch.stadiumId);
  const o = bookingOut(b);
  await Promise.all(recipients.map((id) => notify(id, { type: 'booking', kind: 'booking_cancelled', title: `${req.user!.name} bronni bekor qildi`, body: `${b.code} · ${o.pitch?.name} · ${fmtDateShort(o.date)} ${o.start}`, actorId: req.user!.id, refType: 'booking', refId: b.id, telegram: `❌ ${b.code} bekor qilindi: ${req.user!.name}, ${fmtDateShort(o.date)} ${o.start}` })));
  await publish(recipients, 'booking', { id: b.id, status: 'cancelled' });
  res.json({ status: 'cancelled' });
}));

bookingsRouter.post('/:id/dispute', ah(async (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().trim().min(5).max(500) }), req.body);
  const b = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { disputes: true } });
  if (!b || b.userId !== req.user!.id) throw notFound('Bron topilmadi');
  if (b.status !== 'no_show') throw bad('Faqat «Kelmadi» deb belgilangan bron bo‘yicha nizo ochish mumkin');
  if (b.disputes.length) throw bad('Bu bron bo‘yicha nizo allaqachon ochilgan');
  const d = await prisma.dispute.create({ data: { bookingId: b.id, openedById: req.user!.id, reason } });
  await audit(req.user!.id, 'dispute.open', `${b.code} bo‘yicha nizo ochdi`, 'booking', b.id);
  res.status(201).json(d);
}));

bookingsRouter.post('/:id/review', ah(async (req, res) => {
  const body = parse(z.object({ rating: z.number().int().min(1).max(5), text: z.string().trim().min(3).max(1000), rPitch: z.number().int().min(1).max(5).optional(), rFacilities: z.number().int().min(1).max(5).optional(), rValue: z.number().int().min(1).max(5).optional(), rBooking: z.number().int().min(1).max(5).optional() }), req.body);
  const b = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { pitch: true, review: true } });
  if (!b || b.userId !== req.user!.id) throw notFound('Bron topilmadi');
  if (b.status !== 'arrived') throw bad('Sharhni o‘yindan keyin qoldirish mumkin');
  if (b.review) throw bad('Bu bron uchun sharh qoldirilgan');
  const r = await prisma.review.create({ data: { ...body, userId: req.user!.id, stadiumId: b.pitch.stadiumId, bookingId: b.id } });
  const st = await prisma.stadium.findUniqueOrThrow({ where: { id: b.pitch.stadiumId } });
  await notify(st.ownerId, { type: 'social', kind: 'review', title: `${req.user!.name} sharh qoldirdi · ${'★'.repeat(body.rating)}`, body: body.text.slice(0, 120), actorId: req.user!.id, refType: 'review', refId: r.id });
  res.status(201).json(r);
}));

// ---------- Stadion egasi / xodim harakatlari ----------
const actionSchema = z.object({
  action: z.enum(['confirm', 'reject', 'arrived', 'no_show', 'undo']),
  reason: z.string().trim().max(200).optional(),
});

const LABEL: Record<string, string> = { confirmed: 'tasdiqlandi', rejected: 'rad etildi', arrived: '«Keldi» deb belgilandi', no_show: '«Kelmadi» deb belgilandi' };

bookingsRouter.patch('/:id', ah(async (req, res) => {
  const body = parse(actionSchema, req.body);
  const b = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { ...include, user: true } });
  if (!b) throw notFound('Bron topilmadi');
  await assertStadiumAccess(req.user!.id, req.user!.role, b.pitch.stadiumId);
  const o = bookingOut(b);
  const now = tashkentParts();
  let status = b.status;
  if (body.action === 'confirm') {
    if (b.status !== 'pending') throw conflict('Bron allaqachon ko‘rib chiqilgan yoki muddati tugagan');
    status = 'confirmed';
  } else if (body.action === 'reject') {
    if (b.status !== 'pending') throw conflict('Bron allaqachon ko‘rib chiqilgan yoki muddati tugagan');
    if (!body.reason) throw bad('Rad etish sababini tanlang');
    status = 'rejected';
  } else if (body.action === 'arrived' || body.action === 'no_show') {
    if (b.status !== 'confirmed') throw bad('Faqat tasdiqlangan bronni belgilash mumkin');
    if (o.date > now.date || (o.date === now.date && Number(o.start.slice(0, 2)) > now.hour + 1)) throw bad('O‘yin vaqti hali kelmagan');
    status = body.action;
  } else if (body.action === 'undo') {
    if (!b.decidedAt || Date.now() - b.decidedAt.getTime() > 2 * 60 * 1000) throw bad('Bekor qilish muddati o‘tdi');
    status = b.status === 'arrived' || b.status === 'no_show' ? 'confirmed' : b.status === 'confirmed' || b.status === 'rejected' ? 'pending' : b.status;
  }
  const updated = await prisma.booking.update({
    where: { id: b.id },
    data: { status, rejectReason: status === 'rejected' ? body.reason : status === 'pending' ? null : b.rejectReason, decidedAt: body.action === 'undo' ? null : new Date() },
  });
  // Kelmaganlar hisoblagichi va 3-martada 7 kunlik blok
  if (status === 'no_show') {
    const u = await prisma.user.update({ where: { id: b.userId }, data: { noShows: { increment: 1 } } });
    if (u.noShows >= 3 && u.status === 'active') {
      await prisma.user.update({ where: { id: u.id }, data: { status: 'blocked', blockedUntil: new Date(Date.now() + 7 * 864e5), blockReason: `${u.noShows}-marta kelmagani uchun` } });
      await audit(null, 'user.autoblock', `@${u.username} ni ${u.noShows}-marta kelmagani uchun 7 kunga blokladi`, 'user', u.id);
    }
  }
  if (body.action === 'undo' && b.status === 'no_show') await prisma.user.update({ where: { id: b.userId }, data: { noShows: { decrement: 1 } } });
  if (['rejected', 'pending'].includes(status) || body.action === 'undo') await prisma.match.updateMany({ where: { bookingId: b.id, status: { not: 'done' } }, data: { status: status === 'rejected' ? 'cancelled' : 'open' } });

  const when = `${fmtDateShort(o.date)}, ${o.start}–${o.end}`;
  if (status === 'confirmed' && body.action === 'confirm') {
    await notify(b.userId, { type: 'booking', kind: 'booking_confirmed', title: `${o.stadium?.name} bronni tasdiqladi`, body: `${o.pitch?.name} · ${when} · to‘lov stadionda`, refType: 'booking', refId: b.id, telegram: `✅ <b>Bron tasdiqlandi</b> ${b.code}\n${o.stadium?.name}, ${o.pitch?.name}\n${when}\n${sum(b.price)} – to‘lov stadionda` });
  } else if (status === 'rejected') {
    await notify(b.userId, { type: 'booking', kind: 'booking_rejected', title: `${o.stadium?.name} bronni rad etdi`, body: `Sabab: ${body.reason}`, refType: 'booking', refId: b.id, telegram: `❌ Bron rad etildi ${b.code}\n${o.stadium?.name}, ${when}\nSabab: ${body.reason}` });
  } else if (status === 'no_show') {
    await notify(b.userId, { type: 'booking', kind: 'booking_no_show', title: `${o.stadium?.name}: siz «Kelmadi» deb belgilandingiz`, body: `${b.code} · ${when}. Xato bo‘lsa, Bronlarim sahifasida nizo oching.`, refType: 'booking', refId: b.id });
  }
  await audit(req.user!.id, `booking.${body.action}`, `${b.code} ${LABEL[status] ?? 'qaytarildi'}`, 'booking', b.id);
  await publish([b.userId, ...(await staffAndOwner(b.pitch.stadiumId))], 'booking', { id: b.id, status });
  res.json({ ...bookingOut({ ...updated, pitch: b.pitch }), user: o.user });
}));

/** Javobsiz qolgan so‘rovlarni bekor qilish (worker) */
export async function expirePending() {
  const cutoff = new Date(Date.now() - env.bookingTtlMin * 60 * 1000);
  const now = tashkentParts();
  const stale = await prisma.booking.findMany({
    where: { status: 'pending', OR: [{ createdAt: { lt: cutoff } }, { date: { lt: dateVal(now.date) } }, { date: dateVal(now.date), startTime: { lte: timeVal(`${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`) } }] },
    include,
  });
  for (const b of stale) {
    const r = await prisma.booking.updateMany({ where: { id: b.id, status: 'pending' }, data: { status: 'expired', decidedAt: new Date() } });
    if (!r.count) continue;
    const o = bookingOut(b);
    await prisma.match.updateMany({ where: { bookingId: b.id }, data: { status: 'cancelled' } });
    await notify(b.userId, { type: 'booking', kind: 'booking_expired', title: `${o.stadium?.name} 2 soat ichida javob bermadi`, body: `${b.code} avtomatik bekor qilindi. Boshqa soat yoki stadionni tanlang.`, refType: 'booking', refId: b.id, telegram: `⌛ ${b.code} avtomatik bekor qilindi – stadion 2 soat ichida javob bermadi.` });
    const owners = await staffAndOwner(b.pitch.stadiumId);
    await publish([b.userId, ...owners], 'booking', { id: b.id, status: 'expired' });
    await audit(null, 'booking.expire', `${b.code} javobsiz qolgani uchun bekor qilindi`, 'booking', b.id);
  }
  return stale.length;
}

