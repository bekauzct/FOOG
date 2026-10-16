/* FOOG seed – Toshkent bo‘yicha namunaviy ma’lumotlar.
 * Sinov hisoblari (Telegram «raqam ulashish» bosqichida shu raqamlarni kiriting):
 *   Futbolchi  +998 90 111 22 33  (Sardor Aliyev)
 *   Egasi      +998 90 123 45 67  (Jasur Karimov – Arena Yunusobod)
 *   Admin      +998 90 000 00 01  (Nodira Azimova)
 */
import { PrismaClient, type BookingStatus, type PitchSize } from '@prisma/client';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { addDays, dateVal, mondayOf, tashkentParts, timeVal } from '../src/time';
import { ACHIEVEMENTS } from '../src/services/achievements';

const prisma = new PrismaClient();
const UP = path.resolve(process.env.UPLOAD_DIR ?? './uploads');
const today = tashkentParts().date;
const nowHour = tashkentParts().hour;

function ff(args: string[]) {
  try { execFileSync('ffmpeg', ['-nostdin', '-y', '-loglevel', 'error', ...args], { stdio: 'ignore', timeout: 60000 }); return true; } catch { return false; }
}

/** Stadion rasmi o‘rniga maydon chizmasi (haqiqiy rasmlarni egasi yuklaydi) */
function pitchImage(name: string, hue: number, variant: number) {
  const dir = path.join(UP, 'stadiums'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.jpg`);
  if (fs.existsSync(file)) return `/uploads/stadiums/${name}.jpg`;
  const g = ['0x1d6b3c', '0x23744a', '0x1a5f37', '0x2a7d4f'][variant % 4];
  const stripes = Array.from({ length: 6 }, (_, i) => `drawbox=x=${i * 200}:y=0:w=100:h=800:color=black@0.08:t=fill`).join(',');
  const lines = 'drawbox=x=60:y=60:w=1080:h=680:color=white@0.85:t=6,drawbox=x=597:y=60:w=6:h=680:color=white@0.85:t=fill,drawbox=x=60:y=250:w=160:h=300:color=white@0.85:t=6,drawbox=x=980:y=250:w=160:h=300:color=white@0.85:t=6,drawbox=x=520:y=320:w=160:h=160:color=white@0.85:t=6';
  const night = variant % 2 ? ',eq=brightness=-0.12:saturation=1.1' : '';
  ff(['-f', 'lavfi', '-i', `color=c=${g}:s=1200x800`, '-vf', `${stripes},${lines},hue=h=${hue}${night}`, '-frames:v', '1', '-q:v', '5', file]);
  return `/uploads/stadiums/${name}.jpg`;
}

function reelVideo(name: string, hue: number) {
  const dir = path.join(UP, 'reels'); fs.mkdirSync(dir, { recursive: true });
  const v = path.join(dir, `${name}.mp4`), p = path.join(dir, `${name}.jpg`);
  if (!fs.existsSync(v)) {
    ff(['-f', 'lavfi', '-i', `testsrc2=s=540x960:d=6:r=25`, '-f', 'lavfi', '-i', 'sine=f=440:d=6', '-vf', `hue=h=${hue}:s=0.6,eq=brightness=-0.1`, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', v]);
    ff(['-ss', '1', '-i', v, '-frames:v', '1', '-q:v', '5', p]);
  }
  return { videoUrl: `/uploads/reels/${name}.mp4`, posterUrl: `/uploads/reels/${name}.jpg` };
}

function postImage(name: string, hue: number) {
  const dir = path.join(UP, 'posts'); fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${name}.jpg`);
  if (!fs.existsSync(f)) ff(['-f', 'lavfi', '-i', `gradients=s=1080x1350:c0=0x0d1226:c1=0x2a7d4f:x0=0:y0=0:x1=1080:y1=1350`, '-vf', `hue=h=${hue}`, '-frames:v', '1', '-q:v', '5', f]);
  return `/uploads/posts/${name}.jpg`;
}

