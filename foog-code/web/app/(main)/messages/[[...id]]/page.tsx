'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Avatar, Btn, Empty, ErrorState, Icon, Loading, Modal, Skeleton } from '@/components/ui';
import { FillBar } from '@/components/cards';
import type { MiniUser } from '@/components/social';
import { useApi } from '@/lib/useApi';
import { get, post, upload } from '@/lib/api';
import { useEvent, useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';
import { DOW, agoShort, dayMonth, hhmm, isoDate, relDay, sum, todayStr, addDays, weekday, whenLabel, initials } from '@/lib/format';

type ChatItem = { id: string; type: 'dm' | 'team' | 'match' | 'community'; name: string; short: string | null; avatarUrl: string | null; online: boolean; muted: boolean; last: { text: string; at: string; mine: boolean } | null; unread: number; members: number; at: string };
type Msg = { id: string; chatId: string; type: string; body: string; mediaUrl: string | null; refId: string | null; card: any; createdAt: string; sender: { id: string; name: string; avatarUrl: string | null; username: string | null } };
type Info = { id: string; type: string; name: string; muted: boolean; other: (MiniUser & { level: number }) | null; otherTeam: string | null; mutual: number; online: boolean; members: MiniUser[]; media: { id: string; mediaUrl: string; type: string }[]; match: { id: string; title: string; date: string; start: string; stadium: string } | null; team: { id: string; name: string; short: string } | null };

const KIND: Record<string, string> = { team: 'Jamoa', match: 'O‘yin', community: 'Hamjamiyat' };
const chatAvatar = (c: { type: string; name: string; short: string | null; avatarUrl: string | null }, size = 48, online?: boolean) =>
  c.type === 'dm' ? <Avatar name={c.name} url={c.avatarUrl} size={size} online={online} /> : (
    <span style={{ width: size, height: size, borderRadius: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 ${Math.round(size * 0.3)}px var(--font-ui)`, background: c.type === 'match' ? 'var(--primary)' : c.type === 'team' ? 'var(--inverse)' : 'oklch(0.75 0.12 262)', color: c.type === 'match' ? 'var(--on-primary)' : c.type === 'team' ? 'var(--on-inverse)' : '#091025' }}>
      {c.type === 'match' ? (c.name.match(/\d+×\d+/)?.[0] ?? '⚽').replace('×', 'v') : c.short ?? initials(c.name)}
    </span>
  );

function dayLabel(iso: string) {
  const d = isoDate(iso);
  if (d === todayStr()) return 'Bugun';
  if (d === addDays(todayStr(), -1)) return 'Kecha';
  return `${dayMonth(d)}, ${DOW[weekday(d)]}`;
}

function InviteCard({ c, mine }: { c: { id: string; title: string; date: string; start: string; stadium: string; size: string; filled: number; capacity: number; priceEach: number; status: string }; mine: boolean }) {
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [filled, setFilled] = useState(c.filled);
  const toast = useToast();
  const full = filled >= c.capacity;
  const join = async () => {
    setBusy(true);
    try { await post(`/matches/${c.id}/join`); setJoined(true); setFilled((f) => f + 1); toast('Siz o‘yindasiz! O‘yin chatiga qo‘shildingiz.'); } catch (e) { toast((e as Error).message, { kind: 'warn' }); } finally { setBusy(false); }
  };
  return (
    <div className="card col" style={{ padding: 14, gap: 10, width: 300, maxWidth: '100%', borderRadius: 16 }}>
      <div className="row between"><span className="label-sm ink">O‘yin taklifi</span><span className="mono c2" style={{ fontSize: 12 }}>{filled} / {c.capacity}</span></div>
      <Link href={`/matches/${c.id}`} style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)' }}>{c.title}</Link>
      <span className="mono c2" style={{ fontSize: 13 }}>{whenLabel(c.date, c.start)} · {c.stadium}</span>
      <FillBar filled={filled} total={c.capacity} />
      {!mine && <Btn className={`btn ${joined ? 'btn-outline' : 'btn-primary'} btn-block`} loading={busy} disabled={(full && !joined) || c.status === 'done' || c.status === 'cancelled'} onClick={join}>{joined ? 'Siz o‘yindasiz ✓' : full ? 'O‘yin to‘ldi' : `Qo‘shilish · ${sum(c.priceEach)}`}</Btn>}
      {mine && <Link href={`/matches/${c.id}`} className="btn btn-outline btn-block btn-sm">O‘yinni ko‘rish</Link>}
    </div>
  );
}

function Bubble({ m, mine, showName }: { m: Msg; mine: boolean; showName: boolean }) {
  if (m.type === 'system') return <div className="c3" style={{ textAlign: 'center', fontSize: 12, padding: '4px 0' }}>{m.body}</div>;
  const c = m.card;
  let content: React.ReactNode;
  if (m.type === 'photo') content = <a href={m.mediaUrl!} target="_blank" rel="noreferrer"><img src={m.mediaUrl!} alt="Rasm" style={{ width: 260, maxWidth: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 16 }} /></a>;
  else if (m.type === 'video') content = <video src={m.mediaUrl!} controls playsInline style={{ width: 260, maxWidth: '100%', borderRadius: 16, background: '#000' }} />;
  else if (m.type === 'match_invite') content = c ? <InviteCard c={c} mine={mine} /> : <i className="c3">O‘yin topilmadi</i>;
  else if (m.type === 'stadium') content = c ? (
    <Link href={`/stadiums/${c.id}`} className="card" style={{ width: 280, maxWidth: '100%', overflow: 'hidden', color: 'var(--text-1)', borderRadius: 16 }}>
      <div className="ph" style={{ aspectRatio: '16/9', background: c.photo ? `center/cover url("${c.photo}")` : undefined }} />
      <div className="col" style={{ padding: 12, gap: 6 }}><div className="row between" style={{ gap: 8 }}><b>{c.name}</b><span className="mono" style={{ fontSize: 13 }}>{sum(c.price)}</span></div><span className="c2 t-cap">{c.district}</span><span className="btn btn-primary btn-sm">Bron qilish</span></div>
    </Link>
  ) : <i className="c3">Stadion topilmadi</i>;
  else if (m.type === 'profile') content = c ? (
    <Link href={`/u/${c.username}`} className="card row" style={{ width: 280, maxWidth: '100%', padding: 12, gap: 12, color: 'var(--text-1)', borderRadius: 16 }}>
      <Avatar name={c.name} url={c.avatarUrl} size={48} /><span className="col grow"><b>{c.name}</b><span className="c2 t-cap">{[c.position, `${c.level}-daraja`, c.district].filter(Boolean).join(' · ')}</span></span><Icon n="chevron_right" />
    </Link>
  ) : <i className="c3">Profil topilmadi</i>;
  else if (m.type === 'reel') content = c ? (
    <Link href={`/reels?start=${c.id}`} style={{ position: 'relative', display: 'block', width: 180, aspectRatio: '9/16', borderRadius: 16, overflow: 'hidden', background: c.posterUrl ? `center/cover url("${c.posterUrl}")` : 'var(--ph)' }}>
      <span className="ms fill" style={{ position: 'absolute', left: '50%', top: '45%', transform: 'translate(-50%,-50%)', fontSize: 44, color: '#fff' }}>play_arrow</span>
      <span style={{ position: 'absolute', left: 8, right: 8, bottom: 8, fontSize: 12, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,.6)' }}>@{c.author.username} · {c.caption.slice(0, 50)}</span>
    </Link>
  ) : <i className="c3">Reel o‘chirilgan</i>;
  const text = m.body && m.type !== 'text' ? m.body : null;
  return (
    <div className="col" style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 4 }}>
      {showName && !mine && <span className="c2" style={{ fontSize: 12, marginLeft: 4 }}>{m.sender.name}</span>}
      {m.type === 'text' ? (
        <div style={{ maxWidth: 'min(560px, 80%)', padding: '10px 14px', borderRadius: 18, fontSize: 15, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: mine ? 'var(--primary)' : 'var(--surface)', color: mine ? 'var(--on-primary)' : 'var(--text-1)' }}>{m.body}</div>
      ) : content}
      {text && <div style={{ maxWidth: 'min(560px, 80%)', padding: '8px 12px', borderRadius: 16, fontSize: 14, background: mine ? 'var(--primary)' : 'var(--surface)', color: mine ? 'var(--on-primary)' : 'var(--text-1)' }}>{text}</div>}
      <span className="mono c3" style={{ fontSize: 11, margin: '0 6px' }}>{hhmm(m.createdAt)}</span>
    </div>
  );
}

function Picker({ kind, onPick, onClose }: { kind: 'invite' | 'stadium' | 'profile' | null; onPick: (type: string, refId: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const path = kind === 'invite' ? '/me/matches' : kind === 'stadium' ? `/stadiums?limit=20${q ? `&q=${encodeURIComponent(q)}` : ''}` : kind === 'profile' ? `/players${q ? `?q=${encodeURIComponent(q)}` : ''}` : null;
  const r = useApi<any>(path, [q]);
  if (!kind) return null;
  const items: { id: string; title: string; sub: string; av?: React.ReactNode }[] = !r.data ? [] : kind === 'invite'
    ? r.data.matches.map((m: { id: string; title: string; date: string; start: string; stadium: { name: string }; filled: number; capacity: number }) => ({ id: m.id, title: m.title, sub: `${whenLabel(m.date, m.start)} · ${m.stadium.name} · ${m.filled}/${m.capacity}`, av: <Icon n="sports_soccer" style={{ color: 'var(--brand-ink)' }} /> }))
    : kind === 'stadium' ? r.data.items.map((s: { id: string; name: string; district: string; price: number; photo: string | null }) => ({ id: s.id, title: s.name, sub: `${s.district} · ${sum(s.price)}`, av: <span className="ph" style={{ width: 44, height: 44, borderRadius: 10, background: s.photo ? `center/cover url("${s.photo}")` : undefined }} /> }))
      : r.data.items.map((p: { id: string; name: string; position: string | null; district: string | null; avatarUrl: string | null }) => ({ id: p.id, title: p.name, sub: [p.position, p.district].filter(Boolean).join(' · '), av: <Avatar name={p.name} url={p.avatarUrl} size={40} /> }));
  return (
    <Modal open onClose={onClose} title={kind === 'invite' ? 'O‘yin taklifi' : kind === 'stadium' ? 'Stadion yuborish' : 'O‘yinchi kartasi'}>
      {kind !== 'invite' && <div className="search" style={{ height: 44 }}><Icon n="search" size={20} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidirish" aria-label="Qidirish" /></div>}
      <div className="col" style={{ gap: 6, maxHeight: '50vh', overflowY: 'auto' }}>
        {r.loading && !r.data ? <Loading rows={3} card={false} /> : !items.length ? <Empty icon="search_off" title={kind === 'invite' ? 'Kelgusi o‘yiningiz yo‘q' : 'Topilmadi'} text={kind === 'invite' ? 'Avval stadion bron qilib, o‘yin oching.' : undefined} /> : items.map((it) => (
          <button key={it.id} className="row" onClick={() => onPick(kind === 'invite' ? 'match_invite' : kind, it.id)} style={{ gap: 12, padding: 10, borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--text-1)', textAlign: 'left', minHeight: 56 }}>
            {it.av}<span className="col grow"><b style={{ fontSize: 15 }}>{it.title}</b><span className="c2 t-cap">{it.sub}</span></span><Icon n="send" size={20} style={{ color: 'var(--text-2)' }} />
          </button>
        ))}
      </div>
    </Modal>
  );
}

function Conversation({ id, onBack, onInfo, showInfo }: { id: string; onBack: () => void; onInfo: () => void; showInfo: boolean }) {
  const { me, send: wsSend, on, refresh } = useSession();
  const toast = useToast();
  const info = useApi<Info>(`/chats/${id}`);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [err, setErr] = useState<{ message: string; status?: number } | null>(null);
  const [more, setMore] = useState(false);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState<string | null>(null);
  const [attach, setAttach] = useState(false);
  const [picker, setPicker] = useState<'invite' | 'stadium' | 'profile' | null>(null);
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();

  const load = async () => {
    setErr(null); setMsgs(null);
    try { const r = await get<{ items: Msg[]; hasMore: boolean }>(`/chats/${id}/messages`); setMsgs(r.items); setMore(r.hasMore); post(`/chats/${id}/read`).then(refresh).catch(() => undefined); } catch (e) { setErr(e as Error); }
  };
  useEffect(() => { load(); setText(''); setAttach(false); }, [id]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs?.length, typing]);
  useEffect(() => on('message:active', () => undefined), [on]);
  useEvent('message', (m: Msg) => {
    if (m.chatId !== id) return;
    setMsgs((s) => (s && !s.some((x) => x.id === m.id) ? [...s, m] : s));
    if (m.sender.id !== me?.id) { setTyping(null); post(`/chats/${id}/read`).catch(() => undefined); }
  });
  useEvent('typing', (d: { chatId: string; userId: string }) => {
    if (d.chatId !== id) return;
    const who = info.data?.members.find((u) => u.id === d.userId)?.name ?? info.data?.other?.name ?? '';
    setTyping(who.split(' ')[0] || 'Kimdir');
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(null), 3000);
  });
  const older = async () => {
    if (!msgs?.length) return;
    const r = await get<{ items: Msg[]; hasMore: boolean }>(`/chats/${id}/messages?before=${encodeURIComponent(msgs[0].createdAt)}`);
    setMsgs((s) => [...r.items, ...(s ?? [])]); setMore(r.hasMore);
  };
  const sendText = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    setSending(true);
    try { const m = await post<Msg>(`/chats/${id}/messages`, { type: 'text', body }); setMsgs((s) => (s && !s.some((x) => x.id === m.id) ? [...s, m] : s)); }
    catch (e2) { toast((e2 as Error).message, { kind: 'err', action: { label: 'Qayta yuborish', fn: () => setText(body) } }); setText(body); } finally { setSending(false); }
  };
  const sendCard = async (type: string, refId: string) => {
    setPicker(null); setAttach(false);
    try { const m = await post<Msg>(`/chats/${id}/messages`, { type, refId }); setMsgs((s) => (s && !s.some((x) => x.id === m.id) ? [...s, m] : s)); } catch (e) { toast((e as Error).message, { kind: 'err' }); }
  };
  const sendFile = async (f: File) => {
    setAttach(false);
    const d = new FormData(); d.set('media', f);
    setSending(true);
    try { const m = await upload<Msg>(`/chats/${id}/messages`, d); setMsgs((s) => (s && !s.some((x) => x.id === m.id) ? [...s, m] : s)); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setSending(false); }
  };
  const onType = (v: string) => {
    setText(v);
    if (Date.now() - lastTyping.current > 2000) { lastTyping.current = Date.now(); wsSend({ type: 'typing', chatId: id }); }
  };
  const i = info.data;
  const sub = i ? (i.type === 'dm' ? [i.online ? 'Onlayn' : 'Oflayn', i.other?.position, i.otherTeam].filter(Boolean).join(' · ') : `${KIND[i.type]} · ${i.members.length} a’zo`) : '';
  let lastDay = '';
  return (
    <section className="chat-conv">
      <header className="row" style={{ gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', minHeight: 68 }}>
        <button className="icon-btn ghost only-mobile" onClick={onBack} aria-label="Orqaga"><Icon n="arrow_back" /></button>
        {!i ? <Skeleton h={40} w={200} /> : (
          <>
            {i.type === 'dm' && i.other ? <Link href={`/u/${i.other.username}`}>{chatAvatar({ type: 'dm', name: i.other.name, short: null, avatarUrl: i.other.avatarUrl }, 40)}</Link> : chatAvatar({ type: i.type, name: i.name, short: i.team?.short ?? null, avatarUrl: null }, 40)}
            <div className="col grow" style={{ minWidth: 0 }}>
              <b className="ellipsis" style={{ fontSize: 16 }}>{i.name}</b>
              <span className="ellipsis" style={{ fontSize: 13, color: typing ? 'var(--accent)' : i.online ? 'var(--success)' : 'var(--text-2)' }}>{typing ? `${typing} yozmoqda…` : sub}</span>
            </div>
            {i.type === 'match' && i.match && <Link href={`/matches/${i.match.id}`} className="btn btn-outline btn-sm hide-mobile">O‘yin</Link>}
            <button className={`icon-btn ${showInfo ? '' : 'ghost'}`} style={showInfo ? { background: 'var(--inverse)', color: 'var(--on-inverse)' } : undefined} onClick={onInfo} aria-label="Ma’lumot"><Icon n="info" /></button>
          </>
        )}
      </header>
      <div className="chat-msgs">
        {err ? <ErrorState error={err} onRetry={load} /> : !msgs ? <Loading rows={3} card={false} /> : !msgs.length ? <Empty icon="waving_hand" title="Suhbatni boshlang" text="Salom yozing, o‘yinga taklif yoki stadion kartasini yuboring." /> : (
          <>
            {more && <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }} onClick={older}>Oldingi xabarlar</button>}
            {msgs.map((m, k) => {
              const d = dayLabel(m.createdAt);
              const sep = d !== lastDay;
              lastDay = d;
              const prev = msgs[k - 1];
              return (
                <div key={m.id} className="col" style={{ gap: 6 }}>
                  {sep && <div className="label-sm c3" style={{ textAlign: 'center', padding: '12px 0 4px' }}>{d}</div>}
                  <Bubble m={m} mine={m.sender.id === me?.id} showName={i?.type !== 'dm' && (!prev || prev.sender.id !== m.sender.id || sep)} />
                </div>
              );
            })}
          </>
        )}
        {typing && <div className="row c2" style={{ gap: 6, fontSize: 13 }}><span className="typing-dots"><i /><i /><i /></span>{typing} yozmoqda</div>}
        <div ref={end} />
      </div>
      <div style={{ position: 'relative' }}>
        {attach && (
          <div className="menu" style={{ bottom: 72, left: 16 }}>
            {([['photo', 'Rasm', 'var(--accent)', () => { if (file.current) { file.current.accept = 'image/*'; file.current.click(); } }], ['videocam', 'Video', 'var(--error)', () => { if (file.current) { file.current.accept = 'video/*'; file.current.click(); } }], ['sports_soccer', 'O‘yin taklifi', 'var(--brand-ink)', () => setPicker('invite')], ['stadium', 'Stadion', 'var(--success)', () => setPicker('stadium')], ['person', 'O‘yinchi kartasi', 'var(--warning)', () => setPicker('profile')]] as const).map(([ic, l, c, fn]) => (
              <button key={l} onClick={fn}><Icon n={ic} style={{ color: c }} />{l}</button>
            ))}
          </div>
        )}
        <form onSubmit={sendText} className="row" style={{ gap: 10, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border)' }}>
          <button type="button" className="icon-btn" onClick={() => setAttach((a) => !a)} aria-label="Biriktirish" aria-expanded={attach} style={attach ? { background: 'var(--inverse)', color: 'var(--on-inverse)' } : undefined}><Icon n="add" style={{ transform: attach ? 'rotate(45deg)' : 'none', transition: 'transform var(--base) var(--ease)' }} /></button>
          <div className="search grow" style={{ height: 44, padding: '0 16px' }}>
            <input value={text} onChange={(e) => onType(e.target.value)} placeholder="Xabar yozing" aria-label="Xabar" maxLength={4000} />
          </div>
          <Btn className="icon-btn" loading={sending} disabled={!text.trim()} aria-label="Yuborish" style={{ background: text.trim() ? 'var(--primary)' : 'var(--surface)', color: text.trim() ? 'var(--on-primary)' : 'var(--text-3)' }}><Icon n="send" /></Btn>
        </form>
        <input ref={file} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value = ''; }} />
      </div>
      <Picker kind={picker} onPick={sendCard} onClose={() => setPicker(null)} />
    </section>
  );
}

function InfoPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useApi<Info>(`/chats/${id}`);
  const toast = useToast();
  const mute = async () => {
    try { const r = await post<{ muted: boolean }>(`/chats/${id}/mute`); q.setData(q.data ? { ...q.data, muted: r.muted } : null); toast(r.muted ? 'Bildirishnomalar o‘chirildi' : 'Bildirishnomalar yoqildi'); } catch (e) { toast((e as Error).message, { kind: 'err' }); }
  };
  const i = q.data;
  return (
    <aside className="chat-info">
      <button className="icon-btn ghost only-mobile" onClick={onClose} aria-label="Yopish" style={{ alignSelf: 'flex-end' }}><Icon n="close" /></button>
      {!i ? <Loading rows={2} card={false} /> : (
        <>
          <div className="col" style={{ alignItems: 'center', gap: 8, textAlign: 'center' }}>
            {i.type === 'dm' && i.other ? <Avatar name={i.other.name} url={i.other.avatarUrl} size={80} /> : chatAvatar({ type: i.type, name: i.name, short: i.team?.short ?? null, avatarUrl: null }, 80)}
            <b style={{ fontSize: 18 }}>{i.name}</b>
            <span className="c2 t-small">{i.type === 'dm' && i.other ? `@${i.other.username}${i.mutual ? ` · ${i.mutual} umumiy` : ''}` : `${KIND[i.type]} · ${i.members.length} a’zo`}</span>
            <div className="row" style={{ gap: 8 }}>
              {i.type === 'dm' && i.other && <Link href={`/u/${i.other.username}`} className="btn btn-outline btn-sm">Profilni ko‘rish</Link>}
              {i.match && <Link href={`/matches/${i.match.id}`} className="btn btn-outline btn-sm">O‘yinni ko‘rish</Link>}
              <button className="icon-btn sm" onClick={mute} aria-label={i.muted ? 'Ovozni yoqish' : 'Ovozsiz'} title={i.muted ? 'Bildirishnomalarni yoqish' : 'Bildirishnomalarni o‘chirish'}><Icon n={i.muted ? 'notifications_active' : 'notifications_off'} size={20} /></button>
            </div>
          </div>
          {i.match && (
            <div className="col" style={{ gap: 8 }}><span className="label-sm">Navbatdagi o‘yin</span>
              <Link href={`/matches/${i.match.id}`} className="card row" style={{ padding: 12, gap: 10, color: 'var(--text-1)' }}><Icon n="sports_soccer" style={{ color: 'var(--brand-ink)' }} /><span className="col grow"><b style={{ fontSize: 14 }}>{i.match.title}</b><span className="mono c2" style={{ fontSize: 12 }}>{relDay(i.match.date)} · {i.match.start} · {i.match.stadium}</span></span><Icon n="chevron_right" /></Link>
            </div>
          )}
          {i.type !== 'dm' && (
            <div className="col" style={{ gap: 8 }}><span className="label-sm">A’zolar</span>
              {i.members.slice(0, 12).map((u) => <Link key={u.id} href={`/u/${u.username}`} className="row" style={{ gap: 10, color: 'var(--text-1)', fontSize: 14 }}><Avatar name={u.name} url={u.avatarUrl} size={32} />{u.name}</Link>)}
            </div>
          )}
          <div className="col" style={{ gap: 8 }}><span className="label-sm">Yuborilgan media</span>
            {!i.media.length ? <span className="c3 t-small">Hali rasm yoki video yo‘q</span> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>{i.media.map((m) => <a key={m.id} href={m.mediaUrl} target="_blank" rel="noreferrer" className="ph" style={{ aspectRatio: '1', borderRadius: 8, background: m.type === 'photo' ? `center/cover url("${m.mediaUrl}")` : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.type === 'video' && <Icon n="play_arrow" fill style={{ color: '#fff' }} />}</a>)}</div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

export default function MessagesPage() {
  const params = useParams<{ id?: string[] }>();
  const id = params.id?.[0] ?? null;
  const router = useRouter();
  const { me } = useSession();
  const [filter, setFilter] = useState<'all' | 'dm' | 'team' | 'match' | 'community'>('all');
  const [q, setQ] = useState('');
  const [info, setInfo] = useState(true);
  const [mobInfo, setMobInfo] = useState(false);
  const [communities, setCommunities] = useState(false);
  const list = useApi<{ items: ChatItem[] }>('/chats');
  useEvent('message', () => list.reload());
  useEvent('chat:read', () => list.reload());
  const items = (list.data?.items ?? []).filter((c) => (filter === 'all' || c.type === filter) && (!q || c.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className={`chat-grid ${id ? 'has-conv' : ''} ${info && id ? 'with-info' : ''}`}>
      <aside className="chat-list">
        <div className="row between" style={{ padding: '20px 16px 12px' }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>Xabarlar</h1>
          <button className="icon-btn" onClick={() => setCommunities(true)} aria-label="Hamjamiyatlar" title="Hamjamiyatlar"><Icon n="edit_square" size={22} /></button>
        </div>
        <div style={{ padding: '0 16px 12px' }}><div className="search" style={{ height: 44 }}><Icon n="search" size={20} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chatlarni qidirish" aria-label="Chatlarni qidirish" /></div></div>
        <div className="row scroll-x" style={{ gap: 6, padding: '0 16px 12px' }}>
          {([['all', 'Hammasi'], ['dm', 'Shaxsiy'], ['team', 'Jamoalar'], ['match', 'O‘yinlar'], ['community', 'Hamjamiyat']] as const).map(([k, l]) => <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
        <div className="col" style={{ padding: '0 8px 16px', gap: 2, overflowY: 'auto' }}>
          {list.error && !list.data ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <Loading rows={4} card={false} /> : !items.length ? <Empty icon="forum" title="Chat yo‘q" text="O‘yinchi profilidan «Xabar yozish» ni bosing yoki o‘yinga qo‘shiling." action={<Link href="/discover" className="btn btn-outline btn-sm">O‘yinchilarni topish</Link>} /> : items.map((c) => (
            <Link key={c.id} href={`/messages/${c.id}`} className="row chat-row" style={{ background: c.id === id ? 'var(--surface)' : undefined }}>
              {chatAvatar(c, 48, c.online)}
              <div className="col grow" style={{ minWidth: 0, gap: 2 }}>
                <div className="row between" style={{ gap: 8 }}>
                  <span className="row" style={{ gap: 6, minWidth: 0 }}><b className="ellipsis" style={{ fontSize: 15 }}>{c.name}</b>{c.type !== 'dm' && <span className="tag" style={{ height: 18, padding: '0 5px', fontSize: 9 }}>{KIND[c.type]}</span>}{c.muted && <Icon n="notifications_off" size={14} style={{ color: 'var(--text-3)' }} />}</span>
                  <span className="mono c3" style={{ fontSize: 12, flexShrink: 0 }}>{c.last ? agoShort(c.last.at) : ''}</span>
                </div>
                <div className="row between" style={{ gap: 8 }}>
                  <span className="ellipsis" style={{ fontSize: 14, color: c.unread ? 'var(--text-1)' : 'var(--text-2)', fontWeight: c.unread ? 600 : 400 }}>{c.last ? `${c.last.mine ? 'Siz: ' : ''}${c.last.text}` : 'Hali xabar yo‘q'}</span>
                  {!!c.unread && <span className="badge-n">{c.unread}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </aside>
      {id ? (
        <>
          <Conversation id={id} onBack={() => router.push('/messages')} onInfo={() => { setInfo((v) => !v); setMobInfo((v) => !v); }} showInfo={info} />
          {(info || mobInfo) && <div className={`chat-info-wrap ${mobInfo ? 'mob-open' : ''}`}><InfoPanel id={id} onClose={() => setMobInfo(false)} /></div>}
        </>
      ) : (
        <section className="chat-conv chat-empty hide-mobile"><Empty icon="forum" title={me ? `Salom, ${me.name.split(' ')[0]}!` : 'Xabarlar'} text="Chap tomondan suhbatni tanlang. Shaxsiy, jamoa, o‘yin va hamjamiyat chatlari shu yerda." /></section>
      )}
      <Communities open={communities} onClose={() => setCommunities(false)} onJoined={(cid) => { list.reload(); router.push(`/messages/${cid}`); }} />
    </div>
  );
}

function Communities({ open, onClose, onJoined }: { open: boolean; onClose: () => void; onJoined: (id: string) => void }) {
  const q = useApi<{ items: { id: string; name: string; members: number; joined: boolean }[] }>(open ? '/chats/communities' : null, [open]);
  const toast = useToast();
  return (
    <Modal open={open} onClose={onClose} title="Hamjamiyatlar">
      <p className="c2 t-small">Toshkent futbol hamjamiyatlari: liga, futzal, darvozabonlar. Qo‘shiling va yozishing.</p>
      <div className="col" style={{ gap: 8 }}>
        {q.loading ? <Loading rows={3} card={false} /> : q.data?.items.map((c) => (
          <div key={c.id} className="row card" style={{ padding: 12, gap: 12 }}>
            {chatAvatar({ type: 'community', name: c.name, short: null, avatarUrl: null }, 44)}
            <span className="col grow"><b style={{ fontSize: 15 }}>{c.name}</b><span className="c2 t-cap">{c.members} a’zo</span></span>
            {c.joined ? <button className="btn btn-outline btn-sm" onClick={() => { onClose(); onJoined(c.id); }}>Ochish</button> : <button className="btn btn-primary btn-sm" onClick={async () => { try { await post(`/chats/${c.id}/join`); toast(`${c.name} ga qo‘shildingiz`); onClose(); onJoined(c.id); } catch (e) { toast((e as Error).message, { kind: 'err' }); } }}>Qo‘shilish</button>}
          </div>
        ))}
      </div>
    </Modal>
  );
}

