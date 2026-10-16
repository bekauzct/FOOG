'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from './ui';
import { useApi } from '@/lib/useApi';
import { DOW_FULL, ago, dayMonth, todayStr, weekday } from '@/lib/format';
import { post } from '@/lib/api';
import { useSession } from '@/lib/session';

export type OwnerStadium = {
  id: string; code: string; name: string; address: string; district: string; lat: number; lng: number; phone: string | null; description: string | null; metro: string | null;
  amenities: string[]; cancelPolicy: string; status: 'mod' | 'live' | 'off' | 'rejected'; accepting: boolean; rejectReason: string | null; isOwner: boolean;
  rating: { avg: number; count: number } | null; photos: { id: string; url: string }[];
  pitches: { id: string; name: string; size: string; surface: string; indoor: boolean; price: number; peakPrice: number; peakFrom: number; note: string | null }[];
};
type Ctx = { stadiums: OwnerStadium[] | null; current: OwnerStadium | null; setCurrent: (id: string) => void; reload: () => void; loading: boolean; error: { message: string } | null; isOwner: boolean };
const OwnerCtx = createContext<Ctx | null>(null);

export function OwnerProvider({ children }: { children: ReactNode }) {
  const q = useApi<{ items: OwnerStadium[] }>('/owner/stadiums');
  const [id, setId] = useState<string | null>(null);
  const { me } = useSession();
  useEffect(() => { try { setId(localStorage.getItem('foog-owner-stadium')); } catch { /* noop */ } }, []);
  const list = q.data?.items ?? null;
  const current = list ? list.find((s) => s.id === id) ?? list.find((s) => s.status === 'live') ?? list[0] ?? null : null;
  const setCurrent = (v: string) => { setId(v); try { localStorage.setItem('foog-owner-stadium', v); } catch { /* noop */ } };
  return <OwnerCtx.Provider value={{ stadiums: list, current, setCurrent, reload: q.reload, loading: q.loading, error: q.error, isOwner: me?.role === 'owner' || me?.role === 'admin' }}>{children}</OwnerCtx.Provider>;
}
export const useOwner = () => { const c = useContext(OwnerCtx); if (!c) throw new Error('OwnerProvider yo‘q'); return c; };
export const sq = (id?: string | null) => (id ? `stadiumId=${id}` : '');

const ST: Record<string, [string, string]> = { live: ['Faol', 'var(--success)'], mod: ['Moderatsiyada', 'var(--warning)'], off: ['To‘xtatilgan', 'var(--error)'], rejected: ['Rad etilgan', 'var(--error)'] };
export const stadiumStatus = (s: OwnerStadium) => (s.status === 'live' && !s.accepting ? ['Bron yopiq', 'var(--text-3)'] as [string, string] : ST[s.status]);

