'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import FoogMark from '@/components/FoogMark';
import { ThemeButton, useThemeState } from '@/components/TopBar';
import { Avatar, Btn, Icon } from '@/components/ui';
import { get, post } from '@/lib/api';
import { useSession } from '@/lib/session';
import { LangSwitch, useSum, useT } from '@/lib/i18n';
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
const SOCIAL = { telegram: 'https://t.me/foog_pro', instagram: 'https://instagram.com/foog_pro' };
const OWNER = [
  ['event_available', 'Ko‘proq bron', 'Hozir o‘yin qidirayotgan futbolchilar maydoningizni ko‘radi – nafaqat doimiy mijozlar.'],
  ['storefront', 'To‘lov stadionda', 'Onlayn to‘lov yo‘q: mijoz o‘yin kuni to‘laydi, siz «Keldi» deb belgilaysiz. Kelmaganlar nazoratda.'],
  ['calendar_view_week', 'Bitta jadval', 'Har bir maydon va soatni bir joyda boshqaring, kerak bo‘lsa soatni yoping.'],
  ['monitoring', 'Peak soatlarni biling', 'Bandlik, daromad va talabni soatlar bo‘yicha ko‘ring – narxni aqlli belgilang.'],
];

function JoinForm({ role, setRole }: { role: 'player' | 'owner'; setRole: (r: 'player' | 'owner') => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+998 ');
  const [telegram, setTelegram] = useState('');
  const [district, setDistrict] = useState('');
  const [stadium, setStadium] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const valid = phone.replace(/\D/g, '').length >= 12;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setErr(t('Ismingizni kiriting'));
    if (!valid) return setErr(t('To‘liq telefon raqamini kiriting: +998 90 123 45 67'));
    setBusy(true); setErr(null);
    try { await post('/early-access', { role, name: name.trim(), phone, telegram: telegram.trim() || undefined, district: district || undefined, stadiumName: role === 'owner' ? stadium || undefined : undefined }); setDone(true); } catch (e2) { setErr(t((e2 as Error).message)); } finally { setBusy(false); }
  };
  if (done) return (
    <div className="col" style={{ gap: 14, alignItems: 'flex-start' }}>
      <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary)', color: 'var(--on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n="check" size={30} /></span>
      <h3 style={{ fontSize: 24, fontWeight: 800 }}>{t('Siz ro‘yxatdasiz')}</h3>
      <p className="c2" style={{ fontSize: 15 }}>{role === 'owner' ? t('Hamkorlar jamoasi siz bilan Telegram yoki telefon orqali bog‘lanadi. Hozir ham stadioningizni qo‘shishingiz mumkin.') : t('Kirish ochilganda siz bilan Telegram yoki telefon orqali bog‘lanamiz. Hozir ham Telegram orqali kirib, profil yaratishingiz mumkin.')}</p>
      <Link href={`/login${role === 'owner' ? '?role=owner&next=/owner/stadiums?new=1' : ''}`} className="btn btn-primary">{role === 'owner' ? t('Stadion qo‘shish') : t('Telegram orqali kirish')}<Icon n="arrow_forward" size={20} /></Link>
    </div>
  );
  return (
    <form onSubmit={submit} className="col" style={{ gap: 12 }}>
      <div className="seg" style={{ alignSelf: 'flex-start' }}>
        <button type="button" className={role === 'player' ? 'on' : ''} onClick={() => setRole('player')}>{t('Futbolchiman')}</button>
        <button type="button" className={role === 'owner' ? 'on' : ''} onClick={() => setRole('owner')}>{t('Stadionim bor')}</button>
      </div>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-label={t('Ismingiz')} placeholder={t('Ismingiz')} maxLength={80} />
      <input className={`input ${err && !valid ? 'err' : ''}`} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label={t('Telefon raqam')} placeholder="+998 90 123 45 67" />
      <input className="input" value={telegram} onChange={(e) => setTelegram(e.target.value)} autoCapitalize="off" aria-label={t('Telegram username (ixtiyoriy)')} placeholder={t('Telegram: @username (ixtiyoriy)')} maxLength={33} />
      {role === 'owner' ? <input className="input" value={stadium} onChange={(e) => setStadium(e.target.value)} placeholder={t('Stadion nomi (masalan, Arena Yunusobod)')} aria-label={t('Stadion nomi')} /> : (
        <select className="select" value={district} onChange={(e) => setDistrict(e.target.value)} aria-label={t('Tuman')}><option value="">{t('Tumaningiz (masalan, Yunusobod)')}</option>{DISTRICTS.map((d) => <option key={d} value={d}>{t(d)}</option>)}</select>
      )}
      {err && <span role="alert" style={{ color: 'var(--error)', fontSize: 13 }}>{err}</span>}
      <Btn className="btn btn-primary btn-lg btn-block" loading={busy}>{role === 'owner' ? t('Stadioningizni qo‘shing') : t('Erta kirish')}</Btn>
      <span className="c3 t-cap">{t('Spam yo‘q. Kirish ochilganda Telegram yoki telefon orqali bir marta bog‘lanamiz.')}</span>
    </form>
  );
}

