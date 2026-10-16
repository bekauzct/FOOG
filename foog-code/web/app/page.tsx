'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import FoogMark from '@/components/FoogMark';
import { ThemeButton, useThemeState } from '@/components/TopBar';
import { Avatar, Btn, Icon } from '@/components/ui';
import { get, post } from '@/lib/api';
import { useSession } from '@/lib/session';
import { DISTRICTS, DOW, addDays, num, sum, todayStr, weekday, SKILL_LABEL, dec } from '@/lib/format';

type P = { id: string; name: string; username: string; avatarUrl: string | null; position: string | null; skill: string | null; district: string | null; distanceKm: number | null; matches: number; goals: number; rating: number; available: string[] };
type R = { id: string; posterUrl: string | null; caption: string; views: number; author: { username: string | null } };

const STEPS = [
  ['01', 'location_on', 'Qayerda o‘ynashni toping', 'Yaqin atrofdagi har bir maydon: bo‘sh soatlar, narxlar va haqiqiy sharhlar.'],
  ['02', 'group', 'Kim bilan o‘ynashni toping', 'O‘yinchilar, jamoalar va ochiq o‘yinlar – daraja, pozitsiya va vaqt bo‘yicha.'],
  ['03', 'event_available', 'Stadionni bron qiling', 'Soatni tanlang, so‘rov yuboring – stadion tasdiqlaydi. To‘lov stadionda.'],
  ['04', 'smart_display', 'Futbolingizni ulashing', 'Gollar, skill va natijalar profilingizga va shahar lentasiga.'],
  ['05', 'trending_up', 'O‘yinchi sifatida o‘sing', 'Har bir o‘yindan statistika, daraja va yutuqlar.'],
];
const OWNER = [
  ['event_available', 'Ko‘proq bron', 'Hozir o‘yin qidirayotgan futbolchilar maydoningizni ko‘radi – nafaqat doimiy mijozlar.'],
  ['storefront', 'To‘lov stadionda', 'Onlayn to‘lov yo‘q: mijoz o‘yin kuni to‘laydi, siz «Keldi» deb belgilaysiz. Kelmaganlar nazoratda.'],
  ['calendar_view_week', 'Bitta jadval', 'Har bir maydon va soatni bir joyda boshqaring, kerak bo‘lsa soatni yoping.'],
  ['monitoring', 'Peak soatlarni biling', 'Bandlik, daromad va talabni soatlar bo‘yicha ko‘ring – narxni aqlli belgilang.'],
];

function JoinForm({ role, setRole }: { role: 'player' | 'owner'; setRole: (r: 'player' | 'owner') => void }) {
  const [phone, setPhone] = useState('+998 ');
  const [district, setDistrict] = useState('');
  const [stadium, setStadium] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const valid = phone.replace(/\D/g, '').length >= 12;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return setErr('To‘liq telefon raqamini kiriting: +998 90 123 45 67');
    setBusy(true); setErr(null);
    try { await post('/early-access', { role, phone, district: district || undefined, stadiumName: role === 'owner' ? stadium || undefined : undefined }); setDone(true); } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };
  if (done) return (
    <div className="col" style={{ gap: 14, alignItems: 'flex-start' }}>
      <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary)', color: 'var(--on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n="check" size={30} /></span>
      <h3 style={{ fontSize: 24, fontWeight: 800 }}>Siz ro‘yxatdasiz</h3>
      <p className="c2" style={{ fontSize: 15 }}>{role === 'owner' ? 'Hamkorlar jamoasi siz bilan Telegram orqali bog‘lanadi. Hozir ham stadioningizni qo‘shishingiz mumkin.' : 'Telegram orqali kiring – profilingiz va asoschi o‘yinchi nishoni sizni kutmoqda.'}</p>
      <Link href={`/login${role === 'owner' ? '?role=owner&next=/owner/stadiums?new=1' : ''}`} className="btn btn-primary">{role === 'owner' ? 'Stadion qo‘shish' : 'Telegram orqali kirish'}<Icon n="arrow_forward" size={20} /></Link>
    </div>
  );
  return (
    <form onSubmit={submit} className="col" style={{ gap: 12 }}>
      <div className="seg" style={{ alignSelf: 'flex-start' }}>
        <button type="button" className={role === 'player' ? 'on' : ''} onClick={() => setRole('player')}>Futbolchiman</button>
        <button type="button" className={role === 'owner' ? 'on' : ''} onClick={() => setRole('owner')}>Stadionim bor</button>
      </div>
      <input className={`input ${err ? 'err' : ''}`} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Telefon raqam" placeholder="+998 90 123 45 67" />
      {role === 'owner' ? <input className="input" value={stadium} onChange={(e) => setStadium(e.target.value)} placeholder="Stadion nomi (masalan, Arena Yunusobod)" aria-label="Stadion nomi" /> : (
        <select className="select" value={district} onChange={(e) => setDistrict(e.target.value)} aria-label="Tuman"><option value="">Tumaningiz (masalan, Yunusobod)</option>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select>
      )}
      {err && <span role="alert" style={{ color: 'var(--error)', fontSize: 13 }}>{err}</span>}
      <Btn className="btn btn-primary btn-lg btn-block" loading={busy}>{role === 'owner' ? 'Stadioningizni qo‘shing' : 'Erta kirish'}</Btn>
      <span className="c3 t-cap">Spam yo‘q. Faqat Telegram orqali bitta xabar – kirish ochilganda.</span>
    </form>
  );
}

