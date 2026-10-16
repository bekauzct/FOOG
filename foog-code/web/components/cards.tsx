'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Avatar, Btn, Icon } from './ui';
import { post } from '@/lib/api';
import { dec, SIZE_LABEL, SKILL_LABEL, sum, whenLabel, AVAIL_LABEL, MONTHS_SHORT } from '@/lib/format';
import { useToast } from '@/lib/toast';
import { useSession } from '@/lib/session';
import { useRouter } from 'next/navigation';

export type MatchT = {
  id: string; title: string; status: string; level: string; needs: string[]; capacity: number; priceEach: number; filled: number;
  date: string; start: string; end: string; size: string; pitch: string; stadium: { id: string; name: string; district: string }; distanceKm: number;
  players: { id: string; name: string; avatarUrl: string | null }[]; joined?: boolean;
};

/** To‘ldirilganlik chizig‘i: 10 bo‘lak (dizayndagi "bar") */
export function FillBar({ filled, total, segs = 10 }: { filled: number; total: number; segs?: number }) {
  const n = Math.round((filled / Math.max(1, total)) * segs);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${segs},1fr)`, gap: 3 }} aria-label={`${filled}/${total} o‘yinchi`}>
      {Array.from({ length: segs }, (_, i) => <div key={i} style={{ height: 5, borderRadius: 999, background: i < n ? 'var(--brand-ink)' : 'var(--border)' }} />)}
    </div>
  );
}

export function useJoin(m: { id: string; joined?: boolean; filled: number }, onJoined?: (chatId: string | null) => void) {
  const [joined, setJoined] = useState(!!m.joined);
  const [filled, setFilled] = useState(m.filled);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const { me } = useSession();
  const join = async () => {
    if (!me) return router.push('/login');
    if (joined) return;
    setBusy(true);
    try {
      const r = await post<{ joined: boolean; chatId: string | null }>(`/matches/${m.id}/join`);
      setJoined(true);
      setFilled((f) => f + 1);
      toast('Siz o‘yindasiz! O‘yin chatiga qo‘shildingiz.', { action: r.chatId ? { label: 'Chatni ochish', fn: () => router.push(`/messages/${r.chatId}`) } : undefined });
      onJoined?.(r.chatId);
    } catch (e) {
      toast((e as Error).message, { kind: (e as { code?: string }).code === 'full' ? 'warn' : 'err' });
    } finally { setBusy(false); }
  };
  return { joined, filled, busy, join };
}

/** Home o‘ng panelidagi kichik ochiq o‘yin kartasi */
export function MatchMini({ m }: { m: MatchT }) {
  const { joined, filled, busy, join } = useJoin(m);
  return (
    <div className="well col" style={{ padding: 14, gap: 10 }}>
      <div className="row between"><div className="label-sm ink">{whenLabel(m.date, m.start)}</div><div className="mono c2" style={{ fontSize: 12 }}>{dec(m.distanceKm)} km</div></div>
      <Link href={`/matches/${m.id}`} style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{m.title}</Link>
      <FillBar filled={filled} total={m.capacity} />
      <div className="row between" style={{ gap: 8 }}>
        <div className="mono c2 ellipsis" style={{ fontSize: 12 }}>{filled}/{m.capacity} · {m.needs.length ? `Kerak: ${m.needs.join(', ')}` : m.stadium.name}</div>
        <Btn className={`btn btn-sm ${joined ? 'btn-outline' : 'btn-primary'}`} onClick={join} loading={busy} disabled={!joined && filled >= m.capacity}>{joined ? 'Qo‘shildingiz ✓' : filled >= m.capacity ? 'To‘ldi' : 'Qo‘shilish'}</Btn>
      </div>
    </div>
  );
}

/** Izlash → O‘yinlar kartasi (FOOG Discover.dc.html) */
export function MatchCard({ m }: { m: MatchT }) {
  const { joined, filled, busy, join } = useJoin(m);
  const left = m.capacity - filled;
  const segs = Math.min(m.capacity, 14);
  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row between" style={{ gap: 8 }}>
        <span className="label-sm ink">{whenLabel(m.date, m.start)}</span>
        <span className={`pill-tag ${left <= 0 ? 'error' : 'accent'}`}>{left <= 0 ? 'To‘ldi' : `${left} joy`}</span>
      </div>
      <div className="col" style={{ gap: 2 }}>
        <Link href={`/matches/${m.id}`} style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.01em', color: 'var(--text-1)' }}>{m.title}</Link>
        <div className="c2" style={{ fontSize: 14 }}>{m.stadium.name} · {m.pitch} · {SKILL_LABEL[m.level] ?? m.level}</div>
      </div>
      <FillBar filled={filled} total={m.capacity} segs={segs} />
      <div className="row between mono c2" style={{ fontSize: 12 }}><span>{filled} / {m.capacity} o‘yinchi</span><span>{sum(m.priceEach)} dan</span></div>
      {!!m.needs.length && <div className="row wrap" style={{ gap: 6 }}><span className="label-sm c3">Kerak</span>{m.needs.map((n) => <span key={n} className="tag solid">{n}</span>)}</div>}
      <div className="row" style={{ gap: 8 }}>
        <Link href={`/matches/${m.id}`} className="btn btn-outline" style={{ flex: 1 }}>Batafsil</Link>
        <Btn className={`btn ${joined ? 'btn-outline' : 'btn-primary'}`} style={{ flex: 1.4 }} onClick={join} loading={busy} disabled={!joined && left <= 0}>
          {joined ? 'Siz o‘yindasiz ✓' : left <= 0 ? 'To‘ldi' : `Qo‘shilish · ${sum(m.priceEach)}`}
        </Btn>
      </div>
    </div>
  );
}

export type PlayerT = {
  id: string; name: string; username: string; avatarUrl: string | null; verified: boolean; position: string | null; skill: string | null; level: number;
  district: string | null; available: string[]; online: boolean; distanceKm: number | null; following: boolean; matches: number; goals: number; assists: number; mvp: number; rating: number;
};

/** DS: Player card */
export function PlayerCard({ p, onInvite, onMessage }: { p: PlayerT; onInvite: (p: PlayerT) => void; onMessage: (p: PlayerT) => void }) {
  const [following, setFollowing] = useState(p.following);
  const toast = useToast();
  const follow = async () => {
    setFollowing((f) => !f);
    try { const r = await post<{ following: boolean }>(`/users/${p.username}/follow`); setFollowing(r.following); toast(r.following ? `${p.name} kuzatilmoqda` : 'Kuzatish to‘xtatildi'); } catch (e) { setFollowing(p.following); toast((e as Error).message, { kind: 'err' }); }
  };
  const avail = p.available[0];
  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Link href={`/u/${p.username}`} className="row" style={{ gap: 14, color: 'var(--text-1)' }}>
        <Avatar name={p.name} url={p.avatarUrl} size={56} online={p.online} />
        <div className="col grow">
          <div className="row" style={{ gap: 4, fontSize: 17, fontWeight: 700 }}><span className="ellipsis">{p.name}</span>{p.verified && <Icon n="verified" fill size={16} style={{ color: 'var(--accent)' }} />}</div>
          <div className="c2 ellipsis" style={{ fontSize: 14 }}>{p.district ?? 'Toshkent'}{p.distanceKm ? ` · ${dec(p.distanceKm)} km` : ''}</div>
        </div>
      </Link>
      <div className="row wrap" style={{ gap: 6 }}>
        {p.position && <span className="tag solid">{p.position}</span>}
        {p.skill && <span className="tag">{SKILL_LABEL[p.skill]}</span>}
        {avail && <span className="pill-tag success" style={{ borderRadius: 6 }}>{AVAIL_LABEL[avail] ?? avail}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        {([[p.matches, 'O‘yin'], [p.goals, 'Gol'], [p.rating ? dec(p.rating) : '—', 'Reyting']] as const).map(([v, l]) => <div key={l} className="col"><span className="mono" style={{ fontSize: 20, fontWeight: 500 }}>{v}</span><span className="c2" style={{ fontSize: 12 }}>{l}</span></div>)}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-primary grow" onClick={() => onInvite(p)}>O‘yinga taklif</button>
        <button className={`icon-btn outline ${following ? '' : ''}`} onClick={follow} aria-label={following ? 'Kuzatishni to‘xtatish' : 'Kuzatish'} title={following ? 'Kuzatilmoqda' : 'Kuzatish'} style={following ? { background: 'var(--inverse)', color: 'var(--on-inverse)', boxShadow: 'none' } : undefined}><Icon n={following ? 'how_to_reg' : 'person_add'} size={20} /></button>
        <button className="icon-btn outline" onClick={() => onMessage(p)} aria-label="Xabar yozish" title="Xabar yozish"><Icon n="chat_bubble" size={20} /></button>
      </div>
    </div>
  );
}

export const UpcomingDate = ({ date }: { date: string }) => (
  <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg)', boxShadow: 'inset 0 0 0 1px var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <div className="mono ink" style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 500 }}>{MONTHS_SHORT[Number(date.slice(5, 7)) - 1]}</div>
    <div className="mono" style={{ fontSize: 20, lineHeight: 1, fontWeight: 500 }}>{date.slice(8, 10)}</div>
  </div>
);