export default function Landing() {
  const { me, home } = useSession();
  const t = useT();
  const sumL = useSum();
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
          {([['how', 'Qanday ishlaydi'], ['booking', 'Stadionlar'], ['players', 'O‘yinchilar'], ['owners', 'Egalar uchun']] as const).map(([id, l]) => <button key={id} className="btn btn-ghost btn-sm" style={{ color: 'var(--text-2)' }} onClick={() => go(id)}>{t(l)}</button>)}
        </nav>
        <div className="row" style={{ gap: 8 }}>
          <LangSwitch />
          <ThemeButton />
          {me ? <Link href={home} className="btn btn-primary btn-sm">{t('Kabinetga o‘tish')}</Link> : <><Link href="/login" data-tour="login" className="btn btn-outline btn-sm hide-mobile">{t('Kirish')}</Link><button className="btn btn-primary btn-sm" onClick={() => go('access')}>{t('Erta kirish')}</button></>}
        </div>
      </header>

      <section className="ld-hero" data-tour="hero">
        <div className="ld-lines" aria-hidden="true"><span className="l1" /><span className="l2" /><span className="l3" /></div>
        <span className="pill-tag" style={{ boxShadow: 'inset 0 0 0 1px var(--border-strong)', color: 'var(--text-2)', height: 28 }}><span className="dot" style={{ color: 'var(--brand-ink)' }} />{t('Toshkentda ishga tushmoqda · 2026')}</span>
        <div className="ld-mark"><FoogMark ink="var(--text-1)" primary={light ? 'oklch(0.6 0.21 262)' : 'var(--volt)'} accent={light ? 'var(--midnight)' : 'var(--text-1)'} /></div>
        <h1 className="t-display" style={{ textAlign: 'center' }}>{t('O‘yna. Tanish. Bron qil. O‘s.')}</h1>
        <p className="c2" style={{ fontSize: 18, lineHeight: 1.5, maxWidth: 620, textAlign: 'center' }}>{t('FOOG – hamma uchun futbol ekotizimi: maydon toping, o‘yinchilarni toping, bir necha soniyada bron qiling va o‘yinchi sifatida o‘z profilingizni bitta saytda yarating.')}</p>
        <div className="row wrap" style={{ gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-primary btn-lg" onClick={() => go('access', 'player')}>{t('Erta kirish')}<Icon n="arrow_forward" size={20} /></button>
          <button className="btn btn-outline btn-lg" onClick={() => go('access', 'owner')}><Icon n="stadium" size={20} />{t('Stadioningizni qo‘shing')}</button>
        </div>
        <span className="c3 t-small">{stats ? t('{p} futbolchi va {s} stadion allaqachon ro‘yxatda', { p: num(stats.players), s: num(stats.stadiums) }) : ' '}</span>
      </section>

      <section id="how" className="ld-sec" data-tour="how">
        <span className="label ink">{t('FOOG qanday ishlaydi')}</span>
        <h2 className="t-h1" style={{ maxWidth: 640 }}>{t('«Kim o‘ynaydi?» dan birinchi zarbagacha.')}</h2>
        <div className="ld-steps">
          {STEPS.map(([n, ic, title, d]) => (
            <div key={n} className="col" style={{ gap: 12, padding: 20, minHeight: 200 }}>
              <div className="row between"><span className="mono c3" style={{ fontSize: 12 }}>{n}</span><span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--brand-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n={ic} size={20} /></span></div>
              <b style={{ fontSize: 17, marginTop: 'auto' }}>{t(title)}</b><span className="c2 t-small">{t(d)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ld-sec ld-split">
        <div className="col" style={{ gap: 16, justifyContent: 'center' }}>
          <span className="label ink">{t('Mahsulot')}</span>
          <h2 className="t-h1">{t('Butun futbol haftangiz – bitta lentada.')}</h2>
          <p className="c2" style={{ fontSize: 17, lineHeight: 1.55 }}>{t('Jamoangizning natijalari, yaqin atrofdagi ochiq o‘yinlar, bugun kechqurun bo‘sh maydonlar va kuzatayotgan o‘yinchilaringiz – o‘ynash uchun qurilgan bitta lenta.')}</p>
          <div className="row wrap" style={{ gap: 10 }}><Link href={me ? home : '/login'} className="btn btn-inverse"><Icon n="language" size={20} />{t('Saytni ochish')}</Link><Link href="/stadiums" className="btn btn-outline">{t('Stadionlarni ko‘rish')}</Link></div>
        </div>
        <div className="ld-window">
          <div className="row" style={{ gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--border-strong)' }} />)}<span className="mono c3" style={{ fontSize: 11, marginLeft: 10 }}>foog.uz/home</span></div>
          <div className="col" style={{ gap: 12, padding: 18 }}>
            <b style={{ fontSize: 20 }}>{t('Xayrli kech, Sardor.')}</b>
            <span className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}><Icon n="stadium" size={18} />{t('Stadion bron qilish')}</span>
            <div className="well col" style={{ padding: 14, gap: 6 }}><span className="pill-tag volt" style={{ alignSelf: 'flex-start' }}>{t('Yakuniy hisob')}</span><span className="mono" style={{ fontSize: 26 }}>3 – 2</span><span className="c2 t-cap">Yunusobod Lions · Chilonzor FC</span></div>
            <div className="row" style={{ gap: 10 }}><div className="ph" style={{ flex: 1, aspectRatio: '4/3', borderRadius: 12 }} /><div className="ph" style={{ flex: 1, aspectRatio: '4/3', borderRadius: 12 }} /></div>
          </div>
        </div>
      </section>

      <section id="booking" className="ld-sec ld-split" data-tour="booking">
        <div className="card col" style={{ padding: 20, gap: 14, alignSelf: 'center' }}>
          <div className="row between"><b style={{ fontSize: 18 }}>Arena Yunusobod</b><span><span className="mono" style={{ fontSize: 20 }}>{sumL(sum(300000))}</span><span className="c2 t-small"> {t('/soat')}</span></span></div>
          <div className="sd-days">{days.map((d, i) => <span key={d} className={`sd-day ${i === 0 ? 'on' : ''}`}><span className="mono" style={{ fontSize: 10 }}>{t(DOW[weekday(d)]).toUpperCase()}</span><span className="mono" style={{ fontSize: 18 }}>{Number(d.slice(8))}</span></span>)}</div>
          <div className="sd-times">{T.map((t, i) => <button key={t} disabled={off.includes(i)} className={`sd-time ${demoT === i ? 'on' : ''}`} onClick={() => setDemoT(i)}><span style={{ textDecoration: off.includes(i) ? 'line-through' : 'none' }}>{t}</span></button>)}</div>
          <Link href="/stadiums" className="btn btn-primary btn-block">{t('Bronni tasdiqlash')} · {T[demoT]}</Link>
          <span className="row c2" style={{ gap: 6, justifyContent: 'center', fontSize: 13 }}><Icon n="storefront" size={16} style={{ color: 'var(--success)' }} />{t('To‘lov stadionda')}</span>
        </div>
        <div className="col" style={{ gap: 16, justifyContent: 'center' }}>
          <span className="label ink">{t('Stadion bron qilish')}</span>
          <h2 className="t-h1">{t('Jonli soatlar. Uch bosish. Tayyor.')}</h2>
          <p className="c2" style={{ fontSize: 17, lineHeight: 1.55 }}>{t('Yaqin atrofdagi har bir bo‘sh maydonni ko‘ring, soatni tanlang va so‘rov yuboring – stadion 2 soat ichida tasdiqlaydi. O‘yin kuni stadionda to‘laysiz.')}</p>
          {['Jonli bandlik, qo‘ng‘iroqlarsiz', 'Bir soatni ikki kishi bron qila olmaydi', 'Javob Telegram orqali keladi'].map((x) => <span key={x} className="row" style={{ gap: 10, fontSize: 15 }}><Icon n="check_circle" size={20} style={{ color: 'var(--success)' }} />{t(x)}</span>)}
        </div>
      </section>

      <section id="players" className="ld-sec" data-tour="players">
        <div className="row between wrap" style={{ gap: 20, alignItems: 'flex-end' }}>
          <div className="col" style={{ gap: 12 }}><span className="label ink">{t('O‘yinchilar va jamoalar')}</span><h2 className="t-h1" style={{ maxWidth: 560 }}>{t('Endi hech qachon bitta o‘yinchi yetishmaydi.')}</h2></div>
          <p className="c2" style={{ fontSize: 16, maxWidth: 400 }}>{t('Pozitsiya, daraja va bo‘sh vaqt bo‘yicha filtrlang. Bir bosishda taklif qiling yoki ochiq o‘yinlar o‘zi to‘lsin.')}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
          {players.map((p) => (
            <Link key={p.id} href={`/u/${p.username}`} className="card col" style={{ padding: 18, gap: 12, color: 'var(--text-1)' }}>
              <div className="row" style={{ gap: 12 }}><Avatar name={p.name} url={p.avatarUrl} size={44} /><span className="col"><b>{p.name}</b><span className="c2 t-cap">{p.district}{p.distanceKm ? ` · ${dec(p.distanceKm)} km` : ''}</span></span></div>
              <div className="row" style={{ gap: 6 }}>{p.position && <span className="tag solid">{p.position}</span>}{p.skill && <span className="tag">{t(SKILL_LABEL[p.skill])}</span>}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>{([[p.matches, 'O‘yin'], [p.goals, 'Gol'], [dec(p.rating), 'Reyting']] as const).map(([v, l]) => <span key={l} className="col"><span className="mono" style={{ fontSize: 20 }}>{v}</span><span className="c2 t-cap">{t(l)}</span></span>)}</div>
            </Link>
          ))}
          <Link href="/discover?tab=teams" className="card col" style={{ padding: 18, gap: 12, color: 'var(--text-1)', justifyContent: 'center', alignItems: 'flex-start' }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--inverse)', color: 'var(--on-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>YL</span>
            <b>Yunusobod Lions</b><span className="tag">{t('GK kerak · Payshanba')}</span><span className="c2 t-small">{t('Jamoalarni ko‘rish')} →</span>
          </Link>
        </div>
      </section>

      <section className="ld-sec ld-split">
        <div className="col" style={{ gap: 16, justifyContent: 'center' }}>
          <span className="label ink">{t('Reels va hamjamiyat')}</span>
          <h2 className="t-h1">{t('Futbolingizni ulashing. Profilingizni o‘stiring.')}</h2>
          <p className="c2" style={{ fontSize: 17, lineHeight: 1.55 }}>{t('Gollar, skill va o‘yin lahzalari to‘g‘ridan-to‘g‘ri profilingizga, haqiqiy o‘yinlar statistikasiga bog‘langan holda. Jamoa, o‘yin va hamjamiyat chatlari hammani xabardor qiladi.')}</p>
          <div className="row" style={{ gap: 32 }}>{([['G‘', 'Gollar hisobi'], ['LVL', 'O‘yinchi darajasi'], ['MVP', 'Mukofotlar']] as const).map(([v, l]) => <span key={l} className="col"><span className="mono ink" style={{ fontSize: 28 }}>{v}</span><span className="c2 t-cap">{t(l)}</span></span>)}</div>
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

      <section id="owners" className="ld-owners" data-tour="owners">
        <div className="ld-sec" style={{ paddingTop: 80, paddingBottom: 80 }}>
          <div className="row between wrap" style={{ gap: 20, alignItems: 'flex-end' }}>
            <div className="col" style={{ gap: 12 }}><span className="label" style={{ color: 'inherit', opacity: 0.7 }}>{t('Stadion egalari uchun')}</span><h2 className="t-h1">{t('Har bir bo‘sh soatni to‘ldiring.')}</h2></div>
            <p style={{ fontSize: 16, maxWidth: 440, opacity: 0.8 }}>{t('FOOG maydonlaringizni o‘yin qidirayotgan minglab futbolchilarga ko‘rsatadi – bronlar, jadval va hisobot bir joyda. To‘lov – stadionda.')}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
            {OWNER.map(([ic, title, d]) => <div key={title} className="col" style={{ gap: 10, padding: 20, borderRadius: 20, boxShadow: 'inset 0 0 0 1px var(--ow-line)' }}><Icon n={ic} /><b style={{ fontSize: 16 }}>{t(title)}</b><span style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.75 }}>{t(d)}</span></div>)}
          </div>
          <div className="row wrap" style={{ gap: 16 }}>
            <button className="btn btn-primary btn-lg" onClick={() => go('access', 'owner')}><Icon n="stadium" size={20} />{t('Stadioningizni qo‘shing')}</button>
            <span style={{ fontSize: 14, opacity: 0.75, alignSelf: 'center' }}>{t('Erta kirish davrida bepul · dastlabki 6 oy 0% komissiya')}</span>
          </div>
        </div>
      </section>

      <section id="access" className="ld-sec">
        <div className="card ld-access">
          <div className="col" style={{ gap: 16, justifyContent: 'center' }}>
            <div style={{ width: 88 }}><FoogMark kind="symbol" ink="var(--text-1)" primary="var(--primary)" accent="var(--text-1)" /></div>
            <h2 className="t-h2" style={{ fontSize: 'clamp(28px, 8.5vw, 40px)', lineHeight: 1.1, fontWeight: 800, hyphens: 'auto', overflowWrap: 'break-word' }}>{t('Birinchi hushtakdan oldin qo‘shiling.')}</h2>
            <p className="c2" style={{ fontSize: 16, lineHeight: 1.55 }}>{t('Erta a’zolar «asoschi o‘yinchi» nishonini, beta davrida bepul imkoniyatlarni va nimani qurishimizda birinchi so‘zni oladi.')}</p>
          </div>
          <JoinForm role={role} setRole={setRole} />
        </div>
      </section>

      <footer className="ld-sec" style={{ paddingTop: 48, paddingBottom: 32, borderTop: '1px solid var(--border)' }}>
        <div className="row between wrap" style={{ gap: 32, alignItems: 'flex-start' }}>
          <div className="col" style={{ gap: 10 }}><div style={{ width: 104 }}><FoogMark ink="var(--mark-ink)" primary="var(--mark-o)" accent="var(--mark-ink)" /></div><span className="label-sm c3">{t('Hamma uchun futbol ekotizimi')}</span></div>
          <div className="row wrap" style={{ gap: 48 }}>
            {([['Mahsulot', [['Stadionlar', '/stadiums'], ['O‘yinlar', '/discover?tab=matches'], ['Reels', '/reels'], ['Profillar', '/discover']]], ['Hamkorlar', [['Stadioningizni qo‘shing', '/login?role=owner'], ['Klublar va ligalar', '/discover?tab=teams']]], ['Kompaniya', [['Telegram', SOCIAL.telegram], ['Instagram', SOCIAL.instagram]]]] as const).map(([h, ls]) => (
              <div key={h} className="col" style={{ gap: 8 }}><span className="label-sm c3">{t(h)}</span>{ls.map(([l, href]) => <Link key={l} href={href} className="c2" style={{ fontSize: 14, minHeight: 28 }} {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{t(l)}</Link>)}</div>
            ))}
          </div>
        </div>
        <div className="row between wrap c3" style={{ gap: 12, marginTop: 40, fontSize: 13, alignItems: 'center' }}>
          <span>© 2026 FOOG · {t('Toshkent')}</span>
          <span className="row" style={{ gap: 8 }}>
            <a href={SOCIAL.telegram} target="_blank" rel="noopener noreferrer" className="icon-btn ghost" aria-label="Telegram @foog_pro" title="Telegram @foog_pro"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.2-8.3c.4-.4-.1-.6-.6-.2L6.2 13 1.4 11.5c-1-.3-1-1 .2-1.5L20.6 2.8c.9-.3 1.6.2 1.3 1.5Z" /></svg></a>
            <a href={SOCIAL.instagram} target="_blank" rel="noopener noreferrer" className="icon-btn ghost" aria-label="Instagram @foog_pro" title="Instagram @foog_pro"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1.1-1.7.2-2.1.4-.5.2-.9.4-1.3.8-.4.4-.6.8-.8 1.3-.2.4-.3 1-.4 2.1C2.6 9.9 2.6 10.3 2.6 12s0 3.5.1 4.7c.1 1.1.2 1.7.4 2.1.2.5.4.9.8 1.3.4.4.8.6 1.3.8.4.2 1 .3 2.1.4 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.9-.4 1.3-.8.4-.4.6-.8.8-1.3.2-.4.3-1 .4-2.1.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c-.1-1.1-.2-1.7-.4-2.1-.2-.5-.4-.9-.8-1.3-.4-.4-.8-.6-1.3-.8-.4-.2-1-.3-2.1-.4C15.5 4 15.1 4 12 4Zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 8a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2Zm5.1-9.4a1.1 1.1 0 1 1 0 2.3 1.1 1.1 0 0 1 0-2.3Z" /></svg></a>
          </span>
        </div>
      </footer>
    </div>
  );
}