/** Panel sarlavhasi: sana · Toshkent, sahifa nomi, «To‘lov stadionda», stadion tanlash */
export function OwnerHeader({ title, children }: { title: string; children?: ReactNode }) {
  const { stadiums, current, setCurrent } = useOwner();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const f = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false); document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f); }, []);
  const t = todayStr();
  return (
    <div className="row between wrap" style={{ gap: 16, alignItems: 'flex-end' }}>
      <div className="col" style={{ gap: 4 }}>
        <div className="label">{dayMonth(t)}, {DOW_FULL[weekday(t)]} · Toshkent</div>
        <h1 className="t-page">{title}</h1>
      </div>
      <div className="row wrap" style={{ gap: 10 }}>
        {children}
        <span className="pill-tag success hide-mobile" style={{ height: 36, padding: '0 14px', textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600 }}><Icon n="storefront" size={18} />To‘lov stadionda</span>
        {current && (
          <div ref={ref} style={{ position: 'relative' }}>
            <button onClick={() => setOpen((v) => !v)} className="row" style={{ gap: 10, height: 48, padding: '0 10px 0 6px', borderRadius: 12, border: 'none', background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--border)', color: 'var(--text-1)', textAlign: 'left' }} aria-expanded={open} aria-label="Stadionni tanlash">
              <span className="ph" style={{ width: 36, height: 36, borderRadius: 8, background: current.photos[0] ? `center/cover url("${current.photos[0].url}")` : undefined }} />
              <span className="col"><b style={{ fontSize: 14 }}>{current.name}</b><span className="c2" style={{ fontSize: 12 }}>{current.district} tumani</span></span>
              <Icon n="unfold_more" size={20} style={{ color: 'var(--text-2)' }} />
            </button>
            {open && (
              <div className="menu" style={{ right: 0, top: 54 }}>
                {stadiums?.map((s) => (
                  <button key={s.id} onClick={() => { setCurrent(s.id); setOpen(false); }}>
                    <Icon n={s.id === current.id ? 'radio_button_checked' : 'radio_button_unchecked'} />
                    <span className="col grow"><span>{s.name}</span><span style={{ fontSize: 12, color: stadiumStatus(s)[1] }}>{stadiumStatus(s)[0]}</span></span>
                  </button>
                ))}
                <Link href="/owner/stadiums?new=1"><Icon n="add" />Yangi stadion qo‘shish</Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Stadioni yo‘q egasi uchun boshlang‘ich holat */
export function NoStadium() {
  return (
    <div className="card col" style={{ padding: 32, gap: 24 }}>
      <div className="col" style={{ gap: 8 }}><h2 className="t-h3">Birinchi stadioningizni qo‘shing</h2><p className="c2" style={{ fontSize: 15 }}>Stadion admin tekshiruvidan o‘tgach futbolchilarga ko‘rinadi va bron qabul qila boshlaydi.</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
        {[['01', 'Stadion qo‘shing', 'Nomi, manzil, rasmlar va maydonlar.'], ['02', 'Ish vaqti va narx', 'Har bir maydon uchun soatlik va peak narx.'], ['03', 'Bron qabul qiling', 'So‘rovlar Telegram va shu panelga keladi.']].map(([n, t, d]) => (
          <div key={n} className="well col" style={{ padding: 16, gap: 6 }}><span className="mono ink" style={{ fontSize: 13 }}>{n}</span><b>{t}</b><span className="c2 t-small">{d}</span></div>
        ))}
      </div>
      <Link href="/owner/stadiums?new=1" className="btn btn-primary btn-lg" style={{ alignSelf: 'flex-start' }}><Icon n="add" />Stadion qo‘shish</Link>
    </div>
  );
}

export function Kpi({ label, icon, value, sub, color }: { label: string; icon: string; value: string; sub: string; color?: string }) {
  return (
    <div className="card col" style={{ padding: 20, gap: 10 }}>
      <div className="row between"><span className="label-sm">{label}</span><Icon n={icon} size={20} style={{ color: 'var(--text-2)' }} /></div>
      <span className="mono" style={{ fontSize: 30, lineHeight: '36px', fontWeight: 500, color }}>{value}</span>
      <span className="c2 t-small">{sub}</span>
    </div>
  );
}


export type ReviewT = { id: string; rating: number; text: string; reply: string | null; repliedAt: string | null; createdAt: string; user: { id: string; name: string; avatarUrl: string | null }; pitch: string | null };

/** Sharh va unga javob (egasi profili va Sharhlar sahifasi) */
export function ReviewRow({ r, onReplied }: { r: ReviewT; onReplied: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    setBusy(true); setErr(null);
    try { await post(`/owner/reviews/${r.id}/reply`, { text }); setOpen(false); setText(''); onReplied(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="col" style={{ gap: 8, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <div className="row" style={{ gap: 12 }}>
        <span className="av" style={{ width: 36, height: 36, fontSize: 12, background: r.user.avatarUrl ? `center/cover url("${r.user.avatarUrl}")` : `oklch(0.78 0.1 ${([...r.user.name].reduce((a, c) => a + c.charCodeAt(0), 0) * 37) % 360})` }}>{!r.user.avatarUrl && r.user.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
        <div className="col grow"><b style={{ fontSize: 15 }}>{r.user.name}</b><span className="mono c3" style={{ fontSize: 12 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)} · {ago(r.createdAt)}{r.pitch ? ` · ${r.pitch}` : ''}</span></div>
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.5 }}>{r.text}</p>
      {r.reply ? (
        <div className="well col" style={{ padding: '10px 14px', gap: 2, boxShadow: 'inset 3px 0 0 var(--brand-ink)' }}><span className="c2" style={{ fontSize: 12, fontWeight: 600 }}>Sizning javobingiz</span><span style={{ fontSize: 14 }}>{r.reply}</span></div>
      ) : open ? (
        <div className="col" style={{ gap: 8 }}>
          <textarea className="textarea" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Rahmat! Sizni yana kutamiz…" maxLength={600} style={{ minHeight: 72 }} />
          {err && <span style={{ color: 'var(--error)', fontSize: 13 }}>{err}</span>}
          <div className="row" style={{ gap: 8 }}><button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Bekor qilish</button><button className="btn btn-primary btn-sm" disabled={text.trim().length < 2 || busy} onClick={send}>{busy ? 'Yuborilmoqda…' : 'Javob yuborish'}</button></div>
        </div>
      ) : <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>Javob berish</button>}
    </div>
  );
}
