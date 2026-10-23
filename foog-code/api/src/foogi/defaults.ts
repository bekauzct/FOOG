// FOOGI boshlang‘ich bilimlari. Jadval bo‘sh bo‘lsa bir marta yoziladi – keyin admin panelda tahrirlanadi.
import type { FoogiAudience } from '@prisma/client';
import { prisma } from '../db';

type A = { title: string; q: string[]; k: string[]; a: string; pose: string; href?: string; label?: string; aud?: FoogiAudience };
const ANSWERS: A[] = [
  { title: 'Salomlashish', q: ['salom', 'assalomu alaykum', 'hello', 'qalaysan', 'privet'], k: ['salom', 'assalom', 'hi', 'privet'], a: 'Salom! Men FOOGI – FOOG’dagi yordamchingiz. Stadion, bron, jamoa, o‘yin yoki Reels – nimadan boshlaymiz?', pose: 'wave_hello' },
  { title: 'Stadion bron qilish', q: ['qanday bron qilaman', 'stadion bron qilish', 'maydonni band qilish', 'soat olish', 'bron qanday ishlaydi'], k: ['bron', 'band', 'stadion', 'maydon', 'soat'], a: 'Bron 3 qadam: stadionni tanlang → sana va bo‘sh soatni bosing → tasdiqlang. Stadion 2 soat ichida javob beradi, natija Telegram’ga keladi.', pose: 'schedule', href: '/stadiums', label: 'Stadionlar' },
  { title: 'Bronni bekor qilish', q: ['bronni bekor qilish', 'bronni qanday bekor qilaman', 'otmen qilish', 'bron kerak emas'], k: ['bekor', 'otmen', 'qaytarish'], a: '«Bronlarim» bo‘limida bronni oching va «Bekor qilish»ni bosing. O‘yindan oldinroq bekor qilsangiz, stadion boshqalarga bera oladi.', pose: 'ticket_cancelled', href: '/bookings', label: 'Bronlarim' },
  { title: 'Stadionda to‘lov', q: ['tolov qanday', 'qancha turadi', 'narxi qancha', 'pulni qayerga tolayman', 'click payme bormi'], k: ['tolov', 'pul', 'narx', 'click', 'payme', 'karta', 'som'], a: 'Stadion broni bepul – to‘lov o‘yin kuni stadionning o‘zida. Narxi har bir stadion kartasida soatiga ko‘rsatilgan.', pose: 'pay_at_stadium', href: '/stadiums', label: 'Narxlarni ko‘rish' },
  { title: 'Jamoa yaratish', q: ['jamoa yaratish', 'qanday jamoa ochaman', 'oz jamoam', 'kapitan bolish', 'jamoa tuzish'], k: ['jamoa', 'kapitan', 'komanda', 'team'], a: 'Yuqori menyudagi «Jamoam» bo‘limida jamoa yaratasiz. Jamoa ochish va oylik obuna to‘lovi karta orqali, chekni yuklaysiz – admin tekshirgach jamoa faollashadi.', pose: 'captain', href: '/team', label: 'Jamoam' },
  { title: 'Jamoaga qo‘shilish', q: ['jamoaga qanday qoshilaman', 'jamoaga kirish', 'jamoa topish'], k: ['qoshilish', 'jamoalar', 'azo'], a: '«Izlash» → «Jamoalar» bo‘limida jamoani tanlab «Qo‘shilish»ni bosing. Kapitan sizni taklif qilsa – bildirishnomada qabul qilasiz.', pose: 'team_trio', href: '/discover?tab=teams', label: 'Jamoalar' },
  { title: 'Ochiq o‘yinga qo‘shilish', q: ['oyinga qoshilish', 'ochiq oyin', 'bugun oyin bormi', 'kim oynaydi', 'odam yetishmayapti'], k: ['oyin', 'match', 'ochiq', 'qoshil'], a: '«Izlash» bo‘limida yaqin atrofdagi ochiq o‘yinlar. Bo‘sh joy bo‘lsa – bitta bosish bilan qo‘shilasiz. O‘zingiz ham o‘yin ochib, o‘yinchi chaqirishingiz mumkin.', pose: 'kick', href: '/discover', label: 'O‘yinlar' },
  { title: 'Reels', q: ['reels nima', 'video joylash', 'golimni qanday joylayman'], k: ['reels', 'video', 'gol', 'skill'], a: 'Golingiz, skillingiz yoki o‘yin lavhasini Reels’ga joylang – kuzatuvchilaringiz va jamoadoshlaringiz birinchi ko‘radi.', pose: 'reels_camera', href: '/reels', label: 'Reels' },
  { title: 'FOOG ID va profil', q: ['profil', 'foog id nima', 'statistikam', 'profilni tahrirlash'], k: ['profil', 'id', 'statistika', 'reyting'], a: 'FOOG ID – futbol pasportingiz: o‘yinlar, gollar, assistlar va yutuqlar bir joyda. Pozitsiya va tumanni to‘ldirsangiz, mos o‘yinlarni tezroq topaman.', pose: 'foog_id', href: '/profile', label: 'Profilim' },
  { title: 'Kirish / ro‘yxatdan o‘tish', q: ['qanday kiraman', 'royxatdan otish', 'login qilish', 'akkaunt ochish', 'parol'], k: ['kirish', 'login', 'royxat', 'akkaunt', 'parol', 'telegram'], a: 'Kirish Telegram orqali – parol kerak emas. «Kirish»ni bosing, botda raqamingizni ulashing va sayt avtomatik ochiladi.', pose: 'telegram_time', href: '/login', label: 'Kirish' },
  { title: 'Stadion egalari uchun', q: ['stadionimni qoshmoqchiman', 'men stadion egasiman', 'biznes panel', 'stadion qoshish'], k: ['egasi', 'owner', 'biznes', 'qoshish', 'hamkor'], a: 'Stadion egasimisiz? Stadioningizni qo‘shing – bronlar, jadval, xodimlar va daromad bitta panelda. Moderatsiyadan keyin stadion saytda chiqadi.', pose: 'stadium_owner', href: '/owner/stadiums', label: 'Stadionlarim' },
  { title: 'Xabarlar va chat', q: ['xabar yozish', 'chat qayerda', 'jamoa chati'], k: ['xabar', 'chat', 'yozish'], a: '«Xabarlar» bo‘limida shaxsiy, jamoa va o‘yin chatlari. «+» orqali o‘yin taklifi, stadion yoki o‘yinchi kartasini yuborasiz.', pose: 'typing', href: '/messages', label: 'Xabarlar' },
  { title: 'Bildirishnomalar', q: ['bildirishnoma', 'xabarnoma kelmayapti', 'telegramga xabar'], k: ['bildirishnoma', 'xabarnoma', 'notification'], a: 'Bron, taklif va javoblar saytda (qo‘ng‘iroqcha) va Telegram’da keladi. Telegram bot bilan bog‘langaningizni tekshiring.', pose: 'notification_bell', href: '/notifications', label: 'Bildirishnomalar' },
  { title: 'Internet yoki xato', q: ['sayt ishlamayapti', 'xato chiqdi', 'yuklanmayapti', 'internet yoq'], k: ['xato', 'ishlamayapti', 'internet', 'yuklanmayapti'], a: 'Avval internetni tekshirib, sahifani yangilang. Muammo qolsa – @foog_pro ga yozing, tezda yordam beramiz.', pose: 'no_connection' },
  { title: 'Aloqa', q: ['admin bilan boglanish', 'yordam kerak', 'shikoyat', 'qollab quvvatlash'], k: ['admin', 'yordam', 'aloqa', 'support', 'shikoyat'], a: 'FOOG jamoasi bilan Telegram’da bog‘laning: @foog_pro. Kontent haqida shikoyatni har bir post/reel menyusidan yuborsa bo‘ladi.', pose: 'phone_call' },
  { title: 'Rahmat', q: ['rahmat', 'zor', 'super', 'ajoyib', 'spasibo'], k: ['rahmat', 'zor', 'super', 'ajoyib', 'spasibo'], a: 'Arzimaydi! Maydonda ko‘rishguncha ⚽', pose: 'thumbs_up' },
];

