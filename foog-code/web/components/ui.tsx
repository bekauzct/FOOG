'use client';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { avatarColor, initials } from '@/lib/format';
import { ICONS } from './icons.generated';
import { useT } from '@/lib/i18n';

/** SVG ikonka (Material Symbols Rounded). Yangi nom qo‘shilsa: npm run icons */
export const Icon = ({ n, fill, size, style, className = '' }: { n: string; fill?: boolean; size?: number; style?: CSSProperties; className?: string }) => {
  const p = ICONS[n];
  return (
    <svg className={`ms ${className}`} style={{ fontSize: size, ...style }} viewBox="0 -960 960 960" aria-hidden="true" focusable="false" data-missing={p ? undefined : n}>
      {p && <path d={fill ? p[1] ?? p[0] : p[0]} />}
    </svg>
  );
};

/** HTML satr ko‘rinishidagi SVG ikonka – Leaflet divIcon kabi React’dan tashqari joylar uchun */
export const iconHtml = (n: string, size: number, color = 'currentColor', fill = true) => {
  const p = ICONS[n];
  return `<svg viewBox="0 -960 960 960" width="${size}" height="${size}" fill="${color}" aria-hidden="true" style="display:block">${p ? `<path d="${fill ? p[1] ?? p[0] : p[0]}"/>` : ''}</svg>`;
};

export function Avatar({ name = '', url, size = 40, ring, square, style, online }: { name?: string; url?: string | null; size?: number; ring?: string; square?: boolean; style?: CSSProperties; online?: boolean }) {
  const inner = (
    <span className={`av ${square ? 'av-sq' : ''}`} style={{ width: size, height: size, background: url ? `center/cover no-repeat url("${url}")` : avatarColor(name), fontSize: Math.max(10, Math.round(size * 0.3)), ...(ring ? {} : style) }}>
      {!url && initials(name)}
    </span>
  );
  const dot = online ? <span style={{ position: 'absolute', right: -1, bottom: -1, width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26), borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 0 2px var(--bg)' }} /> : null;
  if (!ring) return online ? <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>{inner}{dot}</span> : inner;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', padding: 3, borderRadius: '50%', background: ring, flexShrink: 0, ...style }}>
      <span style={{ display: 'inline-flex', borderRadius: '50%', border: '3px solid var(--bg)' }}>
        <span className="av" style={{ width: size - 12, height: size - 12, background: url ? `center/cover no-repeat url("${url}")` : avatarColor(name), fontSize: Math.round(size * 0.28) }}>{!url && initials(name)}</span>
      </span>
      {dot}
    </span>
  );
}

export function Skeleton({ h = 16, w = '100%', r = 8, style }: { h?: number | string; w?: number | string; r?: number; style?: CSSProperties }) {
  return <div className="skel" style={{ height: h, width: w, borderRadius: r, ...style }} />;
}

export function Loading({ rows = 3, card = true, label = 'Yuklanmoqda…' }: { rows?: number; card?: boolean; label?: string }) {
  const t = useT();
  return (
    <div aria-busy="true" aria-label={t(label)} className="col" style={{ gap: 12 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={card ? 'card' : ''} style={{ padding: card ? 18 : 0, display: 'flex', gap: 12, alignItems: 'center' }}>
          <Skeleton h={44} w={44} r={22} />
          <div className="col grow" style={{ gap: 8 }}><Skeleton h={14} w="55%" /><Skeleton h={12} w="35%" /></div>
        </div>
      ))}
    </div>
  );
}

// Bo‘sh holat ikonkasi → FOOGI stikeri (public/foogi/*.webp)
const ART: Record<string, string> = {
  groups: 'team_trio', group: 'add_friend', person: 'add_friend', person_add: 'add_friend', sports_soccer: 'kick', stadium: 'find_stadium', event_note: 'calendar_schedule', event_available: 'calendar_schedule', event_busy: 'calendar_schedule',
  chat_bubble: 'empty_chat_bubble', forum: 'empty_chat_bubble', notifications: 'notification_bell', search: 'search', search_off: 'search', receipt_long: 'receipt_check', dynamic_feed: 'reels_camera', smart_display: 'reels_camera',
  video_library: 'reels_camera', credit_card: 'pay_stadium', payments: 'pay_stadium', block: 'profile_blocked', reviews: 'gold_star', star: 'gold_star', inbox: 'thinking', photo_library: 'share_photo', emoji_events: 'trophy', flag: 'whistle',
};
export const Art = ({ pose, size = 128 }: { pose: string; size?: number }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img className="foogi-art" src={`/foogi/${pose}.webp`} alt="" width={size} height={size} style={{ width: size, height: size }} loading="lazy" />
);

