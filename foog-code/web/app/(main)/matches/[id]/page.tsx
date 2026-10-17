'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Async, Avatar, Btn, Icon, Modal } from '@/components/ui';
import { FillBar } from '@/components/cards';
import { useApi } from '@/lib/useApi';
import { del, patch, post } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useSession } from '@/lib/session';
import { DOW_FULL, SIZE_LABEL, SKILL_LABEL, dayMonth, dec, sum, weekday, tashkent } from '@/lib/format';

type P = { id: string; name: string; username: string; avatarUrl: string | null; position: string | null; level: number; side: 'home' | 'away'; goals: number; assists: number };
type M = {
  id: string; title: string; status: string; level: string; needs: string[]; capacity: number; priceEach: number; filled: number; date: string; start: string; end: string; size: string; pitch: string;
  stadium: { id: string; name: string; district: string }; distanceKm: number; organizer: { id: string; name: string; username: string; avatarUrl: string | null };
  joined: boolean; isOrganizer: boolean; players: P[]; chatId: string | null; homeTeam: { name: string; short: string } | null; awayTeam: { name: string; short: string } | null;
  homeScore: number | null; awayScore: number | null; mvp: { id: string; name: string } | null;
};

function ResultModal({ m, onClose, onDone }: { m: M; onClose: () => void; onDone: () => void }) {
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [mvp, setMvp] = useState<string>('');
  const [stats, setStats] = useState<Record<string, { goals: number; assists: number }>>(Object.fromEntries(m.players.map((p) => [p.id, { goals: 0, assists: 0 }])));
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    setBusy(true);
    try {
      await post(`/matches/${m.id}/result`, { homeScore: home, awayScore: away, mvpId: mvp || undefined, players: m.players.map((p) => ({ userId: p.id, side: p.side, ...stats[p.id] })) });
      toast('Natija saqlandi · o‘yinchilarga xabar ketdi');
      onDone(); onClose();
    } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  const num = (v: number, set: (n: number) => void) => (
    <div className="row" style={{ gap: 4 }}><button className="icon-btn sm" onClick={() => set(Math.max(0, v - 1))} aria-label="Kamaytirish"><Icon n="remove" /></button><span className="mono" style={{ width: 28, textAlign: 'center', fontSize: 18 }}>{v}</span><button className="icon-btn sm" onClick={() => set(v + 1)} aria-label="Ko‘paytirish"><Icon n="add" /></button></div>
  );
  return (
    <Modal open onClose={onClose} title="O‘yin natijasi" wide>
      <div className="row between wrap" style={{ gap: 16 }}>
        <div className="col" style={{ gap: 6 }}><span className="label-sm">{m.homeTeam?.name ?? 'Oqlar'}</span>{num(home, setHome)}</div>
        <div className="col" style={{ gap: 6 }}><span className="label-sm">{m.awayTeam?.name ?? 'Qoralar'}</span>{num(away, setAway)}</div>
      </div>
      <div className="col" style={{ gap: 8, maxHeight: '40vh', overflowY: 'auto' }}>
        {m.players.map((p) => (
          <div key={p.id} className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <Avatar name={p.name} url={p.avatarUrl} size={32} /><span className="grow ellipsis" style={{ fontSize: 14, minWidth: 120 }}>{p.name} <span className="c3">· {p.side === 'home' ? 'Oqlar' : 'Qoralar'}</span></span>
            <span className="c2 t-cap">Gol</span>{num(stats[p.id].goals, (n) => setStats((s) => ({ ...s, [p.id]: { ...s[p.id], goals: n } })))}
            <span className="c2 t-cap">Assist</span>{num(stats[p.id].assists, (n) => setStats((s) => ({ ...s, [p.id]: { ...s[p.id], assists: n } })))}
          </div>
        ))}
      </div>
      <label className="field"><span>MVP</span><select className="select" value={mvp} onChange={(e) => setMvp(e.target.value)}><option value="">Tanlanmagan</option>{m.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <Btn className="btn btn-primary btn-block" loading={busy} onClick={save}>Natijani saqlash</Btn>
    </Modal>
  );
}

function EditModal({ m, onClose, onDone }: { m: M; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: m.title, capacity: m.capacity, level: m.level, needs: m.needs });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    setBusy(true);
    try { await patch(`/matches/${m.id}`, f); toast('O‘yin yangilandi'); onDone(); onClose(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="O‘yinni tahrirlash">
      <label className="field"><span>Nomi</span><input className="input" value={f.title} maxLength={60} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label className="field"><span>Joylar soni</span><input className="input" type="number" min={Math.max(2, m.filled)} max={30} value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} /></label>
      <span className="c3 t-cap">Hozir {m.filled} o‘yinchi bor – joylar soni bundan kam bo‘lmaydi. Kishi boshiga narx qayta hisoblanadi.</span>
      <div className="field"><span>Daraja</span><div className="row wrap" style={{ gap: 8 }}>{(['any', 'beginner', 'intermediate', 'advanced'] as const).map((k) => <button key={k} className={`chip ${f.level === k ? 'on' : ''}`} onClick={() => setF({ ...f, level: k })}>{k === 'any' ? 'Har qanday' : SKILL_LABEL[k]}</button>)}</div></div>
      <div className="field"><span>Kim kerak</span><div className="row wrap" style={{ gap: 8 }}>{['GK', 'DEF', 'MID', 'FWD'].map((k) => <button key={k} className={`chip ${f.needs.includes(k) ? 'on' : ''}`} onClick={() => setF({ ...f, needs: f.needs.includes(k) ? f.needs.filter((x) => x !== k) : [...f.needs, k] })}>{k}</button>)}</div></div>
      <Btn className="btn btn-primary btn-block" loading={busy} disabled={f.title.trim().length < 3 || f.capacity < Math.max(2, m.filled) || f.capacity > 30} onClick={save}>Saqlash</Btn>
    </Modal>
  );
}

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const q = useApi<M>(`/matches/${id}`);
  const { me } = useSession();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(false);
  const [edit, setEdit] = useState(false);
  const [kick, setKick] = useState<P | null>(null);
  const doKick = async () => {
    if (!kick) return;
    setBusy(true);
    try { await del(`/matches/${id}/players/${kick.id}`); toast(`${kick.name} o‘yindan chiqarildi`, { kind: 'warn' }); setKick(null); q.reload(); }
    catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  const join = async () => {
    setBusy(true);
    try { const r = await post<{ chatId: string | null }>(`/matches/${id}/join`); toast('Siz o‘yindasiz! O‘yin chatiga qo‘shildingiz.', { action: r.chatId ? { label: 'Chatni ochish', fn: () => router.push(`/messages/${r.chatId}`) } : undefined }); q.reload(); }
    catch (e) { toast((e as Error).message, { kind: (e as { code?: string }).code === 'full' ? 'warn' : 'err' }); q.reload(); } finally { setBusy(false); }
  };
  const leave = async () => {
    setBusy(true);
    try { await post(`/matches/${id}/leave`); toast('O‘yindan chiqdingiz'); q.reload(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  return (
    <div className="page-narrow">
      <Async q={q}>
        {(m) => {
          const left = m.capacity - m.filled;
          const now = tashkent();
          const started = m.date < now.date || (m.date === now.date && Number(m.start.slice(0, 2)) <= now.hour);
          const done = m.status === 'done';
          const side = (s: 'home' | 'away') => m.players.filter((p) => p.side === s);
          return (
            <div className="col" style={{ gap: 20 }}>
              <Link href="/discover?tab=matches" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', paddingLeft: 8 }}><Icon n="arrow_back" size={20} />O‘yinlar</Link>
              <div className="card col" style={{ padding: 24, gap: 16 }}>
                <div className="row between wrap" style={{ gap: 8 }}>
                  <span className="label ink">{DOW_FULL[weekday(m.date)]}, {dayMonth(m.date)} · {m.start}–{m.end}</span>
                  <span className={`pill-tag ${done ? 'muted' : m.status === 'cancelled' ? 'error' : left <= 0 ? 'error' : 'accent'}`}>{done ? 'Yakunlangan' : m.status === 'cancelled' ? 'Bekor qilingan' : left <= 0 ? 'To‘ldi' : `${left} joy qoldi`}</span>
                </div>
                <h1 className="t-h3" style={{ fontSize: 28, lineHeight: '34px', fontWeight: 800 }}>{m.title}</h1>
                <div className="row wrap c2" style={{ gap: 12, fontSize: 14 }}>
                  <Link href={`/stadiums/${m.stadium.id}`} className="row" style={{ gap: 6 }}><Icon n="stadium" size={18} />{m.stadium.name} · {m.pitch}</Link>
                  <span>{SIZE_LABEL[m.size]} · {SKILL_LABEL[m.level] ?? m.level} · {dec(m.distanceKm)} km</span>
                </div>
                {done ? (
                  <div className="well row between" style={{ padding: 16 }}>
                    <b>{m.homeTeam?.name ?? 'Oqlar'}</b><span className="mono" style={{ fontSize: 30 }}>{m.homeScore} – {m.awayScore}</span><b>{m.awayTeam?.name ?? 'Qoralar'}</b>
                  </div>
                ) : (
                  <>
                    <FillBar filled={m.filled} total={m.capacity} segs={Math.min(14, m.capacity)} />
                    <div className="row between mono c2" style={{ fontSize: 13 }}><span>{m.filled} / {m.capacity} o‘yinchi</span><span>{sum(m.priceEach)} dan · to‘lov stadionda</span></div>
                  </>
                )}
                {done && m.mvp && <div className="row" style={{ gap: 8, fontSize: 14 }}><span className="pill-tag volt"><Icon n="star" fill size={14} />MVP</span>{m.mvp.name}</div>}
                {!!m.needs.length && !done && <div className="row wrap" style={{ gap: 6 }}><span className="label-sm c3">Kerak</span>{m.needs.map((n) => <span key={n} className="tag solid">{n}</span>)}</div>}
                <div className="row wrap" style={{ gap: 8 }}>
                  {!done && m.status !== 'cancelled' && !m.joined && <Btn className="btn btn-primary btn-lg grow" loading={busy} disabled={left <= 0} onClick={me ? join : () => router.push('/login')}>{left <= 0 ? 'O‘yin to‘ldi' : `O‘yinga qo‘shilish · ${sum(m.priceEach)}`}</Btn>}
                  {m.joined && m.chatId && <Link href={`/messages/${m.chatId}`} className="btn btn-primary btn-lg grow"><Icon n="chat" />O‘yin chati</Link>}
                  {m.joined && !done && <Link href={`/discover?tab=players&invite=${m.id}`} className="btn btn-outline btn-lg"><Icon n="group_add" />Taklif qilish</Link>}
                  {m.joined && !m.isOrganizer && !done && <Btn className="btn btn-ghost btn-lg" loading={busy} onClick={leave}>Chiqish</Btn>}
                  {m.isOrganizer && !done && m.status !== 'cancelled' && <button className="btn btn-outline btn-lg" onClick={() => setEdit(true)}><Icon n="edit" />Tahrirlash</button>}
                  {m.isOrganizer && started && !done && <button className="btn btn-inverse btn-lg" onClick={() => setResult(true)}><Icon n="scoreboard" />Natijani kiritish</button>}
                </div>
                {m.joined && !done && <div className="mono c3" style={{ fontSize: 12 }}>O‘yin chatiga qo‘shildingiz · o‘yindan 2 soat oldin eslatma</div>}
              </div>

              <div className="col" style={{ gap: 12 }}>
                <div className="row between"><h2 style={{ fontSize: 20, fontWeight: 700 }}>O‘yinchilar</h2><span className="c2 t-small">Tashkilotchi: <Link href={`/u/${m.organizer.username}`}>{m.organizer.name}</Link></span></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
                  {(['home', 'away'] as const).map((s) => (
                    <div key={s} className="card col" style={{ padding: 16, gap: 10 }}>
                      <span className="label-sm">{s === 'home' ? (m.homeTeam?.name ?? 'Oqlar') : (m.awayTeam?.name ?? 'Qoralar')} · {side(s).length}</span>
                      {side(s).map((p) => (
                        <div key={p.id} className="row" style={{ gap: 4 }}>
                          <Link href={`/u/${p.username}`} className="row grow" style={{ gap: 10, color: 'var(--text-1)', minWidth: 0 }}>
                            <Avatar name={p.name} url={p.avatarUrl} size={36} />
                            <span className="col grow" style={{ minWidth: 0 }}><b className="ellipsis" style={{ fontSize: 14 }}>{p.name}</b><span className="c2 t-cap">{p.id === m.organizer.id ? 'Tashkilotchi · ' : ''}{p.position ?? '—'} · {p.level}-daraja</span></span>
                            {done && (p.goals > 0 || p.assists > 0) && <span className="mono c2" style={{ fontSize: 12 }}>{p.goals}G {p.assists}A</span>}
                          </Link>
                          {m.isOrganizer && !done && m.status !== 'cancelled' && p.id !== m.organizer.id && <button className="icon-btn" aria-label={`${p.name} ni o‘yindan chiqarish`} title="O‘yindan chiqarish" onClick={() => setKick(p)}><Icon n="person_remove" /></button>}
                        </div>
                      ))}
                      {!side(s).length && <span className="c3 t-small">Hali hech kim yo‘q</span>}
                    </div>
                  ))}
                </div>
              </div>
              {result && <ResultModal m={m} onClose={() => setResult(false)} onDone={q.reload} />}
              {edit && <EditModal m={m} onClose={() => setEdit(false)} onDone={q.reload} />}
              {kick && (
                <Modal open onClose={() => setKick(null)} title="O‘yinchini chiqarish">
                  <p className="c2" style={{ fontSize: 15, lineHeight: 1.5 }}>{kick.name} ni «{m.title}» o‘yinidan chiqarasizmi? U o‘yin chatidan ham chiqariladi va unga xabar boradi.</p>
                  <div className="row" style={{ gap: 8 }}><button className="btn btn-outline grow" onClick={() => setKick(null)}>Bekor qilish</button><Btn className="btn btn-danger grow" loading={busy} onClick={doKick}>Chiqarish</Btn></div>
                </Modal>
              )}
            </div>
          );
        }}
      </Async>
    </div>
  );
}
