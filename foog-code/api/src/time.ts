// Barcha sana va vaqtlar Asia/Tashkent bo‘yicha.
export const TZ = 'Asia/Tashkent';

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
});

export function tashkentParts(d = new Date()) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday as string);
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute), weekday: wd };
}

/** "YYYY-MM-DD" -> Prisma @db.Date qiymati */
export const dateVal = (s: string) => new Date(`${s}T00:00:00.000Z`);
/** Prisma @db.Date -> "YYYY-MM-DD" */
export const dateStr = (d: Date) => d.toISOString().slice(0, 10);
/** "HH:MM" yoki soat raqami -> Prisma @db.Time qiymati */
export const timeVal = (t: string | number) => {
  const s = typeof t === 'number' ? `${String(t % 24).padStart(2, '0')}:00` : t;
  return new Date(`1970-01-01T${s.length === 5 ? s + ':00' : s}.000Z`);
};
/** Prisma @db.Time -> "HH:MM" */
export const timeStr = (d: Date) => d.toISOString().slice(11, 16);
export const timeHour = (d: Date) => d.getUTCHours();
/** Tugash vaqti 00:00 bo‘lsa 24 deb hisoblaymiz */
export const endHour = (d: Date) => (d.getUTCHours() === 0 ? 24 : d.getUTCHours());

export function addDays(date: string, n: number) {
  const d = dateVal(date);
  d.setUTCDate(d.getUTCDate() + n);
  return dateStr(d);
}
/** 0 = Dushanba ... 6 = Yakshanba */
export function weekdayOf(date: string) {
  return (dateVal(date).getUTCDay() + 6) % 7;
}
export function mondayOf(date: string) {
  return addDays(date, -weekdayOf(date));
}
/** Tashkent mahalliy sana+soat -> haqiqiy UTC vaqt (Toshkent = UTC+5, yozgi vaqt yo‘q) */
export function tashkentToUtc(date: string, hour: number, minute = 0) {
  return new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), hour - 5, minute));
}