async function main() {
  console.log('Seed: tozalash…');
  const tables = ['messages', 'chat_members', 'chats', 'match_invites', 'match_players', 'matches', 'team_members', 'teams', 'disputes', 'reviews', 'bookings', 'schedule', 'stadium_staff', 'stadium_photos', 'pitches', 'saves', 'likes', 'comments', 'reports', 'reels', 'posts', 'stories', 'follows', 'notifications', 'user_achievements', 'achievements', 'owner_profiles', 'audit_logs', 'early_access', 'stadiums', 'users'];
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} CASCADE`);
  for (const a of ACHIEVEMENTS) await prisma.achievement.create({ data: { ...a } });

  console.log('· Foydalanuvchilar', new Date().toISOString().slice(11,19));
  // ---------- Foydalanuvchilar ----------
  const U = async (d: { name: string; username: string; phone: string; role?: 'player' | 'owner' | 'admin'; position?: string; foot?: 'left' | 'right' | 'both'; district?: string; skill?: string; level?: number; xp?: number; bio?: string; jersey?: number; available?: string[]; verified?: boolean; noShows?: number; daysAgo?: number }) =>
    prisma.user.create({ data: { ...d, role: d.role ?? 'player', telegramId: BigInt(7000000000 + Math.floor(Math.random() * 99999999)), daysAgo: undefined, createdAt: new Date(Date.now() - (d.daysAgo ?? 90) * 864e5) } as never });

  const admin = await U({ name: 'Nodira Azimova', username: 'nodira_admin', phone: '+998900000001', role: 'admin', district: 'Yunusobod', daysAgo: 500 });
  const mod2 = await U({ name: 'Otabek Yo‘ldoshev', username: 'otabek_mod', phone: '+998900000002', role: 'admin', district: 'Mirobod', daysAgo: 400 });
  const jasur = await U({ name: 'Jasur Karimov', username: 'jasur_arena', phone: '+998901234567', role: 'owner', district: 'Yunusobod', daysAgo: 580 });
  const rustam = await U({ name: 'Rustam Qodirov', username: 'rustam_arena', phone: '+998905551240', role: 'owner', district: 'Sergeli', daysAgo: 3 });
  const akbar = await U({ name: 'Akbar Nazarov', username: 'akbar_fm', phone: '+998974001122', role: 'owner', district: 'Mirzo Ulug‘bek', daysAgo: 480 });
  const shohruh = await U({ name: 'Shohruh Ergashev', username: 'shohruh_e', phone: '+998932107715', role: 'owner', district: 'Olmazor', daysAgo: 2 });
  const bobur = await U({ name: 'Bobur Hamidov', username: 'bobur_h', phone: '+998993004050', role: 'owner', district: 'Yashnobod', daysAgo: 390 });
  const laziz = await U({ name: 'Laziz Tursunov', username: 'laziz_sport', phone: '+998946667788', role: 'owner', district: 'Chilonzor', daysAgo: 300 });
  for (const o of [jasur, rustam, akbar, shohruh, bobur, laziz]) await prisma.ownerProfile.create({ data: { userId: o.id } });
  await prisma.ownerProfile.update({ where: { userId: jasur.id }, data: { company: '«Arena Sport» MChJ', stir: '305 123 456', legalAddress: 'Toshkent, Yunusobod tumani, Amir Temur ko‘chasi 108' } });
  await prisma.ownerProfile.update({ where: { userId: akbar.id }, data: { company: '«Futbol Markazi» MChJ', stir: '306 778 120' } });
  await prisma.ownerProfile.update({ where: { userId: rustam.id }, data: { stir: '307 441 902' } });

  const P = [
    { name: 'Sardor Aliyev', username: 'sardor_a', phone: '+998901112233', position: 'CM', foot: 'right', district: 'Yunusobod', skill: 'advanced', level: 7, xp: 3240, bio: 'Markaziy yarim himoyachi. Payshanba kunlari Arena Yunusobodda, yakshanba – Yunusobod ligasida. 5×5 ga doim tayyor.', jersey: 8, available: ['thu', 'sun', 'tonight'], verified: true },
    { name: 'Diyor Mahmudov', username: 'diyor10', phone: '+998973001245', position: 'ST', foot: 'left', district: 'Chilonzor', skill: 'advanced', level: 9, xp: 4120, bio: 'Hujumchi. 30 kunlik skill challenge davom etmoqda.', jersey: 10, available: ['tonight', 'fri'], verified: true },
    { name: 'Timur Sultonov', username: 'timur_gk', phone: '+998931234455', position: 'GK', foot: 'right', district: 'Olmazor', skill: 'intermediate', level: 6, xp: 2600, available: ['fri'], jersey: 1 },
    { name: 'Navro‘z Ismoilov', username: 'navroz_i', phone: '+998916007214', position: 'RB', foot: 'right', district: 'Sergeli', skill: 'beginner', level: 2, xp: 640, available: ['weekends'], noShows: 2 },
    { name: 'Kamol Yo‘ldoshev', username: 'kamol_y', phone: '+998934105502', position: 'LW', foot: 'left', district: 'Yashnobod', skill: 'intermediate', level: 3, xp: 900, available: ['weekends'], noShows: 3 },
    { name: 'Bek Toshmatov', username: 'bek_t', phone: '+998941208819', position: 'CB', foot: 'right', district: 'Yunusobod', skill: 'intermediate', level: 5, xp: 2100, available: ['thu', 'weekends'] },
    { name: 'Akmal Rasulov', username: 'akmal_r', phone: '+998934105503', position: 'CAM', foot: 'both', district: 'Mirzo Ulug‘bek', skill: 'advanced', level: 8, xp: 3800, available: ['tonight', 'fri'] },
    { name: 'Azizbek Nurmatov', username: 'azizbek_n', phone: '+998901115566', position: 'LB', foot: 'left', district: 'Yunusobod', skill: 'beginner', level: 2, xp: 410, available: ['weekends'] },
    { name: 'Dilshod Rahimov', username: 'dilshod_r', phone: '+998909998877', position: 'CDM', foot: 'right', district: 'Yakkasaroy', skill: 'intermediate', level: 5, xp: 2300, available: ['thu', 'fri'] },
    { name: 'Jamshid Ergashev', username: 'jamshid_e', phone: '+998935557711', position: 'RW', foot: 'right', district: 'Chilonzor', skill: 'advanced', level: 7, xp: 3300, available: ['tonight'] },
    { name: 'Sherzod Qodirov', username: 'sherzod_q', phone: '+998977773311', position: 'GK', foot: 'left', district: 'Yunusobod', skill: 'advanced', level: 8, xp: 3700, available: ['weekends', 'thu'], verified: true },
    { name: 'Ulug‘bek Hasanov', username: 'ulugbek_h', phone: '+998903334422', position: 'ST', foot: 'right', district: 'Shayxontohur', skill: 'intermediate', level: 4, xp: 1700, available: ['fri', 'weekends'] },
    { name: 'Farrux Saidov', username: 'farrux_s', phone: '+998908887766', position: 'CB', foot: 'right', district: 'Mirobod', skill: 'beginner', level: 1, xp: 120, available: ['tonight'] },
    { name: 'Botir Yusupov', username: 'botir_y', phone: '+998946665544', position: 'CM', foot: 'right', district: 'Uchtepa', skill: 'intermediate', level: 4, xp: 1500, available: ['thu'] },
    { name: 'Islom Karimov', username: 'islom_k', phone: '+998950001122', position: 'RM', foot: 'right', district: 'Yunusobod', skill: 'intermediate', level: 5, xp: 2050, available: ['fri', 'tonight'] },
    { name: 'Malika Saidova', username: 'malika_s', phone: '+998901002030', position: null, district: 'Yunusobod', level: 1 },
    { name: 'Otabek Yusupov', username: 'otabek_admin', phone: '+998901002031', position: null, district: 'Yunusobod', level: 1 },
  ] as const;
  const players: Record<string, Awaited<ReturnType<typeof U>>> = {};
  for (const p of P) players[p.username] = await U({ ...(p as never), daysAgo: 30 + Math.floor(Math.random() * 300) });
  const sardor = players.sardor_a, diyor = players.diyor10, timur = players.timur_gk, kamol = players.kamol_y, navroz = players.navroz_i;
  await prisma.user.update({ where: { id: kamol.id }, data: { status: 'blocked', blockedUntil: new Date(Date.now() + 5 * 864e5), blockReason: '3-marta kelmagani uchun' } });
  const active = Object.values(players).filter((p) => !['malika_s', 'otabek_admin', 'kamol_y'].includes(p.username!));

  console.log('· Stadionlar', new Date().toISOString().slice(11,19));
  // ---------- Stadionlar ----------
  type SP = { name: string; size: PitchSize; surface: string; indoor: boolean; price: number; peak: number; note?: string };
  const S = async (d: { code: string; owner: string; name: string; district: string; address: string; lat: number; lng: number; status: 'live' | 'mod' | 'off' | 'rejected'; metro?: string; desc?: string; amen: string[]; partner?: boolean; photos: number; hue: number; pitches: SP[]; daysAgo: number; close?: number }) => {
    const st = await prisma.stadium.create({
      data: {
        code: d.code, ownerId: d.owner, name: d.name, district: d.district, address: d.address, lat: d.lat, lng: d.lng, status: d.status, metro: d.metro, description: d.desc, amenities: d.amen, partner: !!d.partner,
        phone: '+998 71 200 ' + d.code.slice(-2) + ' ' + d.code.slice(-2), createdAt: new Date(Date.now() - d.daysAgo * 864e5),
        checklist: d.status === 'live' ? { 0: true, 1: true, 2: true, 3: true, 4: true } : undefined,
        pitches: { create: d.pitches.map((p) => ({ name: p.name, size: p.size, surface: p.surface, indoor: p.indoor, price: p.price, peakPrice: p.peak, note: p.note })) },
        schedule: { create: Array.from({ length: 7 }, (_, w) => ({ type: 'hours' as const, weekday: w, startTime: timeVal('08:00'), endTime: timeVal(w >= 5 ? '00:00' : `${String(d.close ?? 24).padStart(2, '0')}:00`.replace('24:00', '00:00')) })) },
        photos: { create: Array.from({ length: d.photos }, (_, i) => ({ url: pitchImage(`${d.code}-${i}`, d.hue + i * 8, i), sort: i, caption: ['maydon', 'kiyinish xonasi', 'kechki o‘yin', 'kafe', 'tepadan ko‘rinish', 'tribuna', 'kirish', 'avtoturargoh'][i % 8] })) },
      },
      include: { pitches: { orderBy: { name: 'asc' } } },
    });
    return st;
  };
  const arena = await S({ code: 'ST-0012', owner: jasur.id, name: 'Arena Yunusobod', district: 'Yunusobod', address: 'Amir Temur shoh ko‘chasi 108, Yunusobod', lat: 41.3655, lng: 69.2869, status: 'live', metro: 'Yunusobod', partner: true, daysAgo: 580,
    desc: 'Uchta yopiq va ochiq maydon, FIFA Quality sun’iy o‘ti, yarim tungacha LED yoritish. Dushli kiyinish xonalari, bepul maykalar va to‘plar, 1-maydonga qaragan kafe. Haftalik 5×5 va kichik turnirlar uchun ideal.',
    amen: ['parking', 'showers', 'changing', 'lockers', 'cafe', 'balls', 'accessible', 'wifi', 'lights'], photos: 8, hue: 0,
    pitches: [{ name: 'Maydon A', size: 's5x5', surface: 'turf', indoor: true, price: 300000, peak: 380000, note: 'Yopiq · kafe yonida' }, { name: 'Maydon B', size: 's7x7', surface: 'turf', indoor: false, price: 420000, peak: 500000, note: 'Ochiq · 40×20 m' }, { name: 'Maydon C', size: 's5x5', surface: 'futsal', indoor: true, price: 250000, peak: 320000, note: 'Futzal zali' }] });
  const cage = await S({ code: 'ST-0018', owner: laziz.id, name: 'Chilonzor Cage', district: 'Chilonzor', address: 'Bunyodkor shoh ko‘chasi 12, Chilonzor', lat: 41.2756, lng: 69.2034, status: 'live', metro: 'Chilonzor', daysAgo: 300, amen: ['lights', 'lockers'], photos: 6, hue: 20,
    pitches: [{ name: 'Qafas 1', size: 's5x5', surface: 'turf', indoor: false, price: 180000, peak: 225000 }, { name: 'Qafas 2', size: 's5x5', surface: 'turf', indoor: false, price: 180000, peak: 225000 }] });
  const anhor = await S({ code: 'ST-0021', owner: laziz.id, name: 'Anhor Indoor', district: 'Shayxontohur', address: 'Navoiy ko‘chasi 30, Anhor bo‘yi', lat: 41.3225, lng: 69.2541, status: 'live', metro: 'Paxtakor', daysAgo: 260, amen: ['parking', 'showers', 'cafe', 'changing'], photos: 6, hue: 40,
    pitches: [{ name: 'Zal 1', size: 's7x7', surface: 'hybrid', indoor: true, price: 330000, peak: 400000 }] });
  const bodomzor = await S({ code: 'ST-0027', owner: akbar.id, name: 'Bodomzor 7s', district: 'Yunusobod', address: 'Bodomzor yo‘li 5, Yunusobod', lat: 41.3392, lng: 69.2857, status: 'live', metro: 'Bodomzor', daysAgo: 220, amen: ['parking', 'lights'], photos: 5, hue: 60,
    pitches: [{ name: 'Maydon 1', size: 's7x7', surface: 'turf', indoor: false, price: 200000, peak: 250000 }, { name: 'Maydon 2', size: 's7x7', surface: 'turf', indoor: false, price: 200000, peak: 250000 }] });
  const yakka = await S({ code: 'ST-0029', owner: laziz.id, name: 'Yakkasaroy Hall', district: 'Yakkasaroy', address: 'Shota Rustaveli ko‘chasi 41, Yakkasaroy', lat: 41.2913, lng: 69.2655, status: 'live', metro: 'Oybek', daysAgo: 200, amen: ['showers', 'changing', 'wifi', 'accessible'], photos: 5, hue: 80,
    pitches: [{ name: 'Futzal zali', size: 's5x5', surface: 'futsal', indoor: true, price: 290000, peak: 350000 }] });
  const fm = await S({ code: 'ST-0031', owner: akbar.id, name: 'Mirzo Ulug‘bek Futbol markazi', district: 'Mirzo Ulug‘bek', address: 'Buyuk Ipak yo‘li 154, Mirzo Ulug‘bek', lat: 41.3381, lng: 69.3346, status: 'live', metro: 'Buyuk Ipak yo‘li', daysAgo: 480, amen: ['parking', 'showers', 'changing', 'lockers', 'lights'], photos: 7, hue: 100,
    pitches: [{ name: 'Katta maydon', size: 's11x11', surface: 'grass', indoor: false, price: 750000, peak: 900000 }, { name: 'Mini maydon', size: 's5x5', surface: 'turf', indoor: false, price: 220000, peak: 260000 }] });
  const sergeli = await S({ code: 'ST-0071', owner: rustam.id, name: 'Sergeli Arena', district: 'Sergeli', address: 'Yangi Sergeli ko‘chasi 12, Sergeli', lat: 41.2262, lng: 69.2186, status: 'mod', daysAgo: 0.1, amen: ['parking', 'lights'], photos: 8, hue: 120,
    pitches: [{ name: 'Maydon 1', size: 's5x5', surface: 'turf', indoor: false, price: 280000, peak: 330000 }, { name: 'Maydon 2', size: 's5x5', surface: 'turf', indoor: false, price: 280000, peak: 330000 }] });
  const chilSport = await S({ code: 'ST-0070', owner: jasur.id, name: 'Chilonzor Sport', district: 'Chilonzor', address: 'Bunyodkor shoh ko‘chasi 41, Chilonzor', lat: 41.2711, lng: 69.2101, status: 'mod', daysAgo: 0.2, amen: ['parking', 'showers'], photos: 6, hue: 140,
    pitches: [{ name: 'Maydon B', size: 's7x7', surface: 'turf', indoor: false, price: 420000, peak: 480000 }] });
  const olmazor = await S({ code: 'ST-0069', owner: shohruh.id, name: 'Olmazor Futzal', district: 'Olmazor', address: 'Qorasaroy ko‘chasi 7, Olmazor', lat: 41.3456, lng: 69.2153, status: 'mod', daysAgo: 1, amen: ['changing'], photos: 3, hue: 160,
    pitches: [{ name: 'Zal', size: 's5x5', surface: 'futsal', indoor: true, price: 230000, peak: 260000 }] });
  await S({ code: 'ST-0044', owner: bobur.id, name: 'Yashnobod Mini', district: 'Yashnobod', address: 'Mahtumquli ko‘chasi 3, Yashnobod', lat: 41.2902, lng: 69.3398, status: 'off', daysAgo: 390, amen: ['lights'], photos: 4, hue: 180,
    pitches: [{ name: 'Maydon', size: 's5x5', surface: 'turf', indoor: false, price: 240000, peak: 270000 }] });
  await prisma.stadium.update({ where: { id: olmazor.id }, data: { checklist: { 0: false, 1: true, 2: true, 3: true } } });
  await prisma.stadium.update({ where: { id: sergeli.id }, data: { checklist: { 0: true, 1: true, 2: true, 3: true } } });
  await prisma.stadium.update({ where: { id: chilSport.id }, data: { checklist: { 0: true, 1: true, 2: true, 3: true, 4: true } } });
  await prisma.stadiumStaff.createMany({ data: [{ stadiumId: arena.id, userId: players.otabek_admin.id }, { stadiumId: arena.id, userId: players.malika_s.id }] });

  console.log('· Bronlar', new Date().toISOString().slice(11,19));
  // ---------- Bronlar ----------
  let seq = 1000;
  const B = async (d: { user: string; pitch: string; date: string; start: number; hours?: number; price: number; status: BookingStatus; reason?: string; createdMinAgo?: number }) => {
    const h = d.hours ?? 1;
    const end = d.start + h;
    return prisma.booking.create({ data: { code: `FG-${++seq}`, userId: d.user, pitchId: d.pitch, date: dateVal(d.date), startTime: timeVal(`${String(Math.floor(d.start)).padStart(2, '0')}:${d.start % 1 ? '30' : '00'}`), endTime: timeVal(`${String(Math.floor(end) % 24).padStart(2, '0')}:${end % 1 ? '30' : '00'}`), price: d.price * h, status: d.status, rejectReason: d.reason, createdAt: new Date(Date.now() - (d.createdMinAgo ?? 3 * 24 * 60) * 60000), decidedAt: ['pending'].includes(d.status) ? null : new Date(Date.now() - 864e5) } });
  };
  const [pA, pB, pC] = arena.pitches;
  // O‘tgan 6 oy: Arena Yunusobod daromadi uchun «Keldi» bronlar (deterministik)
  const people = active.map((p) => p.id);
  for (let i = 1; i <= 180; i++) {
    const d = addDays(today, -i);
    const n = 2 + ((i * 7) % 5) + (i % 7 === 5 || i % 7 === 6 ? 2 : 0);
    for (let k = 0; k < n; k++) {
      const pitch = [pA, pB, pC][(i + k) % 3];
      const start = [18, 19, 20, 21, 22, 10, 12, 17][(i * 3 + k) % 8];
      const peak = start >= 18;
      const exists = await prisma.booking.findFirst({ where: { pitchId: pitch.id, date: dateVal(d), startTime: timeVal(start) } });
      if (exists) continue;
      const st: BookingStatus = (i * 13 + k) % 31 === 0 ? 'no_show' : (i * 5 + k) % 23 === 0 ? 'cancelled' : 'arrived';
      await B({ user: people[(i + k) % people.length], pitch: pitch.id, date: d, start, price: peak ? pitch.peakPrice : pitch.price, status: st, createdMinAgo: i * 1440 + 600 });
    }
  }
  // Boshqa stadionlarda ham o‘tgan bronlar (reyting va bandlik uchun)
  for (const st of [cage, anhor, bodomzor, yakka, fm]) for (let i = 1; i <= 20; i++) {
    const p = st.pitches[i % st.pitches.length];
    await B({ user: people[i % people.length], pitch: p.id, date: addDays(today, -i), start: 19 + (i % 3), price: p.peakPrice, status: 'arrived', createdMinAgo: i * 1440 + 300 });
  }
  seq = 2440;
  const later = Math.min(Math.max(nowHour + 2, 18), 22);
  const tomorrow = addDays(today, 1);
  const b2440 = await B({ user: players.akmal_r.id, pitch: pA.id, date: addDays(today, -4), start: 18, price: pA.peakPrice, status: 'rejected', reason: 'Bu vaqtda maydon ta’mirda' });
  seq = 2448;
  const b2449 = await B({ user: navroz.id, pitch: pB.id, date: addDays(today, -3), start: 21, price: pB.peakPrice, status: 'no_show' });
  const b2455 = await B({ user: players.bek_t.id, pitch: pA.id, date: today, start: 9, price: pA.price, status: nowHour >= 10 ? 'arrived' : 'confirmed' });
  const b2461 = await B({ user: players.bek_t.id, pitch: pC.id, date: tomorrow, start: 18, price: pC.peakPrice, status: 'confirmed' });
  const b2468 = await B({ user: players.dilshod_r.id, pitch: pB.id, date: today, start: Math.min(later, 21), hours: 2, price: pB.peakPrice, status: 'confirmed' });
  const b2470 = await B({ user: players.islom_k.id, pitch: pA.id, date: today, start: Math.max(later - 1, 17), price: pA.peakPrice, status: 'confirmed' });
  const b2476 = await B({ user: diyor.id, pitch: pC.id, date: addDays(today, 2), start: 11, price: pC.price, status: 'pending', createdMinAgo: 60 });
  const b2479 = await B({ user: players.jamshid_e.id, pitch: pB.id, date: tomorrow, start: 20, hours: 1.5, price: pB.peakPrice, status: 'pending', createdMinAgo: 18 });
  const b2481 = await B({ user: players.ulugbek_h.id, pitch: pA.id, date: later + 1 < 24 ? today : tomorrow, start: Math.min(later + 1, 23), price: pA.peakPrice, status: 'pending', createdMinAgo: 5 });
  // Sardor (asosiy futbolchi) bronlari
  const sardorB = await B({ user: sardor.id, pitch: pB.id, date: addDays(today, 3), start: 20, price: pB.peakPrice, status: 'confirmed' });
  const sardorPast = await B({ user: sardor.id, pitch: cage.pitches[0].id, date: addDays(today, -2), start: 19, price: cage.pitches[0].peakPrice, status: 'arrived' });
  await B({ user: sardor.id, pitch: anhor.pitches[0].id, date: addDays(today, 5), start: 19, price: anhor.pitches[0].peakPrice, status: 'pending', createdMinAgo: 30 });
  await B({ user: sardor.id, pitch: yakka.pitches[0].id, date: addDays(today, -8), start: 20, price: yakka.pitches[0].peakPrice, status: 'expired' });
  const kamolB = await B({ user: kamol.id, pitch: bodomzor.pitches[0].id, date: addDays(today, -5), start: 18, price: 250000, status: 'no_show' });
  // Ochiq o‘yinlar uchun bronlar
  const mB1 = await B({ user: diyor.id, pitch: cage.pitches[1].id, date: today, start: Math.min(later + 1, 23), price: cage.pitches[1].peakPrice, status: 'confirmed' });
  const mB2 = await B({ user: players.akmal_r.id, pitch: bodomzor.pitches[1].id, date: addDays(today, 1), start: 10, price: 200000, status: 'confirmed' });
  const mB3 = await B({ user: players.bek_t.id, pitch: pA.id, date: addDays(today, 6 - ((new Date().getUTCDay() + 6) % 7) >= 1 ? 6 - ((new Date().getUTCDay() + 6) % 7) : 7), start: 20, price: pA.peakPrice, status: 'confirmed' });
  const mB4 = await B({ user: players.jamshid_e.id, pitch: fm.pitches[0].id, date: addDays(today, 2), start: 16, hours: 2, price: fm.pitches[0].price, status: 'confirmed' });
  void b2440; void b2455; void b2461; void b2468; void b2470; void b2476; void b2479; void b2481;
  await prisma.schedule.createMany({ data: [
    { stadiumId: arena.id, pitchId: pA.id, type: 'blocked', date: dateVal(addDays(today, 1)), startTime: timeVal(9), endTime: timeVal(11) },
    { stadiumId: arena.id, pitchId: pB.id, type: 'blocked', date: dateVal(addDays(today, 3)), startTime: timeVal(8), endTime: timeVal(9) },
  ] });

  console.log('· Nizolar', new Date().toISOString().slice(11,19));
  // ---------- Nizolar ----------
  await prisma.dispute.create({ data: { bookingId: b2449.id, openedById: navroz.id, reason: 'Men o‘z vaqtida keldim, administrator boshqa jamoani kiritgan. Rasm bor.' } });
  await prisma.dispute.create({ data: { bookingId: kamolB.id, openedById: kamol.id, reason: 'Bron bekor qilinganini aytishgan edi, shuning uchun bormadim.' } });

  console.log('· Sharhlar', new Date().toISOString().slice(11,19));
  // ---------- Sharhlar ----------
  const R = (u: string, st: string, rating: number, text: string, daysAgo: number, reply?: string) => prisma.review.create({ data: { userId: u, stadiumId: st, rating, rPitch: Math.min(5, rating + (daysAgo % 2)), rFacilities: Math.max(3, rating - (daysAgo % 2)), rValue: Math.max(3, rating - 1), rBooking: 5, text, reply, repliedAt: reply ? new Date() : null, createdAt: new Date(Date.now() - daysAgo * 864e5) } });
  await R(players.dilshod_r.id, arena.id, 5, 'Yoritish zo‘r, o‘t yangi. Kiyinish xonasi toza. Har hafta shu yerda o‘ynaymiz.', 2);
  await R(players.azizbek_n.id, arena.id, 4, 'Maydon yaxshi, lekin avtoturargohda kechqurun joy kam bo‘ladi.', 5);
  await R(players.sherzod_q.id, arena.id, 5, 'Shahar shimolidagi eng yaxshi o‘t. Brondan o‘yingacha ikki daqiqa ketdi, maykalar ham tayyor turardi.', 14, 'Rahmat, Sherzod! Kelasi hafta ham kutamiz.');
  await R(players.akmal_r.id, arena.id, 4, 'Yoritish ajoyib, kafedan boshqa o‘yinlarni ko‘rish qulay. 19:00 dan keyin avtoturargoh to‘ladi – ertaroq keling.', 30);
  await R(timur.id, arena.id, 5, 'Bron tez tasdiqlandi, administrator xushmuomala. Futzal uchun eng yaxshi joy.', 7);
  await R(sardor.id, cage.id, 4, 'Arzon va qulay, lekin dush yo‘q.', 2);
  await R(diyor.id, anhor.id, 5, 'Yopiq zal, qishda ham o‘ynasa bo‘ladi.', 10);
  await R(players.bek_t.id, bodomzor.id, 4, 'Ikki maydon yonma-yon, jamoa bilan qulay.', 12);
  await R(players.jamshid_e.id, yakka.id, 5, 'Futzal pol yangi, to‘plar sifatli.', 20);
  await R(players.islom_k.id, fm.id, 4, 'Haqiqiy 11×11 tabiiy o‘t – Toshkentda kam uchraydi.', 25);
  await prisma.review.updateMany({ where: { userId: sardor.id, stadiumId: cage.id }, data: { bookingId: sardorPast.id } });

  console.log('· Jamoalar', new Date().toISOString().slice(11,19));
  // ---------- Jamoalar ----------
  const T = (name: string, short: string, captain: string, district: string, level: string, looking: string[], plays: string, members: string[]) =>
    prisma.team.create({ data: { name, short, captainId: captain, district, level, lookingFor: looking, plays, members: { create: [...new Set([captain, ...members])].map((userId) => ({ userId })) }, chats: { create: { type: 'team', name, members: { create: [...new Set([captain, ...members])].map((userId) => ({ userId })) } } } }, include: { chats: true } });
  const lions = await T('Yunusobod Lions', 'YL', sardor.id, 'Yunusobod', 'intermediate', ['GK', 'LB'], 'Payshanba kechqurun', [players.bek_t.id, players.azizbek_n.id, players.sherzod_q.id, players.islom_k.id]);
  const chilFc = await T('Chilonzor FC', 'CF', diyor.id, 'Chilonzor', 'advanced', ['DEF'], 'Juma kechqurun', [players.jamshid_e.id, timur.id, players.akmal_r.id]);
  const oqtepa = await T('Oqtepa Boys', 'OB', players.ulugbek_h.id, 'Shayxontohur', 'beginner', ['Har qanday'], 'Shanba ertalab', [players.farrux_s.id, navroz.id]);
  const itpark = await T('IT Park jamoasi', 'IT', players.dilshod_r.id, 'Mirzo Ulug‘bek', 'intermediate', ['MID', 'FWD'], 'Seshanba 20:00', [players.botir_y.id]);
  void itpark;

  console.log('· O‘yinlar', new Date().toISOString().slice(11,19));
  // ---------- O‘yinlar ----------
  const M = async (d: { booking: { id: string; price: number }; organizer: string; title: string; capacity: number; level: string; needs: string[]; players: string[]; status?: 'open' | 'full' | 'done'; home?: string; away?: string; score?: [number, number]; mvp?: string; goals?: Record<string, [number, number]> }) => {
    const m = await prisma.match.create({ data: { bookingId: d.booking.id, organizerId: d.organizer, title: d.title, capacity: d.capacity, priceEach: Math.ceil(d.booking.price / d.capacity / 1000) * 1000, level: d.level, needs: d.needs, status: d.status ?? (d.players.length >= d.capacity ? 'full' : 'open'), homeTeamId: d.home, awayTeamId: d.away, homeScore: d.score?.[0], awayScore: d.score?.[1], mvpId: d.mvp } });
    const ids = [...new Set([d.organizer, ...d.players])];
    await prisma.matchPlayer.createMany({ data: ids.map((userId, i) => ({ matchId: m.id, userId, side: i % 2 ? 'away' : 'home', goals: d.goals?.[userId]?.[0] ?? 0, assists: d.goals?.[userId]?.[1] ?? 0 })) });
    const chat = await prisma.chat.create({ data: { type: 'match', matchId: m.id, name: d.title, members: { create: ids.map((userId) => ({ userId, lastReadAt: new Date() })) } } });
    return { ...m, chatId: chat.id };
  };
  const live = active.filter((p) => p.id !== sardor.id).map((p) => p.id);
  const m1 = await M({ booking: mB1, organizer: diyor.id, title: 'Juma oqshomi 5×5', capacity: 10, level: 'any', needs: ['GK', 'DEF'], players: live.slice(1, 8) });
  const m2 = await M({ booking: mB2, organizer: players.akmal_r.id, title: 'Ertalabki 7×7 · Bodomzor', capacity: 14, level: 'intermediate', needs: ['Har qanday'], players: live.slice(2, 12) });
  const m3 = await M({ booking: mB3, organizer: players.bek_t.id, title: 'Payshanba 5×5', capacity: 10, level: 'intermediate', needs: ['MID'], players: [sardor.id, ...live.slice(4, 11)] });
  const m4 = await M({ booking: mB4, organizer: players.jamshid_e.id, title: 'Katta maydon 11×11', capacity: 22, level: 'advanced', needs: ['GK', 'CB', 'ST'], players: live.slice(0, 9) });
  // O‘tgan o‘yinlar (statistika, yutuqlar)
  const pastPitch = [pA, pB, pC, cage.pitches[0], bodomzor.pitches[0]];
  const donePeople = [sardor.id, diyor.id, players.bek_t.id, players.akmal_r.id, players.jamshid_e.id, players.sherzod_q.id, timur.id, players.islom_k.id, players.dilshod_r.id, players.azizbek_n.id];
  let lastDone: { id: string } | null = null;
  for (let i = 0; i < 14; i++) {
    const pitch = pastPitch[i % pastPitch.length];
    const date = addDays(today, -(1 + i * 3));
    const start = 19 + (i % 3);
    const existing = await prisma.booking.findFirst({ where: { pitchId: pitch.id, date: dateVal(date), startTime: { lte: timeVal(start) }, endTime: { gt: timeVal(start) }, status: { in: ['pending', 'confirmed', 'arrived'] } } });
    const booking = existing && !(await prisma.match.findUnique({ where: { bookingId: existing.id } })) ? existing : await B({ user: donePeople[i % donePeople.length], pitch: pitch.id, date, start: start > 22 ? 22 : start, price: pitch.peakPrice, status: 'arrived' }).catch(() => null);
    if (!booking) continue;
    const hs = (i * 3) % 5, as = (i * 2 + 1) % 4;
    const goals: Record<string, [number, number]> = { [sardor.id]: [i === 2 ? 3 : i % 2, (i + 1) % 2], [diyor.id]: [(i % 3) + (i === 5 ? 3 : 0), i % 2], [players.akmal_r.id]: [i % 2, 1] };
    lastDone = await M({ booking, organizer: donePeople[i % donePeople.length], title: i % 2 ? 'Haftalik 5×5' : 'Yakshanba ligasi', capacity: 10, level: 'any', needs: [], players: donePeople, status: 'done', score: [hs, as], mvp: i % 3 === 0 ? sardor.id : diyor.id, goals, home: i % 2 ? lions.id : undefined, away: i % 2 ? chilFc.id : undefined });
  }
  void lastDone;

  // XP / yutuqlar
  const { awardAfterMatch } = await import('../src/services/achievements');
  const done = await prisma.match.findMany({ where: { status: 'done' }, select: { id: true } });
  for (const m of done.slice(-2)) await awardAfterMatch(m.id);
  await prisma.user.update({ where: { id: sardor.id }, data: { xp: 3240, level: 7 } });
  await prisma.notification.deleteMany({});

  console.log('· Kuzatishlar', new Date().toISOString().slice(11,19));
  // ---------- Kuzatishlar ----------
  const follows: [string, string][] = [];
  for (const a of active) for (const b of active) if (a.id !== b.id && (a.username!.length + b.username!.length) % 3 === 0) follows.push([a.id, b.id]);
  follows.push([sardor.id, diyor.id], [sardor.id, players.akmal_r.id], [sardor.id, players.sherzod_q.id], [diyor.id, sardor.id], [players.jamshid_e.id, sardor.id], [players.bek_t.id, sardor.id]);
  await prisma.follow.createMany({ data: [...new Map(follows.map(([a, b]) => [`${a}${b}`, { followerId: a, followingId: b }])).values()], skipDuplicates: true });

  console.log('· Postlar, hikoyalar, reels', new Date().toISOString().slice(11,19));
  // ---------- Postlar, hikoyalar, reels ----------
  const hrs = (h: number) => new Date(Date.now() - h * 3600 * 1000);
  const post1 = await prisma.post.create({ data: { authorId: diyor.id, stadiumId: arena.id, kind: 'result', text: 'Oxirgi daqiqada jarima maydonchasi tashqarisidan g‘alaba goli. Hali ham kirganiga ishonmayapman.', mediaUrl: postImage('p1', 0), mediaType: 'image', stats: { result: 'G 4–3', played: '62′', goals: 2, assists: 1 }, createdAt: hrs(2) } });
  const post2 = await prisma.post.create({ data: { authorId: players.ulugbek_h.id, kind: 'find_players', text: 'Yakshanba kuni darvozabon va chap himoyachi qidiryapmiz. O‘rta daraja, 18 yoshdan katta. Xabar yozing yoki pastdagi o‘yinga qo‘shiling.', mediaUrl: postImage('p2', 60), mediaType: 'image', createdAt: hrs(6) } });
  const post3 = await prisma.post.create({ data: { authorId: sardor.id, stadiumId: cage.id, kind: 'result', text: 'Chilonzor Cage da ajoyib o‘yin bo‘ldi. Hat-trick!', stats: { result: 'G 5–2', played: '60′', goals: 3, assists: 1 }, createdAt: hrs(30) } });
  await prisma.post.create({ data: { authorId: players.akmal_r.id, text: 'Payshanba kuni kim o‘ynaydi? Arena Yunusobodda 20:00 da bron bor, 3 ta joy qoldi.', createdAt: hrs(9) } });
  await prisma.post.create({ data: { authorId: players.sherzod_q.id, text: 'Bugun 4 ta seyv. Darvozabonlar ham gol urmaydi, lekin o‘yinni yutadi.', mediaUrl: postImage('p4', 120), mediaType: 'image', createdAt: hrs(20) } });
  await prisma.post.create({ data: { authorId: kamol.id, text: '«Eng arzon stadion – faqat bizda!» Batafsil @stadion_arzon', createdAt: hrs(40) } });
  for (const [i, u] of active.slice(0, 12).entries()) {
    await prisma.like.create({ data: { userId: u.id, postId: post1.id } });
    if (i % 2) await prisma.like.create({ data: { userId: u.id, postId: post2.id } });
    if (i % 3 === 0 && u.id !== sardor.id) await prisma.like.create({ data: { userId: u.id, postId: post3.id } });
  }
  await prisma.comment.createMany({ data: [
    { userId: sardor.id, postId: post1.id, text: 'Qanday zarba edi! 🔥' }, { userId: players.bek_t.id, postId: post1.id, text: 'Payshanba kuni menga o‘rgatasan' },
    { userId: players.jamshid_e.id, postId: post2.id, text: 'Men chap himoyada o‘ynay olaman' }, { userId: players.akmal_r.id, postId: post3.id, text: 'Payshanba kuni buni menga o‘rgat' },
  ] });
  await prisma.story.createMany({ data: [
    { authorId: diyor.id, text: 'Bugun 21:00 – Chilonzor Cage', expiresAt: new Date(Date.now() + 20 * 3600e3), createdAt: hrs(3) },
    { authorId: players.ulugbek_h.id, text: 'Oqtepa Boys – jonli!', live: true, expiresAt: new Date(Date.now() + 22 * 3600e3), createdAt: hrs(1) },
    { authorId: players.akmal_r.id, mediaUrl: postImage('s3', 200), expiresAt: new Date(Date.now() + 10 * 3600e3), createdAt: hrs(12) },
    { authorId: players.sherzod_q.id, text: 'Seyv kuni', expiresAt: new Date(Date.now() + 18 * 3600e3), createdAt: hrs(5) },
    { authorId: players.bek_t.id, text: 'Mashg‘ulot', expiresAt: new Date(Date.now() + 15 * 3600e3), createdAt: hrs(8) },
  ] });
  const reels = [
    { a: diyor.id, st: arena.id, cap: '89-daqiqada rabona bilan golli uzatma. O‘zim ham ishonmadim.', type: 'O‘yin lavhasi', h: 0, views: 48200 },
    { a: players.jamshid_e.id, st: cage.id, cap: '25 metrdan to‘qsonga. #toshkentfutboli #5x5', type: 'Gol', h: 60, views: 112000 },
    { a: players.sherzod_q.id, st: arena.id, cap: 'Uchta ketma-ket seyv. Darvozabonlar ham yulduz.', type: 'Seyv', h: 120, views: 22100 },
    { a: jasur.id, st: arena.id, cap: 'B maydonga yangi o‘t yotqizildi. Kechki soatlar ochiq.', type: 'Stadion sharhi', h: 180, views: 12400, cta: true },
    { a: players.akmal_r.id, st: fm.id, cap: 'Elastico mashqi – 30 kunlik challenge, 12-kun.', type: 'Skill', h: 240, views: 8300 },
    { a: kamol.id, st: bodomzor.id, cap: 'Raqib jamoaga gapim bor…', type: 'O‘yin lavhasi', h: 300, views: 900 },
  ];
  const reelRows = [];
  for (const [i, r] of reels.entries()) reelRows.push(await prisma.reel.create({ data: { authorId: r.a, stadiumId: r.st, caption: r.cap, type: r.type, bookCta: !!r.cta, status: 'published', views: r.views, ...reelVideo(`seed-${i}`, r.h), createdAt: hrs(i * 7 + 1) } }));
  for (const [i, u] of active.entries()) {
    await prisma.like.create({ data: { userId: u.id, reelId: reelRows[i % 4].id } });
    if (i % 2) await prisma.like.create({ data: { userId: u.id, reelId: reelRows[(i + 1) % 4].id } }).catch(() => undefined);
  }
  await prisma.comment.createMany({ data: [
    { userId: sardor.id, reelId: reelRows[0].id, text: 'Rabona! 😮' }, { userId: players.bek_t.id, reelId: reelRows[0].id, text: 'Payshanba kuni o‘rgatasan' },
    { userId: diyor.id, reelId: reelRows[1].id, text: 'Zo‘r zarba' }, { userId: kamol.id, reelId: reelRows[5].id, text: 'Ular hech narsa qila olmaydi, ****' },
  ] });
  await prisma.booking.updateMany({ where: { id: { in: [b2461.id, b2468.id] } }, data: { sourceReelId: reelRows[3].id } });

  console.log('· Shikoyatlar', new Date().toISOString().slice(11,19));
  // ---------- Shikoyatlar ----------
  const kamolReel = reelRows[5];
  const spam = await prisma.post.findFirstOrThrow({ where: { authorId: kamol.id } });
  const badComment = await prisma.comment.findFirstOrThrow({ where: { userId: kamol.id } });
  const rep = (reporter: string, targetType: 'post' | 'reel' | 'comment' | 'user', targetId: string, reason: string, text?: string) => prisma.report.create({ data: { reporterId: reporter, targetType, targetId, reason, text } });
  for (const u of active.slice(0, 4)) await rep(u.id, 'reel', kamolReel.id, 'Haqorat', 'Izohlarda raqib jamoaga nisbatan haqoratli so‘zlar bor.');
  for (const u of active.slice(0, 6)) await rep(u.id, 'post', spam.id, 'Spam / reklama', '«Eng arzon stadion – faqat bizda» degan bir xil post ko‘p joyda.');
  await prisma.post.update({ where: { id: spam.id }, data: { hidden: true } });
  await prisma.reel.update({ where: { id: kamolReel.id }, data: { hidden: true } });
  await rep(sardor.id, 'comment', badComment.id, 'Haqorat');
  await rep(players.bek_t.id, 'reel', reelRows[4].id, 'Mualliflik huquqi', 'Fonda litsenziyasiz musiqa ishlatilgan bo‘lishi mumkin.');

  console.log('· Chatlar', new Date().toISOString().slice(11,19));
  // ---------- Chatlar ----------
  const dm = async (a: string, b: string) => prisma.chat.create({ data: { type: 'dm', dmKey: [a, b].sort().join(':'), members: { create: [{ userId: a, lastReadAt: hrs(1) }, { userId: b, lastReadAt: new Date() }] } } });
  const msg = (chatId: string, senderId: string, minAgo: number, body = '', type: 'text' | 'photo' | 'match_invite' | 'stadium' | 'profile' | 'system' = 'text', extra: { refId?: string; mediaUrl?: string } = {}) =>
    prisma.message.create({ data: { chatId, senderId, body, type, ...extra, createdAt: new Date(Date.now() - minAgo * 60000) } });
  const c1 = await dm(sardor.id, diyor.id);
  await msg(c1.id, diyor.id, 30, 'Salom! Juma kuni bo‘sh ekansan – 5×5 ga bitta odam yetmayapti.');
  await msg(c1.id, diyor.id, 29, '', 'match_invite', { refId: m1.id });
  await msg(c1.id, sardor.id, 26, 'Ajoyib, men tayyorman. Qaysi maydon?');
  await msg(c1.id, diyor.id, 22, 'Qafas 2, ochiq. Qora futbolka olib kel');
  await msg(c1.id, diyor.id, 21, '', 'photo', { mediaUrl: postImage('chat1', 40) });
  await msg(c1.id, diyor.id, 20, '', 'stadium', { refId: cage.id });
  const c2 = await dm(sardor.id, players.akmal_r.id);
  await msg(c2.id, players.akmal_r.id, 60 * 26, 'Bugun yaxshi o‘ynading. O‘sha uzatma zo‘r edi.');
  await msg(c2.id, sardor.id, 60 * 25, 'Rahmat! Keyingi hafta yana');
  const c3 = await dm(sardor.id, players.jamshid_e.id);
  await msg(c3.id, players.jamshid_e.id, 60 * 50, '', 'profile', { refId: players.sherzod_q.id });
  await msg(c3.id, players.jamshid_e.id, 60 * 50 - 1, 'Shu darvozabonni taklif qilsak bo‘ladimi?');
  const lionsChat = lions.chats[0];
  await msg(lionsChat.id, players.islom_k.id, 60 * 30, 'Shanba kuni Anhor Indoorda o‘ynab ko‘ramizmi?');
  await msg(lionsChat.id, players.bek_t.id, 60 * 29, 'Men qarshi emasman, lekin narxi qimmatroq');
  await msg(m1.chatId, diyor.id, 120, 'Hammaga salom! Juma 21:00, Chilonzor Cage. 2 ta joy qoldi.');
  await msg(m1.chatId, players.jamshid_e.id, 100, 'Men maykalarni olib kelaman');
  await msg(m3.chatId, players.bek_t.id, 300, 'Payshanba hamma tayyormi?');
  const com = await prisma.chat.create({ data: { type: 'community', name: 'Toshkent Yakshanba Ligasi', members: { create: [sardor.id, diyor.id, players.akmal_r.id, players.bek_t.id, players.jamshid_e.id].map((userId) => ({ userId, lastReadAt: hrs(50) })) } } });
  await msg(com.id, players.akmal_r.id, 60 * 48, 'Qaysi jamoaga hujumchi kerak? Yakshanba bo‘shman.');
  await prisma.chat.create({ data: { type: 'community', name: 'Futzal Toshkent', members: { create: [diyor.id, players.jamshid_e.id].map((userId) => ({ userId })) } } });
  await prisma.chat.create({ data: { type: 'community', name: 'Darvozabonlar klubi', members: { create: [timur.id, players.sherzod_q.id].map((userId) => ({ userId })) } } });
  void m2; void m4; void chilFc; void oqtepa;

  console.log('· Taklif va bildirishnomalar', new Date().toISOString().slice(11,19));
  // ---------- Taklif va bildirishnomalar ----------
  const inv = await prisma.matchInvite.create({ data: { matchId: m1.id, fromId: diyor.id, toId: sardor.id } });
  const N = (userId: string, d: { type: string; kind: string; title: string; body?: string; actorId?: string; refType?: string; refId?: string; minAgo: number; read?: boolean; data?: object }) =>
    prisma.notification.create({ data: { userId, type: d.type, kind: d.kind, title: d.title, body: d.body, actorId: d.actorId, refType: d.refType, refId: d.refId, data: d.data as never, createdAt: new Date(Date.now() - d.minAgo * 60000), readAt: d.read ? new Date() : null } });
  await N(sardor.id, { type: 'invite', kind: 'match_invite', title: 'Diyor Mahmudov sizni «Juma oqshomi 5×5» o‘yiniga taklif qildi', body: `Chilonzor Cage · bugun ${String(Math.min(later + 1, 23)).padStart(2, '0')}:00`, actorId: diyor.id, refType: 'invite', refId: inv.id, minAgo: 12, data: { matchId: m1.id } });
  await N(sardor.id, { type: 'booking', kind: 'booking_confirmed', title: 'Arena Yunusobod bronni tasdiqladi', body: `Maydon B · ${addDays(today, 3).slice(8)}-sana, 20:00–21:00 · to‘lov stadionda`, refType: 'booking', refId: sardorB.id, minAgo: 60 });
  await N(sardor.id, { type: 'social', kind: 'follow', title: 'Jamshid Ergashev sizni kuzata boshladi', actorId: players.jamshid_e.id, refType: 'user', refId: players.jamshid_e.id, minAgo: 120 });
  await N(sardor.id, { type: 'social', kind: 'like', title: 'Akmal Rasulov va yana 4 kishi postingizni yoqtirdi', body: 'Chilonzor Cage da ajoyib o‘yin bo‘ldi. Hat-trick!', actorId: players.akmal_r.id, refType: 'post', refId: post3.id, minAgo: 180 });
  await N(sardor.id, { type: 'match', kind: 'match_result', title: 'Yakuniy hisob: Yunusobod Lions 3–2 Chilonzor FC. Siz MVP bo‘ldingiz', body: '1 gol · 1 assist', minAgo: 60 * 30, read: true });
  await N(sardor.id, { type: 'social', kind: 'achievement', title: 'Yutuq ochildi: Hat-trick qahramoni', body: 'Kam uchraydi', minAgo: 60 * 48, read: true });
  await N(sardor.id, { type: 'booking', kind: 'slot_alert', title: 'Anhor Indoor da siz izlagan vaqtga bo‘sh soat ochildi', body: 'Shanba 18:00 · 7×7', refType: 'stadium', refId: anhor.id, minAgo: 60 * 72, read: true });
  await N(sardor.id, { type: 'social', kind: 'comment', title: 'Akmal Rasulov postingizga izoh yozdi', body: '“Payshanba kuni buni menga o‘rgat”', actorId: players.akmal_r.id, refType: 'post', refId: post3.id, minAgo: 60 * 96, read: true });
  for (const b of [b2476, b2479, b2481]) await N(jasur.id, { type: 'booking', kind: 'booking_request', title: 'Yangi bron so‘rovi', body: b.code, refType: 'booking', refId: b.id, minAgo: 10 });
  await N(jasur.id, { type: 'social', kind: 'review', title: 'Dilshod Rahimov sharh qoldirdi · ★★★★★', body: 'Yoritish zo‘r, o‘t yangi.', actorId: players.dilshod_r.id, minAgo: 60 * 48, read: true });
  await N(admin.id, { type: 'system', kind: 'stadium_application', title: 'Yangi stadion arizasi: Sergeli Arena', refType: 'stadium', refId: sergeli.id, minAgo: 120 });

  console.log('· Jurnal', new Date().toISOString().slice(11,19));
  // ---------- Jurnal ----------
  const L = (actorId: string | null, action: string, text: string, minAgo: number) => prisma.auditLog.create({ data: { actorId, action, text, createdAt: new Date(Date.now() - minAgo * 60000) } });
  await L(null, 'stadium.create', 'Olmazor Futzal arizasini yubordi', 60 * 26);
  await L(mod2.id, 'dispute.resolve', 'FG-2431 nizosini egasi foydasiga yopdi', 60 * 6);
  await L(null, 'user.autoblock', '@kamol_y ni 3-marta kelmagani uchun 7 kunga blokladi', 60 * 3);
  await L(admin.id, 'stadium.update', 'Arena Yunusobod narx o‘zgarishini tasdiqladi', 60 * 2);
  await L(null, 'report.autohide', '@kamol_y postini 6 shikoyatdan keyin yashirdi', 70);
  await L(mod2.id, 'stadium.review', 'Chilonzor Sport arizasini tekshirishni boshladi', 30);

  console.log('· Erta kirish', new Date().toISOString().slice(11,19));
  // ---------- Erta kirish ----------
  await prisma.earlyAccess.createMany({ data: [{ role: 'player', phone: '+998901231111', district: 'Chilonzor' }, { role: 'owner', phone: '+998901232222', stadiumName: 'Bektemir Sport', district: 'Bektemir' }] });

  const counts = await Promise.all([prisma.user.count(), prisma.stadium.count(), prisma.booking.count(), prisma.match.count(), prisma.reel.count()]);
  console.log(`Seed tayyor: ${counts[0]} foydalanuvchi, ${counts[1]} stadion, ${counts[2]} bron, ${counts[3]} o‘yin, ${counts[4]} reel`);
  console.log('Hafta boshi:', mondayOf(today), '· bugun:', today);
}

main().then(async () => { await prisma.$disconnect(); process.exit(0); }).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
