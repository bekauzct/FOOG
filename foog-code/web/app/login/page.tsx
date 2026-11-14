'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import FoogMark from '@/components/FoogMark';
import { ThemeButton } from '@/components/TopBar';
import { Btn, Icon } from '@/components/ui';
import { api, ApiError, post } from '@/lib/api';
import { LangSwitch, useT } from '@/lib/i18n';

type Start = { token: string; url: string; expiresIn: number; devShare: boolean };
type Status = { status: 'pending' } | { status: 'need_role'; name: string; next?: string } | { status: 'done'; redirect: string; next?: string };
// Telefonda Telegram’ga o‘tganda brauzer sahifani yopishi mumkin – kutilayotgan kirish shu yerda saqlanadi
type Saved = { token: string; url: string; exp: number; next: string | null };
const SAVE_KEY = 'foog-login';
const loadSaved = (): Saved | null => { try { const v = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') as Saved | null; return v && v.exp > Date.now() ? v : null; } catch { return null; } };
const save = (v: Saved | null) => { try { if (v) localStorage.setItem(SAVE_KEY, JSON.stringify(v)); else localStorage.removeItem(SAVE_KEY); } catch { /* yopiq */ } };

function LoginInner() {
  const sp = useSearchParams();
  const t = useT();
  const [next, setNext] = useState<string | null>(sp.get('next'));
  const [start, setStart] = useState<Start | null>(null);
  const [state, setState] = useState<'idle' | 'starting' | 'waiting' | 'role' | 'done' | 'expired'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [role, setRole] = useState<'player' | 'owner'>(sp.get('role') === 'owner' ? 'owner' : 'player');
  const [name, setName] = useState('');
  const [devPhone, setDevPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>();
  const devAllowed = process.env.NEXT_PUBLIC_DEV_LOGIN === 'true' && start?.devShare;

  const go = (r: string, serverNext?: string | null) => {
    setState('done');
    save(null);
    const n = next ?? serverNext ?? null;
    // /obyektivka – alohida ilova, har qanday rol kira oladi
    const shared = !!n && n.startsWith('/obyektivka/');
    location.href = n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/login') && (shared || (r === '/home' ? !n.startsWith('/owner') && !n.startsWith('/admin') : n.startsWith(r))) ? n : r;
  };

  // Kirish havolasini oldindan tayyorlaymiz: tugma haqiqiy havola bo‘ladi va telefonda Telegram to‘g‘ridan-to‘g‘ri ochiladi
  // (bosilgandan keyin server javobini kutib window.open qilinsa, telefon brauzeri uni bloklaydi yoki yangi tabda ochadi)
  const prepare = async () => {
    setErr(null);
    setState('starting');
    try {
      const s = await post<Start>('/auth/telegram', { next });
      setStart(s);
      setLeft(s.expiresIn);
      setState('idle');
    } catch (e) {
      setErr((e as Error).message);
      setState('idle');
    }
  };
  const begin = () => {
    if (!start) return;
    save({ token: start.token, url: start.url, exp: Date.now() + left * 1000, next });
    setState('waiting');
  };

  // Ochilishda: bot havolasidan (?t=) yoki saqlangan kutilayotgan kirishdan davom etamiz, aks holda yangi havola tayyorlaymiz
  useEffect(() => {
    const t = sp.get('t');
    const saved = loadSaved();
    if (t) { setStart({ token: t, url: saved?.token === t ? saved.url : '', expiresIn: 180, devShare: false }); setLeft(180); setState('waiting'); return; }
    if (saved) { setStart({ token: saved.token, url: saved.url, expiresIn: Math.round((saved.exp - Date.now()) / 1000), devShare: false }); setLeft(Math.round((saved.exp - Date.now()) / 1000)); if (!next && saved.next) setNext(saved.next); setState('waiting'); return; }
    void prepare();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Kutilmagan holat: havola muddati tugasa (bosilmagan bo‘lsa) – jimgina yangilaymiz
  useEffect(() => {
    if (state === 'idle' && start && left <= 5) void prepare();
  }, [left, state]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (state !== 'idle' || !start) return;
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(id);
  }, [state, start?.token]);

  // Bot javobini kutish: har 2 soniyada holatni so‘raymiz
  useEffect(() => {
    if (state !== 'waiting' || !start) return;
    let stop = false;
    const check = async () => {
      if (stop) return;
      try {
        const r = await api<Status>(`/auth/telegram/${start.token}`);
        if (r.status === 'done') { stop = true; go(r.redirect, r.next); }
        if (r.status === 'need_role') { stop = true; if (!next && r.next) setNext(r.next); setName(r.name); setState('role'); }
      } catch (e) {
        if (e instanceof ApiError && e.status === 410) {
          stop = true; save(null);
          // Boshqa oynada (masalan bot havolasi orqali) kirib bo‘lingan bo‘lishi mumkin
          try { const me = await api<{ home: string }>('/auth/me'); go(me.home); } catch { setState('expired'); void prepare(); }
        }
        if (e instanceof ApiError && e.code === 'blocked') { stop = true; save(null); setErr(e.message); setState('idle'); void prepare(); }
      }
    };
    void check();
    const poll = setInterval(check, 2000);
    // Telegram’dan qaytganda kutmasdan darhol tekshiramiz
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisible);
    timer.current = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => { stop = true; clearInterval(poll); clearInterval(timer.current); document.removeEventListener('visibilitychange', onVisible); };
  }, [state, start?.token]);

  const complete = async () => {
    if (!start) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await post<{ redirect: string; next?: string }>(`/auth/telegram/${start.token}/complete`, { role, name: name.trim() });
      go(r.redirect, r.next);
    } catch (e) {
      setErr((e as Error).message);
      if (e instanceof ApiError && e.status === 410) setState('expired');
    } finally {
      setBusy(false);
    }
  };

  const devShare = async () => {
    if (!start) return;
    setBusy(true);
    try { await post(`/auth/telegram/${start.token}/dev-share`, { phone: devPhone }); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="row between" style={{ padding: '14px 16px' }}>
        <Link href="/" style={{ width: 104, display: 'block', minHeight: 44, paddingTop: 10 }} aria-label="FOOG"><FoogMark ink="var(--mark-ink)" primary="var(--mark-o)" accent="var(--mark-ink)" /></Link>
        <span className="row" style={{ gap: 8 }}><LangSwitch /><ThemeButton /></span>
      </header>
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px 64px' }}>
        <div className="card" style={{ width: '100%', maxWidth: 440, padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ width: 72 }}><FoogMark kind="symbol" ink="var(--mark-ink)" primary="var(--primary)" accent="var(--mark-ink)" /></div>
          {state !== 'role' ? (
            <>
              <div className="col" style={{ gap: 8 }}>
                <h1 style={{ fontSize: 28, lineHeight: '34px', fontWeight: 800, letterSpacing: '-.02em' }}>{t('FOOG ga kirish')}</h1>
                {next?.startsWith('/obyektivka/') && <p className="c2" style={{ fontSize: 15, lineHeight: 1.5 }}>{t('Obyektivkadan foydalanish uchun Telegram orqali kiring – tasdiqlash xabari botga keladi.')}</p>}
                <p className="c2" style={{ fontSize: 15, lineHeight: 1.5 }}>{t('Parol kerak emas. Telegram botda raqamingizni ulashing – sayt sizni avtomatik tanib oladi.')}</p>
              </div>
              {state === 'waiting' ? (
                <div className="well col" style={{ padding: 16, gap: 12 }}>
                  <div className="row" style={{ gap: 10 }}><span className="spin" style={{ color: 'var(--accent)' }} /><b style={{ fontSize: 15 }}>{t('Telegram botda raqamingizni ulashing')}</b></div>
                  <ol className="c2" style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7 }}>
                    <li>{t('Bot ochildi:')} <b>«Start»</b> {t('ni bosing')}</li>
                    <li><b>{t('«Raqamni ulashish»')}</b> {t('tugmasini bosing')}</li>
                    <li>{t('Shu sahifaga qayting – kirish davom etadi')}</li>
                  </ol>
                  <div className="row between t-small">{start?.url ? <a href={start.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>{t('Botni qayta ochish')}</a> : <span />}<span className="mono c3">{mm}</span></div>
                </div>
              ) : state === 'expired' ? (
                <div className="well row" style={{ padding: 14, gap: 10, color: 'var(--warning)' }}><Icon n="timer_off" /><span style={{ fontSize: 14 }}>{t('Havola muddati tugadi (3 daqiqa). Qaytadan urinib ko‘ring.')}</span></div>
              ) : null}
              {state !== 'waiting' && (start && state !== 'starting' ? (
                // Haqiqiy havola: bosish = foydalanuvchi harakati, telefonda Telegram ilovasi darhol ochiladi
                <a href={start.url} target="_blank" rel="noopener noreferrer" className="btn btn-lg btn-block" style={{ background: '#2AABEE', color: '#fff' }} onClick={begin} role="button">
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.2-8.3c.4-.4-.1-.6-.6-.2L6.2 13 1.4 11.5c-1-.3-1-1 .2-1.5L20.6 2.8c.9-.3 1.6.2 1.3 1.5Z" /></svg>
                  {t('Telegram orqali kirish')}
                </a>
              ) : (
                <Btn className="btn btn-lg btn-block" style={{ background: '#2AABEE', color: '#fff' }} loading disabled>{t('Telegram orqali kirish')}</Btn>
              ))}
              {devAllowed && state === 'waiting' && (
                <div className="col" style={{ gap: 8, padding: 14, borderRadius: 14, boxShadow: 'inset 0 0 0 1px var(--border-strong)' }}>
                  <span className="label-sm">{t('Sinov rejimi · botsiz')}</span>
                  <div className="row" style={{ gap: 8 }}>
                    <input className="input" inputMode="tel" placeholder="+998 90 111 22 33" value={devPhone} onChange={(e) => setDevPhone(e.target.value)} aria-label={t('Telefon raqam')} />
                    <Btn className="btn btn-outline" onClick={devShare} loading={busy} disabled={devPhone.replace(/\D/g, '').length < 9}>{t('Ulashish')}</Btn>
                  </div>
                </div>
              )}
              {err && <div role="alert" className="row" style={{ gap: 8, color: 'var(--error)', fontSize: 14 }}><Icon n="error" size={20} />{err}</div>}
              <p className="c3 t-cap" style={{ lineHeight: 1.6 }}>{t('Kirish orqali siz FOOG foydalanish shartlariga rozilik bildirasiz. Raqamingiz faqat stadion bilan bog‘lanish uchun ishlatiladi. To‘lov – stadionda.')}</p>
            </>
          ) : (
            <>
              <div className="col" style={{ gap: 8 }}>
                <h1 style={{ fontSize: 28, lineHeight: '34px', fontWeight: 800, letterSpacing: '-.02em' }}>{t('Xush kelibsiz!')}</h1>
                <p className="c2" style={{ fontSize: 15 }}>{t('Raqamingiz tasdiqlandi. FOOG dan qanday foydalanasiz?')}</p>
              </div>
              <div className="col" style={{ gap: 10 }}>
                {([['player', 'sports_soccer', 'Futbolchiman', 'Stadion bron qilaman, o‘yinlarga qo‘shilaman'], ['owner', 'storefront', 'Stadion egasiman', 'Bronlarni qabul qilaman, jadvalni boshqaraman']] as const).map(([k, ic, title, d]) => (
                  <button key={k} onClick={() => setRole(k)} className="row" style={{ gap: 14, padding: 16, borderRadius: 16, border: 'none', textAlign: 'left', background: role === k ? 'var(--surface-2)' : 'transparent', boxShadow: role === k ? 'inset 0 0 0 2px var(--brand-ink)' : 'inset 0 0 0 1px var(--border-strong)', color: 'var(--text-1)' }} aria-pressed={role === k}>
                    <span style={{ width: 44, height: 44, borderRadius: 12, background: role === k ? 'var(--primary)' : 'var(--surface-2)', color: role === k ? 'var(--on-primary)' : 'var(--text-1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n={ic} fill={role === k} /></span>
                    <span className="col grow"><b style={{ fontSize: 16 }}>{t(title)}</b><span className="c2 t-small">{t(d)}</span></span>
                  </button>
                ))}
              </div>
              <label className="field"><span>{t('Ismingiz')}</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Ism Familiya')} autoComplete="name" /></label>
              {err && <div role="alert" className="row" style={{ gap: 8, color: 'var(--error)', fontSize: 14 }}><Icon n="error" size={20} />{err}</div>}
              <Btn className="btn btn-primary btn-lg btn-block" onClick={complete} loading={busy} disabled={name.trim().length < 2}>{t('Davom etish')}</Btn>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
