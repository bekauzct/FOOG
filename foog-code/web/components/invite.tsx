'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatar, Btn, Empty, Icon, Loading, Modal } from './ui';
import { get, post } from '@/lib/api';
import { SIZE_LABEL, sum, whenLabel } from '@/lib/format';
import { useToast } from '@/lib/toast';
import type { MatchT } from './cards';

type MyMatches = { matches: MatchT[]; bookingsWithoutMatch: { id: string; code: string; date: string; start: string; end: string; stadium: string; pitch: string; size: string; price: number }[] };

/** «O‘yinga taklif qilish»: mening kelgusi o‘yinlarimdan birini tanlash yoki bronimdan yangi o‘yin ochish */
export function InviteModal({ user, onClose }: { user: { id: string; name: string; avatarUrl: string | null } | null; onClose: () => void }) {
  const [d, setD] = useState<MyMatches | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [create, setCreate] = useState<MyMatches['bookingsWithoutMatch'][0] | null>(null);
  const [title, setTitle] = useState('');
  const [cap, setCap] = useState(10);
  const toast = useToast();
  useEffect(() => {
    if (!user) return;
    setD(null); setErr(null); setCreate(null);
    get<MyMatches>('/me/matches').then(setD).catch((e) => setErr(e.message));
  }, [user?.id]);
  if (!user) return null;
  const invite = async (matchId: string) => {
    setBusy(matchId);
    try {
      const r = await post<{ chatId: string }>(`/matches/${matchId}/invite`, { userId: user.id });
      toast(`${user.name} ga taklif yuborildi`, { action: { label: 'Chatni ochish', fn: () => (location.href = `/messages/${r.chatId}`) } });
      onClose();
    } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(null); }
  };
  const createAndInvite = async () => {
    if (!create) return;
    setBusy('new');
    try {
      const m = await post<{ id: string }>('/matches', { bookingId: create.id, title: title.trim() || `${SIZE_LABEL[create.size]} · ${create.stadium}`, capacity: cap, level: 'any', needs: [] });
      await invite(m.id);
    } catch (e) { toast((e as Error).message, { kind: 'err' }); setBusy(null); }
  };
  return (
    <Modal open onClose={onClose} title="O‘yinga taklif qilish">
      <div className="row" style={{ gap: 12 }}><Avatar name={user.name} url={user.avatarUrl} size={40} /><div><b>{user.name}</b><div className="c2 t-small">qaysi o‘yiningizga taklif qilasiz?</div></div></div>
      {err ? <p style={{ color: 'var(--error)' }}>{err}</p> : !d ? <Loading rows={2} card={false} /> : create ? (
        <div className="col" style={{ gap: 12 }}>
          <div className="well" style={{ padding: 12, fontSize: 14 }}><b>{create.stadium}</b> · {create.pitch}<div className="mono c2" style={{ fontSize: 12 }}>{whenLabel(create.date, create.start)} · {sum(create.price)}</div></div>
          <label className="field"><span>O‘yin nomi</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${SIZE_LABEL[create.size]} · ${create.stadium}`} maxLength={60} /></label>
          <label className="field"><span>O‘yinchilar soni</span>
            <div className="row" style={{ gap: 8 }}>{[10, 12, 14, 22].map((n) => <button key={n} className={`chip ${cap === n ? 'on' : ''}`} onClick={() => setCap(n)}>{n}</button>)}</div>
            <span className="hint">Har biriga: {sum(Math.ceil(create.price / cap / 1000) * 1000)} · to‘lov stadionda</span>
          </label>
          <div className="row" style={{ gap: 8 }}><button className="btn btn-outline" onClick={() => setCreate(null)}>Orqaga</button><Btn className="btn btn-primary grow" loading={busy === 'new'} onClick={createAndInvite}>O‘yin ochish va taklif qilish</Btn></div>
        </div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          {d.matches.map((m) => (
            <div key={m.id} className="row card" style={{ padding: 14, gap: 12 }}>
              <div className="col grow"><b style={{ fontSize: 15 }}>{m.title}</b><span className="mono c2" style={{ fontSize: 12 }}>{whenLabel(m.date, m.start)} · {m.stadium.name} · {m.filled}/{m.capacity}</span></div>
              <Btn className="btn btn-primary btn-sm" loading={busy === m.id} onClick={() => invite(m.id)}>Taklif</Btn>
            </div>
          ))}
          {d.bookingsWithoutMatch.map((b) => (
            <button key={b.id} className="row card" style={{ padding: 14, gap: 12, textAlign: 'left', color: 'var(--text-1)' }} onClick={() => setCreate(b)}>
              <Icon n="add_circle" style={{ color: 'var(--accent)' }} />
              <div className="col grow"><b style={{ fontSize: 15 }}>Bronimdan o‘yin ochish</b><span className="mono c2" style={{ fontSize: 12 }}>{b.stadium} · {whenLabel(b.date, b.start)}</span></div>
              <Icon n="chevron_right" />
            </button>
          ))}
          {!d.matches.length && !d.bookingsWithoutMatch.length && (
            <Empty icon="sports_soccer" title="Kelgusi o‘yiningiz yo‘q" text="Taklif qilish uchun avval stadion bron qiling yoki ochiq o‘yinga qo‘shiling." action={<Link className="btn btn-primary btn-sm" href="/stadiums">Stadion bron qilish</Link>} />
          )}
        </div>
      )}
    </Modal>
  );
}