export function Empty({ icon = 'inbox', title, text, action, art }: { icon?: string; title: string; text?: string; action?: ReactNode; art?: string | false }) {
  const t = useT();
  const pose = art === false ? null : art ?? ART[icon];
  return (
    <div className="state">
      {pose ? <Art pose={pose} /> : <Icon n={icon} />}
      <h3>{t(title)}</h3>
      {text && <p style={{ maxWidth: 420, fontSize: 14, lineHeight: 1.5 }}>{t(text)}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error?: { message: string; status?: number } | null; onRetry?: () => void }) {
  const t = useT();
  const st = error?.status;
  // internet o‘chgan / server / ruxsat / topilmadi – har biriga o‘z FOOGI stikeri
  const pose = st === 0 ? 'no_connection' : st === 403 ? 'profile_blocked' : st === 404 ? 'not_found_goal' : 'server_connect';
  return (
    <div className="state" role="alert">
      <Art pose={pose} />
      <h3>{t(st === 0 ? 'Internet yo‘q' : st === 403 ? 'Ruxsat yo‘q' : st === 404 ? 'Topilmadi' : 'Yuklab bo‘lmadi')}</h3>
      <p style={{ fontSize: 14 }}>{t(error?.message ?? 'Xatolik yuz berdi')}</p>
      {onRetry && <button className="btn btn-outline btn-sm" onClick={onRetry}><Icon n="refresh" />{t('Qayta urinish')}</button>}
    </div>
  );
}

/** Uch holatli o‘rovchi: yuklanmoqda / xato / bo‘sh / ma’lumot */
export function Async<T>({ q, empty, loading, children }: { q: { data: T | null; error: { message: string; status?: number } | null; loading: boolean; reload: () => void }; empty?: (d: T) => ReactNode | false; loading?: ReactNode; children: (d: T) => ReactNode }) {
  if (q.loading && !q.data) return <>{loading ?? <Loading />}</>;
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return null;
  const e = empty?.(q.data);
  if (e) return <>{e}</>;
  return <>{children(q.data)}</>;
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // Escape faqat eng ustdagi oynani yopadi
    const k = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; const all = document.querySelectorAll('.overlay'); if (all[all.length - 1] === ref.current?.parentElement) onClose(); };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [open]);
  if (!open || typeof document === 'undefined') return null;
  // Portal: ichma-ich ochilgan oynalar ham butun ekranni egallaydi (ota oynaning transform’i ta’sir qilmaydi)
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" tabIndex={-1} ref={ref}>
        {title !== undefined && (
          <div className="row between" style={{ gap: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.01em' }}>{title}</div>
            <CloseBtn onClose={onClose} />
          </div>
        )}
        {children}
        {footer}
      </div>
    </div>,
    document.body,
  );
}

function CloseBtn({ onClose }: { onClose: () => void }) {
  const t = useT();
  return <button className="icon-btn ghost sm" onClick={onClose} aria-label={t('Yopish')}><Icon n="close" /></button>;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}><i /></button>;
}

export function Check({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" className={`check ${on ? 'on' : ''}`} role="checkbox" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>{on && <Icon n="check" size={16} style={{ fontWeight: 700 }} />}</button>;
}

export function Spinner() { return <span className="spin" aria-hidden="true" />; }

export function Btn({ loading, children, className = 'btn', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return <button {...p} className={`${className} ${loading ? 'is-loading' : ''}`} disabled={p.disabled}>{loading && <Spinner />}{children}</button>;
}

export function Seg<T extends string>({ items, value, onChange }: { items: [T, ReactNode, number?][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg scroll-x" role="tablist">
      {items.map(([k, label, n]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
          {label}{n ? <span className="badge-n" style={value === k ? { background: 'var(--on-inverse)', color: 'var(--inverse)' } : undefined}>{n}</span> : null}
        </button>
      ))}
    </div>
  );
}

export const Media = ({ url, type, ar = '4/5', label, style, rounded = 0 }: { url?: string | null; type?: string | null; ar?: string; label?: string; style?: CSSProperties; rounded?: number }) =>
  url ? (
    type === 'video'
      ? <video src={url} controls playsInline preload="metadata" style={{ width: '100%', aspectRatio: ar, objectFit: 'cover', background: '#000', borderRadius: rounded, ...style }} />
      : <img src={url} alt={label ?? ''} loading="lazy" style={{ width: '100%', aspectRatio: ar, objectFit: 'cover', borderRadius: rounded, ...style }} />
  ) : (
    <div className="ph" style={{ aspectRatio: ar, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '400 11px var(--font-mono)', color: 'var(--text-3)', borderRadius: rounded, ...style }}>{label}</div>
  );
