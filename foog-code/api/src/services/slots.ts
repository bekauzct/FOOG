import type { Pitch, Schedule } from '@prisma/client';
import { prisma } from '../db';
import { dateVal, endHour, tashkentParts, timeHour, timeStr, weekdayOf } from '../time';

export const ACTIVE = ['pending', 'confirmed', 'arrived'] as const;

export type Hours = { open: number; close: number; closed: boolean };

/** Hafta kuni uchun ish vaqti. pitch_id bo‘sh yozuv – butun stadion. Yozuv bo‘lmasa 08:00–24:00. */
export function hoursFor(schedule: Schedule[], weekday: number, pitchId?: string): Hours {
  const rows = schedule.filter((s) => s.type === 'hours' && s.weekday === weekday);
  const r = rows.find((s) => s.pitchId === pitchId) ?? rows.find((s) => !s.pitchId);
  if (!r) return { open: 8, close: 24, closed: false };
  return { open: timeHour(r.startTime), close: endHour(r.endTime), closed: r.closed };
}

export function priceAt(p: Pick<Pitch, 'price' | 'peakPrice' | 'peakFrom'>, hour: number) {
  return hour >= p.peakFrom ? p.peakPrice : p.price;
}

export type SlotState = 'free' | 'booked' | 'pending' | 'blocked' | 'past' | 'closed';
export type Slot = { hour: number; time: string; state: SlotState; price: number; peak: boolean; bookingId?: string; who?: string; blockId?: string };

/** Bir kunlik soatlar: har bir maydon uchun holat va narx */
export async function daySlots(stadiumId: string, date: string, opts: { withWho?: boolean } = {}) {
  const st = await prisma.stadium.findUniqueOrThrow({
    where: { id: stadiumId },
    include: { pitches: { where: { active: true }, orderBy: { name: 'asc' } }, schedule: true },
  });
  const wd = weekdayOf(date);
  const bookings = await prisma.booking.findMany({
    where: { pitch: { stadiumId }, date: dateVal(date), status: { in: [...ACTIVE] } },
    include: opts.withWho ? { user: { select: { name: true } } } : undefined,
  });
  const now = tashkentParts();
  const blocked = st.schedule.filter((s) => s.type === 'blocked' && s.date && s.date.toISOString().slice(0, 10) === date);
  const pitches = st.pitches.map((p) => {
    const h = hoursFor(st.schedule, wd, p.id);
    const slots: Slot[] = [];
    for (let hour = 8; hour < 24; hour++) {
      const time = `${String(hour).padStart(2, '0')}:00`;
      const base = { hour, time, price: priceAt(p, hour), peak: hour >= p.peakFrom };
      const ov = (st0: Date, en0: Date) => mins(st0) < hour * 60 + 60 && endMins(en0) > hour * 60;
      const b = bookings.find((x) => x.pitchId === p.id && ov(x.startTime, x.endTime));
      const bl = blocked.find((x) => (!x.pitchId || x.pitchId === p.id) && ov(x.startTime, x.endTime));
      let state: SlotState = 'free';
      if (h.closed || hour < h.open || hour >= h.close) state = 'closed';
      else if (b) state = b.status === 'pending' ? 'pending' : 'booked';
      else if (bl) state = 'blocked';
      else if (date < now.date || (date === now.date && hour <= now.hour)) state = 'past';
      const who = b && opts.withWho ? (b as typeof b & { user?: { name: string } }).user?.name : undefined;
      slots.push({ ...base, state, bookingId: b?.id, who, blockId: bl?.id });
    }
    return { id: p.id, name: p.name, size: p.size.replace(/^s/, ''), surface: p.surface, indoor: p.indoor, price: p.price, peakPrice: p.peakPrice, peakFrom: p.peakFrom, note: p.note, hours: h, slots };
  });
  return { date, pitches };
}

export const mins = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
export const endMins = (d: Date) => mins(d) === 0 ? 1440 : mins(d);

export const slotKey = (pitchId: string, date: string, minutes: number) => `lock:slot:${pitchId}:${date}:${minutes}`;
export const fmtT = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export { timeStr };