export default function Landing() {
  const { me, home } = useSession();
  const [theme] = useThemeState();
  const [stats, setStats] = useState<{ players: number; stadiums: number } | null>(null);
  const [players, setPlayers] = useState<P[]>([]);
  const [reels, setReels] = useState<R[]>([]);
  const [role, setRole] = useState<'player' | 'owner'>('player');
  const [demoT, setDemoT] = useState(3);
  useEffect(() => {
    get<{ players: number; stadiums: number }>('/early-access/stats').then(setStats).catch(() => undefined);
    get<{ items: P[] }>('/players').then((r) => setPlayers(r.items.filter((p) => p.matches).slice(0, 3))).catch(() => undefined);
    get<{ items: R[] }>('/reels').then((r) => setReels(r.items.slice(0, 3))).catch(() => undefined);
  }, []);
  const go = (id: string, r?: 'player' | 'owner') => { if (r) setRole(r); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };
  const T = ['17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00'], off = [1, 2, 6];
  const days = Array.from({ length: 7 }, (_, i) => addDays(todayStr(), i));
  const light = theme === 'light';
  return (
    <div className="ld">
      <header className="ld-nav">
        <Link href="/" style={{ width: 104, display: 'block' }} aria-label="FOOG"><FoogMark ink="var(--mark-ink)" primary="var(--mark-o)" accent="var(--mark-ink)" /></Link>
        <nav className="row hide-mobile" style={{ gap: 4 }}>
          {([['how', 'Qanday ishlaydi'], ['booking', 'Stadionlar'], ['players', 'O‘yinchilar'], ['owners', 'Egalar uchun']] as const).map(([id, l]) => <button key={id} className="btn btn-ghost btn-sm" style={{ color: 'var(--text-2)' }} onClick={() => go(id)}>{l}</button>)}
        </nav>
        <div className="row" style={{ gap: 8 }}>
          <ThemeButton />
          {me ? <Link href={home} className="btn btn-primary btn-sm">Kabinetga o‘tish</Link> : <><Link href="/login" className="btn btn-outline btn-sm hide-mobile">Kirish</Link><button className="btn btn-primary btn-sm" onClick={() => go('access')}>Erta kirish</button></>}
        </div>
      </header>

      <section className="ld-hero">
        <div className="ld-lines" aria-hidden="true"><span className="l1" /><span className="l2" /><span className="l3" /></div>
        <span className="pill-tag" style={{ boxShadow: 'inset 0 0 0 1px var(--border-strong)', color: 'var(--text-2)', height: 28 }}><span className="dot" style={{ color: 'var(--brand-ink)' }} />Toshkentda ishga tushmoqda · 2026</span>
        <div className="ld-mark"><FoogMark ink="var(--text-1)" primary={light ? 'oklch(0.6 0.21 262)' : 'var(--volt)'} accent={light ? 'var(--midnight)' : 'var(--text-1)'} /></div>
        <h1 className="t-display" style={{ textAlign: 'center' }}>O‘yna. Tanish. Bron qil. O‘s.</h1>
        <p className="c2" style={{ fontSize: 18, lineHeight: 1.5, maxWidth: 620, textAlign: 'center' }}>FOOG – hamma uchun futbol ekotizimi: maydon toping, o‘yinchilarni toping, bir necha soniyada bron qiling va o‘yinchi sifatida o‘z profilingizni bitta saytda yarating.</p>
        <div className="row wrap" style={{ gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-primary btn-lg" onClick={() => go('access', 'player')}>Erta kirish<Icon n="arrow_forward" size={20} /></button>
          <button className="btn btn-outline btn-lg" onClick={() => go('access', 'owner')}><Icon n="stadium" size={20} />Stadioningizni qo‘shing</button>
        </div>
        <span className="c3 t-small">{stats ? `${num(stats.players)} futbolchi va ${num(stats.stadiums)} stadion allaqachon ro‘yxatda` : ' '}</span>
      </section>

      <section id="how" className="ld-sec">
        <span className="label ink">FOOG qanday ishlaydi</span>
        <h2 className="t-h1" style={{ maxWidth: 640 }}>«Kim o‘ynaydi?» dan birinchi zarbagacha.</h2>
        <div className="ld-steps">
          {STEPS.map(([n, ic, t, d]) => (
            <div key={n} className="col" style={{ gap: 12, padding: 20, minHeight: 200 }}>
              <div className="row between"><span className="mono c3" style={{ fontSize: 12 }}>{n}</span><span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--brand-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n={ic} size={20} /></span></div>
              <b style={{ fontSize: 17, marginTop: 'auto' }}>{t}</b><span className="c2 t-small">{d}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ld-sec ld-split">
        <div className="col" style={{ gap: 16, justifyContent: 'center' }}>
          <span className="label ink">Mahsulot</span>
          <h2 className="t-h1">Butun futbol haftangiz – bitta lentada.</h2>
          <p className="c2" style={{ fontSize: 17, lineHeight: 1.55 }}>Jamoangizning natijalari, yaqin atrofdagi ochiq o‘yinlar, bugun kechqurun bo‘sh maydonlar va kuzatayotgan o‘yinchilaringiz – o‘ynash uchun qurilgan bitta lenta.</p>
          <div className="row wrap" style={{ gap: 10 }}><Link href={me ? home : '/login'} className="btn btn-inverse"><Icon n="language" size={20} />Saytni ochish</Link><Link href="/stadiums" className="btn btn-outline">Stadionlarni ko‘rish</Link></div>
        </div>
        <div className="ld-window">
          <div className="row" style={{ gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--border-strong)' }} />)}<span className="mono c3" style={{ fontSize: 11, marginLeft: 10 }}>foog.uz/home</span></div>
          <div className="col" style={{ gap: 12, padding: 18 }}>
            <b style={{ fontSize: 20 }}>Xayrli kech, Sardor.</b>
            <span className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}><Icon n="stadium" size={18} />Stadion bron qilish</span>
            <div className="well col" style={{ padding: 14, gap: 6 }}><span className="pill-tag volt" style={{ alignSelf: 'flex-start' }}>Yakuniy hisob</span><span className="mono" style={{ fontSize: 26 }}>3 – 2</span><span className="c2 t-cap">Yunusobod Lions · Chilonzor FC</span></div>
            <div className="row" style={{ gap: 10 }}><div className="ph" style={{ flex: 1, aspectRatio: '4/3', borderRadius: 12 }} /><div className="ph" style={{ flex: 1, aspectRatio: '4/3', borderRadius: 12 }} /></div>
          </div>
        </div>
      </section>

      <section id="booking" className="ld-sec ld-split">
        <div className="card col" style={{ padding: 20, gap: 14, alignSelf: 'center' }}>
          <div className="row between"><b style={{ fontSize: 18 }}>Arena Yunusobod</b><span><span className="mono" style={{ fontSize: 20 }}>{sum(300000)}</span><span className="c2 t-small"> /soat</span></span></div>
          <div className="sd-days">{days.map((d, i) => <span key={d} className={`sd-day ${i === 0 ? 'on' : ''}`}><span className="mono" style={{ fontSize: 10 }}>{DOW[weekday(d)].toUpperCase()}</span><span className="mono" style={{ fontSize: 18 }}>{Number(d.slice(8))}</span></span>)}</div>
          <div className="sd-times">{T.map((t, i) => <button key={t} disabled={off.includes(i)} className={`sd-time ${demoT === i ? 'on' : ''}`} onClick={() => setDemoT(i)}><span style={{ textDecoration: off.includes(i) ? 'line-through' : 'none' }}>{t}</span></button>)}</div>
          <Link href="/stadiums" className="btn btn-primary btn-block">Bronni tasdiqlash · {T[demoT]}</Link>
          <span className="row c2" style={{ gap: 6, justifyContent: 'center', fontSize: 13 }}><Icon n="storefront" size={16} style={{ color: 'var(--success)' }} />To‘lov stadionda</span>
        </div>
        <div className="col" style={{ gap: 16, justifyContent: 'center' }}>
          <span className="label ink">Stadion bron qilish</span>
          <h2 className="t-h1">Jonli soatlar. Uch bosish. Tayyor.</h2>
          <p className="c2" style={{ fontSize: 17, lineHeight: 1.55 }}>Yaqin atrofdagi har bir bo‘sh maydonni ko‘ring, soatni tanlang va so‘rov yuboring – stadion 2 soat ichida tasdiqlaydi. O‘yin kuni stadionda to‘laysiz.</p>
          {['Jonli bandlik, qo‘ng‘iroqlarsiz', 'Bir soatni ikki kishi bron qila olmaydi', 'Javob Telegram orqali keladi'].map((x) => <span key={x} className="row" style={{ gap: 10, fontSize: 15 }}><Icon n="check_circle" size={20} style={{ color: 'var(--success)' }} />{x}</span>)}
        </div>
      </section>

      <section id="players" className="ld-sec">
        <div className="row between wrap" style={{ gap: 20, alignItems: 'flex-end' }}>
          <div className="col" style={{ gap: 12 }}><span className="label ink">O‘yinchilar va jamoalar</span><h2 className="t-h1" style={{ maxWidth: 560 }}>Endi hech qachon bitta o‘yinchi yetishmaydi.</h2></div>
          <p className="c2" style={{ fontSize: 16, maxWidth: 400 }}>Pozitsiya, daraja va bo‘sh vaqt bo‘yicha filtrlang. Bir bosishda taklif qiling yoki ochiq o‘yinlar o‘zi to‘lsin.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
          {players.map((p) => (
            <Link key={p.id} href={`/u/${p.username}`} className="card col" style={{ padding: 18, gap: 12, color: 'var(--text-1)' }}>
              <div className="row" style={{ gap: 12 }}><Avatar name={p.name} url={p.avatarUrl} size={44} /><span className="col"><b>{p.name}</b><span className="c2 t-cap">{p.district}{p.distanceKm ? ` · ${dec(p.distanceKm)} km` : ''}</span></span></div>
              <div className="row" style={{ gap: 6 }}>{p.position && <span className="tag solid">{p.position}</span>}{p.skill && <span className="tag">{SKILL_LABEL[p.skill]}</span>}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>{([[p.matches, 'O‘yin'], [p.goals, 'Gol'], [dec(p.rating), 'Reyting']] as const).map(([v, l]) => <span key={l} className="col"><span className="mono" style={{ fontSize: 20 }}>{v}</span><span className="c2 t-cap">{l}</span></span>)}</div>
            </Link>
          ))}
          <Link href="/discover?tab=teams" className="card col" style={{ padding: 18, gap: 12, color: 'var(--text-1)', justifyContent: 'center', alignItems: 'flex-start' }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--inverse)', color: 'var(--on-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>YL</span>
            <b>Yunusobod Lions</b><span className="tag">GK kerak · Payshanba</span><span className="c2 t-small">Jamoalarni ko‘rish →</span>
          </Link>
        </div>
      </section>

      <section className="ld-sec ld-split">
        <div className="col" style={{ gap: 16, justifyContent: 'center' }}>
          <span className="label ink">Reels va hamjamiyat</span>
          <h2 className="t-h1">Futbolingizni ulashing. Profilingizni o‘stiring.</h2>
          <p className="c2" style={{ fontSize: 17, lineHeight: 1.55 }}>Gollar, skill va o‘yin lahzalari to‘g‘ridan-to‘g‘ri profilingizga, haqiqiy o‘yinlar statistikasiga bog‘langan holda. Jamoa, o‘yin va hamjamiyat chatlari hammani xabardor qiladi.</p>
          <div className="row" style={{ gap: 32 }}>{([['G‘', 'Gollar hisobi'], ['LVL', 'O‘yinchi darajasi'], ['MVP', 'Mukofotlar']] as const).map(([v, l]) => <span key={l} className="col"><span className="mono ink" style={{ fontSize: 28 }}>{v}</span><span className="c2 t-cap">{l}</span></span>)}</div>
        </div>
        <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
          {(reels.length ? reels : [null, null, null]).map((r, i) => (
            <Link key={r?.id ?? i} href={r ? `/reels?start=${r.id}` : '/reels'} style={{ flex: 1, aspectRatio: '9/16', borderRadius: 20, overflow: 'hidden', position: 'relative', marginTop: i === 1 ? 32 : 0, background: r?.posterUrl ? `center/cover url("${r.posterUrl}")` : 'var(--ph)', color: '#fff' }}>
              <span style={{ position: 'absolute', inset: 'auto 0 0 0', height: '50%', background: 'linear-gradient(to top, oklch(0.1 0.03 268 / .9), transparent)' }} />
              {r && <span className="row mono" style={{ position: 'absolute', top: 10, left: 10, gap: 4, fontSize: 11 }}><Icon n="play_arrow" fill size={14} />{num(r.views)}</span>}
              {r && <span style={{ position: 'absolute', left: 10, right: 10, bottom: 10, fontSize: 12, fontWeight: 600 }}>{r.caption.slice(0, 40)}</span>}
            </Link>
          ))}
        </div>
      </section>

      <section id="owners" className="ld-owners">
        <div className="ld-sec" style={{ paddingTop: 80, paddingBottom: 80 }}>
          <div className="row between wrap" style={{ gap: 20, alignItems: 'flex-end' }}>
            <div className="col" style={{ gap: 12 }}><span className="label" style={{ color: 'inherit', opacity: 0.7 }}>Stadion egalari uchun</span><h2 className="t-h1">Har bir bo‘sh soatni to‘ldiring.</h2></div>
            <p style={{ fontSize: 16, maxWidth: 440, opacity: 0.8 }}>FOOG maydonlaringizni o‘yin qidirayotgan minglab futbolchilarga ko‘rsatadi – bronlar, jadval va hisobot bir joyda. To‘lov – stadionda.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
            {OWNER.map(([ic, t, d]) => <div key={t} className="col" style={{ gap: 10, padding: 20, borderRadius: 20, boxShadow: 'inset 0 0 0 1px var(--ow-line)' }}><Icon n={ic} /><b style={{ fontSize: 16 }}>{t}</b><span style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.75 }}>{d}</span></div>)}
          </div>
          <div className="row wrap" style={{ gap: 16 }}>
            <button className="btn btn-primary btn-lg" onClick={() => go('access', 'owner')}><Icon n="stadium" size={20} />Stadioningizni qo‘shing</button>
            <span style={{ fontSize: 14, opacity: 0.75, alignSelf: 'center' }}>Erta kirish davrida bepul · dastlabki 6 oy 0% komissiya</span>
          </div>
        </div>
      </section>

      <section id="access" className="ld-sec">
        <div className="card ld-access">
          <div className="col" style={{ gap: 16, justifyContent: 'center' }}>
            <div style={{ width: 88 }}><FoogMark kind="symbol" ink="var(--text-1)" primary="var(--primary)" accent="var(--text-1)" /></div>
            <h2 className="t-h2" style={{ fontSize: 40, lineHeight: '44px', fontWeight: 800 }}>Birinchi hushtakdan oldin qo‘shiling.</h2>
            <p className="c2" style={{ fontSize: 16, lineHeight: 1.55 }}>Erta a’zolar «asoschi o‘yinchi» nishonini, beta davrida bepul imkoniyatlarni va nimani qurishimizda birinchi so‘zni oladi.</p>
          </div>
          <JoinForm role={role} setRole={setRole} />
        </div>
      </section>

      <footer className="ld-sec" style={{ paddingTop: 48, paddingBottom: 32, borderTop: '1px solid var(--border)' }}>
        <div className="row between wrap" style={{ gap: 32, alignItems: 'flex-start' }}>
          <div className="col" style={{ gap: 10 }}><div style={{ width: 104 }}><FoogMark ink="var(--mark-ink)" primary="var(--mark-o)" accent="var(--mark-ink)" /></div><span className="label-sm c3">Football Ecosystem for Everyone</span></div>
          <div className="row wrap" style={{ gap: 48 }}>
            {([['Mahsulot', [['Stadionlar', '/stadiums'], ['O‘yinlar', '/discover?tab=matches'], ['Reels', '/reels'], ['Profillar', '/discover']]], ['Hamkorlar', [['Stadioningizni qo‘shing', '/login?role=owner'], ['Klublar va ligalar', '/discover?tab=teams']]], ['Kompaniya', [['Telegram', 'https://t.me/foog_uz_bot'], ['Qo‘llab-quvvatlash', 'https://t.me/foog_support']]]] as const).map(([h, ls]) => (
              <div key={h} className="col" style={{ gap: 8 }}><span className="label-sm c3">{h}</span>{ls.map(([l, href]) => <Link key={l} href={href} className="c2" style={{ fontSize: 14, minHeight: 28 }}>{l}</Link>)}</div>
            ))}
          </div>
        </div>
        <div className="row between wrap c3" style={{ gap: 12, marginTop: 40, fontSize: 13 }}><span>© 2026 FOOG · Toshkent</span><span className="row" style={{ gap: 16 }}><span>Maxfiylik</span><span>Shartlar</span><a href="https://instagram.com" className="c3">Instagram</a><a href="https://t.me/foog_uz_bot" className="c3">Telegram</a></span></div>
      </footer>
    </div>
  );
}
