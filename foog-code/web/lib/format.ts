// FOOG formatlari. Barcha sana va vaqtlar Asia/Tashkent bo‘yicha – foydalanuvchi qayerda bo‘lishidan qat’i nazar.
// Narxlar: "300 000 so‘m" – raqam guruhlari orasida U+00A0 (bo‘linmaydigan bo‘shliq).

export const TZ = 'Asia/Tashkent';
export const NBSP = ' ';

export const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
export const MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
export const DOW = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
export const DOW_FULL = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];

/** 1234567 -> "1 234 567" (U+00A0) */
export const num = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
/** 300000 -> "300 000 so‘m" */
export const sum = (n: number) => `${num(n)}${NBSP}so‘m`;
/** 48600000 -> "48,6 mln" */
export const mln = (n: number) => {
  if (n >= 1e6) return `${(Math.round(n / 1e5) / 10).toString().replace('.', ',')}${NBSP}mln`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}${NBSP}ming`;
  return num(n);
};
/** Xarita belgilari uchun qisqa narx: 300000 -> "300k" */
export const kSum = (n: number) => `${Math.round(n / 1000)}k`;
/** 1240 -> "1,2K" */
export const compact = (n: number) => {
  if (n >= 1e6) return `${(Math.round(n / 1e5) / 10).toString().replace('.', ',')}M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}K`;
  if (n >= 1e3) return `${(Math.round(n / 100) / 10).toString().replace('.', ',')}K`;
  return String(n);
};
export const dec = (n: number | null | undefined, d = 1) => (n == null ? '—' : n.toFixed(d).replace('.', ','));

const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** Toshkentdagi hozirgi (yoki berilgan) vaqt qismlari */
export function tashkent(d: Date = new Date()) {
  const p = Object.fromEntries(parts.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute), time: `${p.hour}:${p.minute}` };
}
export const todayStr = () => tashkent().date;

export const dateObj = (s: string) => new Date(`${s}T00:00:00Z`);
export function addDays(s: string, n: number) {
  const d = dateObj(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** 0 = Dushanba */
export const weekday = (s: string) => (dateObj(s).getUTCDay() + 6) % 7;

/** "2026-10-15" -> "15-oktabr" */
export const dayMonth = (s: string) => `${Number(s.slice(8, 10))}-${MONTHS[Number(s.slice(5, 7)) - 1]}`;
/** "2026-10-15" -> "15-okt" */
export const dayMonthShort = (s: string) => `${Number(s.slice(8, 10))}-${MONTHS_SHORT[Number(s.slice(5, 7)) - 1]}`;
/** "15-oktabr, Payshanba" */
export const fullDate = (s: string) => `${dayMonth(s)}, ${DOW_FULL[weekday(s)].toLowerCase()}`;

/** Bugun / Ertaga / Kecha / 17-okt */
export function relDay(s: string) {
  const t = todayStr();
  if (s === t) return 'Bugun';
  if (s === addDays(t, 1)) return 'Ertaga';
  if (s === addDays(t, -1)) return 'Kecha';
  return dayMonthShort(s);
}
/** "Bugun, 20:00" yoki "Pa, 17-okt · 20:00" */
export function whenLabel(date: string, time: string) {
  const r = relDay(date);
  return r.includes('-') ? `${DOW[weekday(date)]}, ${r} · ${time}` : `${r} · ${time}`;
}

/** ISO vaqt -> "20:41" (Toshkent) */
export const hhmm = (iso: string | Date) => tashkent(new Date(iso)).time;
/** ISO vaqt -> Toshkent sanasi "YYYY-MM-DD" */
export const isoDate = (iso: string | Date) => tashkent(new Date(iso)).date;

/** "5 daqiqa oldin", "2 soat oldin", "kecha", "3 kun oldin", "12-okt" */
export function ago(iso: string | Date) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'hozirgina';
  if (diff < 3600) return `${Math.floor(diff / 60)} daqiqa oldin`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
  const d = isoDate(iso);
  if (d === addDays(todayStr(), -1)) return 'kecha';
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} kun oldin`;
  if (diff < 30 * 86400) return `${Math.floor(diff / (7 * 86400))} hafta oldin`;
  return dayMonthShort(d);
}
/** Qisqa: "12d", "2s", "3k" o‘rniga o‘zbekcha: "12 daq", "2 soat", "Kecha", "Pa" */
export function agoShort(iso: string | Date) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'hozir';
  if (diff < 3600) return `${Math.floor(diff / 60)} daq`;
  if (diff < 86400 && isoDate(iso) === todayStr()) return hhmm(iso);
  const d = isoDate(iso);
  if (d === addDays(todayStr(), -1)) return 'Kecha';
  if (diff < 7 * 86400) return DOW[weekday(d)];
  return dayMonthShort(d);
}