type S = { page: string; target: string; title: string; text: string; pose: string; aud?: FoogiAudience };
// page = sahifa kaliti; 'site' – saytning to‘liq sayri (target = "/yo‘l#data-tour")
const TOUR: S[] = [
  // mehmon: landing
  { page: 'landing', target: 'hero', title: 'Salom, men FOOGI!', text: 'FOOG – Toshkentdagi futbol: stadion topish, bron, jamoa va o‘yinlar bitta joyda. Qisqa sayr qilamiz.', pose: 'wave_hello' },
  { page: 'landing', target: 'how', title: 'Qanday ishlaydi', text: 'O‘yinchi topasiz, maydonni bron qilasiz, o‘ynaysiz – natija profilingizda qoladi.', pose: 'present' },
  { page: 'landing', target: 'booking', title: 'Bron – uch bosish', text: 'Jonli bo‘sh soatlar. Bron bepul, to‘lov stadionda.', pose: 'schedule' },
  { page: 'landing', target: 'players', title: 'O‘yinchilar va jamoalar', text: 'Odam yetishmasa – ochiq o‘yinga qo‘shiling yoki jamoa tuzing.', pose: 'team_trio' },
  { page: 'landing', target: 'owners', title: 'Stadion egasimisiz?', text: 'Bronlar, jadval va daromad – bitta panelda.', pose: 'stadium_owner' },
  { page: 'landing', target: 'login', title: 'Endi kiring!', text: 'Telegram orqali 10 soniyada kirasiz – parol kerak emas. Keyin saytni to‘liq ko‘rsataman.', pose: 'ketdik', aud: 'guest' },
  // futbolchi: saytning to‘liq sayri
  { page: 'site', target: '/home#nav', title: 'Menyu', text: 'Asosiy, Stadionlar, Izlash, Reels, Jamoam va Xabarlar – hammasi shu yerda.', pose: 'present', aud: 'player' },
  { page: 'site', target: '/home#feed', title: 'Lenta', text: 'Kuzatganlaringizning gollari, natijalar va postlar.', pose: 'reels_camera', aud: 'player' },
  { page: 'site', target: '/stadiums#search', title: 'Stadion qidirish', text: 'Nomi yoki tumani bo‘yicha qidiring, sana va vaqtni tanlang.', pose: 'search', aud: 'player' },
  { page: 'site', target: '/stadiums#list', title: 'Stadionlar', text: 'Kartani bosing – bo‘sh soatlar, narx va sharhlar.', pose: 'find_stadium', aud: 'player' },
  { page: 'site', target: '/discover#tabs', title: 'Izlash', text: 'O‘yinchilar, jamoalar va ochiq o‘yinlar.', pose: 'kick', aud: 'player' },
  { page: 'site', target: '/team#team', title: 'Jamoam', text: 'Jamoa yarating, a’zolarni taklif qiling, obunani shu yerda boshqarasiz.', pose: 'captain', aud: 'player' },
  { page: 'site', target: '/reels#reels', title: 'Reels', text: 'Yuqoriga suring – keyingi video. Ikki marta bosing – like.', pose: 'reels_camera', aud: 'player' },
  { page: 'site', target: '/profile#profile', title: 'FOOG ID', text: 'Profilingiz: o‘yinlar, gollar va yutuqlar. Pozitsiyani to‘ldirishni unutmang.', pose: 'foog_id', aud: 'player' },
  { page: 'site', target: '/home#foogi', title: 'Men doim shu yerdaman', text: 'Savol bo‘lsa – meni bosing. Vaqti-vaqti bilan foydali takliflar beraman.', pose: 'goal_celebration', aud: 'player' },
  // stadion egasi: to‘liq sayr
  { page: 'site', target: '/owner#nav', title: 'Biznes panel', text: 'Bronlar, Jadval, Stadionlarim, Reels, Hisobot va Jamoam.', pose: 'stadium_owner', aud: 'owner' },
  { page: 'site', target: '/owner/bookings#list', title: 'Bronlar', text: 'So‘rovlarni 2 soat ichida tasdiqlang – aks holda avtomatik bekor bo‘ladi.', pose: 'booking_confirmed', aud: 'owner' },
  { page: 'site', target: '/owner/schedule#grid', title: 'Jadval', text: 'Haftalik jadval: bo‘sh va band soatlar, qo‘lda bron qo‘shish.', pose: 'calendar_schedule', aud: 'owner' },
  { page: 'site', target: '/owner/stadiums#list', title: 'Stadionlarim', text: 'Narx, rasm va qulayliklarni yangilang.', pose: 'stadium_builder', aud: 'owner' },
  { page: 'site', target: '/owner/reports#report', title: 'Hisobot', text: 'Daromad va bandlik statistikasi.', pose: 'income_chart', aud: 'owner' },
  // sahifa sayrlari
  { page: 'home', target: 'nav', title: 'Menyu', text: 'Asosiy bo‘limlar shu yerda.', pose: 'present' },
  { page: 'home', target: 'feed', title: 'Lenta', text: 'Postlar va natijalar.', pose: 'reels_camera' },
  { page: 'stadiums', target: 'search', title: 'Qidiruv', text: 'Stadion nomi yoki tumanni yozing.', pose: 'search' },
  { page: 'stadiums', target: 'filters', title: 'Filtrlar', text: 'Format, qoplama va narx bo‘yicha saralang.', pose: 'thinking' },
  { page: 'stadiums', target: 'list', title: 'Natijalar', text: 'Kartani bosing – bo‘sh soatlar va narx.', pose: 'find_stadium' },
  { page: 'stadium', target: 'slots', title: 'Soat tanlang', text: 'Bo‘sh soatni bosing, keyin maydonni tanlang. Bron bepul.', pose: 'schedule' },
  { page: 'discover', target: 'tabs', title: 'Izlash', text: 'O‘yinchilar, jamoalar va o‘yinlar.', pose: 'kick' },
  { page: 'team', target: 'team', title: 'Jamoam', text: 'Jamoa yaratish, obuna va a’zolar.', pose: 'captain' },
  { page: 'bookings', target: 'list', title: 'Bronlarim', text: 'Kelgusi va o‘tgan bronlar, bekor qilish.', pose: 'ticket_confirmed' },
  { page: 'messages', target: 'list', title: 'Suhbatlar', text: 'Shaxsiy, jamoa va o‘yin chatlari.', pose: 'typing' },
  { page: 'notifications', target: 'list', title: 'Bildirishnomalar', text: 'Takliflarni shu yerda qabul qiling.', pose: 'notification_bell' },
  { page: 'owner', target: 'nav', title: 'Bo‘limlar', text: 'Bronlar, Jadval, Stadionlarim va Hisobot.', pose: 'stadium_owner' },
  { page: 'admin', target: 'nav', title: 'Admin bo‘limlari', text: 'Moderatsiya, Jamoalar va FOOGI’ni o‘rgatish shu yerda.', pose: 'security_shield' },
];