/** Salomlashish – Toshkent soati bo‘yicha */
export function greeting(hour = tashkent().hour) {
  if (hour < 5) return 'Xayrli tun';
  if (hour < 12) return 'Xayrli tong';
  if (hour < 18) return 'Xayrli kun';
  return 'Xayrli kech';
}

export const minutesLabel = (m: number) => (m % 60 ? `${String(m / 60).replace('.', ',')} soat` : `${m / 60} soat`);
export const phone = (p?: string | null) => {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  if (d.length === 12) return `+${d.slice(0, 3)}${NBSP}${d.slice(3, 5)}${NBSP}${d.slice(5, 8)}${NBSP}${d.slice(8, 10)}${NBSP}${d.slice(10)}`;
  return p;
};

export const SIZE_LABEL: Record<string, string> = { '5x5': '5×5', '7x7': '7×7', '11x11': '11×11' };
export const SURFACE_LABEL: Record<string, string> = { turf: 'Sun’iy o‘t', grass: 'Tabiiy o‘t', hybrid: 'Gibrid', futsal: 'Futzal' };
export const SKILL_LABEL: Record<string, string> = { beginner: 'Boshlang‘ich', intermediate: 'O‘rta', advanced: 'Yuqori', any: 'Har qanday' };
export const POS_LABEL: Record<string, string> = { GK: 'Darvozabon', CB: 'Markaziy himoyachi', LB: 'Chap himoyachi', RB: 'O‘ng himoyachi', CDM: 'Tayanch yarim himoyachi', CM: 'Yarim himoyachi', CAM: 'Hujumkor yarim himoyachi', LM: 'Chap qanot', RM: 'O‘ng qanot', LW: 'Chap qanot hujumchisi', RW: 'O‘ng qanot hujumchisi', ST: 'Hujumchi', CF: 'Markaziy hujumchi' };
export const FOOT_LABEL: Record<string, string> = { left: 'Chap oyoq', right: 'O‘ng oyoq', both: 'Ikki oyoq' };
export const AVAIL_LABEL: Record<string, string> = { tonight: 'Bugun kechqurun', thu: 'Payshanba', fri: 'Juma', weekends: 'Dam olish kunlari', sun: 'Yakshanba', sat: 'Shanba' };
export const AMENITY: Record<string, [string, string]> = {
  parking: ['local_parking', 'Bepul avtoturargoh'], showers: ['shower', 'Issiq dush'], changing: ['checkroom', 'Kiyinish xonasi'], lockers: ['lock', 'Shkafchalar'],
  cafe: ['local_cafe', 'Kafe va bar'], balls: ['sports_soccer', 'To‘p va maykalar'], accessible: ['accessible', 'Nogironlar uchun qulay'], wifi: ['wifi', 'Bepul Wi‑Fi'], lights: ['lightbulb', 'Kechki yoritish'],
};
export const BOOKING_STATUS: Record<string, [string, 'warning' | 'success' | 'accent' | 'error' | 'muted']> = {
  pending: ['Kutilmoqda', 'warning'], confirmed: ['Tasdiqlangan', 'success'], arrived: ['Keldi', 'accent'], no_show: ['Kelmadi', 'error'],
  rejected: ['Rad etilgan', 'muted'], expired: ['Muddati o‘tdi', 'muted'], cancelled: ['Bekor qilingan', 'muted'],
};
export const DISTRICTS = ['Yunusobod', 'Chilonzor', 'Mirzo Ulug‘bek', 'Yakkasaroy', 'Sergeli', 'Olmazor', 'Yashnobod', 'Shayxontohur', 'Mirobod', 'Uchtepa', 'Bektemir', 'Yangihayot'];

/** Ismdan initsiallar: "Sardor Aliyev" -> "SA" */
export const initials = (s = '') => s.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
/** Ism bo‘yicha barqaror avatar rangi (dizayndagi formula) */
export const avatarColor = (s = '') => `oklch(0.78 0.1 ${([...s].reduce((a, ch) => a + ch.charCodeAt(0), 0) * 37) % 360})`;
/** Ko‘plik: "1 ta", "5 ta" */
export const ta = (n: number) => `${num(n)}${NBSP}ta`;
/** Haftaning dushanbasi */
export const mondayOf = (s: string) => addDays(s, -weekday(s));