type T = { title: string; text: string; pose: string; label?: string; href?: string; aud: FoogiAudience; page?: string };
const TIPS: T[] = [
  { title: 'Kirsangiz qulayroq', text: 'Kirgandan keyin bron qilasiz, o‘yinlarga qo‘shilasiz va jamoa tuzasiz. Telegram orqali – 10 soniya.', pose: 'telegram_time', label: 'Kirish', href: '/login', aud: 'guest' },
  { title: 'Bo‘sh soatlar jonli', text: 'Kirsangiz, bugungi bo‘sh soatlarni ko‘rib, darhol bron qilasiz.', pose: 'find_stadium', label: 'Kirish', href: '/login', aud: 'guest' },
  { title: 'Odam yetishmayaptimi?', text: 'FOOG’da ochiq o‘yinlar va o‘yinchilar bor. Kiring va birinchi o‘yiningizga qo‘shiling.', pose: 'team_trio', label: 'Kirish', href: '/login', aud: 'guest' },
  { title: 'Profilni to‘ldiring', text: 'Pozitsiya va tumanni yozsangiz, sizga mos o‘yinlarni tezroq topaman.', pose: 'profile_edit', label: 'Tahrirlash', href: '/profile/edit', aud: 'player' },
  { title: 'Jamoangiz bormi?', text: 'Jamoa tuzing – do‘stlarni taklif qiling va o‘yinlarga birga yoziling.', pose: 'captain', label: 'Jamoam', href: '/team', aud: 'player' },
  { title: 'Bugun o‘ynaymizmi?', text: 'Yaqin atrofda ochiq o‘yinlar bor – bo‘sh joy tugamasidan qo‘shiling.', pose: 'kick', label: 'O‘yinlar', href: '/discover', aud: 'player' },
  { title: 'Golingizni joylang', text: 'Eng zo‘r lahzangizni Reels’ga qo‘ying – kuzatuvchilar shu yerda.', pose: 'reels_camera', label: 'Reels', href: '/reels', aud: 'player' },
  { title: 'Bronlarni tez tasdiqlang', text: '2 soat ichida javob bermasangiz, so‘rov avtomatik bekor bo‘ladi.', pose: 'booking_confirmed', label: 'Bronlar', href: '/owner/bookings', aud: 'owner' },
  { title: 'Stadionga rasm qo‘shing', text: 'Rasmli stadionlar 2 baravar ko‘p bron oladi.', pose: 'share_photo', label: 'Stadionlarim', href: '/owner/stadiums', aud: 'owner' },
  { title: 'FOOGI’ni o‘rgating', text: 'Javobsiz savollar navbatini ko‘rib chiqing – har bir javob FOOGI’ni aqlliroq qiladi.', pose: 'thinking', label: 'FOOGI', href: '/admin/foogi', aud: 'admin' },
];

export async function ensureFoogiDefaults() {
  const [a, s, t] = await Promise.all([prisma.foogiAnswer.count(), prisma.foogiTourStep.count(), prisma.foogiTip.count()]);
  if (!a) await prisma.foogiAnswer.createMany({ data: ANSWERS.map((x) => ({ title: x.title, questions: x.q, keywords: x.k, answer: x.a, pose: x.pose, linkHref: x.href ?? null, linkLabel: x.label ?? null, audience: x.aud ?? 'all' })) });
  if (!s) await prisma.foogiTourStep.createMany({ data: TOUR.map((x, i) => ({ page: x.page, target: x.target, title: x.title, text: x.text, pose: x.pose, audience: x.aud ?? 'all', sort: i })) });
  if (!t) await prisma.foogiTip.createMany({ data: TIPS.map((x, i) => ({ title: x.title, text: x.text, pose: x.pose, ctaLabel: x.label ?? null, ctaHref: x.href ?? null, audience: x.aud, page: x.page ?? null, sort: i })) });
}
