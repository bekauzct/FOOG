'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Btn, ErrorState, Icon, Loading, Modal } from '@/components/ui';
import { MatchCard, PlayerCard, type MatchT, type PlayerT } from '@/components/cards';
import { InviteModal } from '@/components/invite';
import { useApi } from '@/lib/useApi';
import { post, qs } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { DISTRICTS, SKILL_LABEL, addDays, todayStr, weekday } from '@/lib/format';

type Team = { id: string; name: string; short: string; captainId: string; district: string | null; level: string; lookingFor: string[]; plays: string | null; members: number; isMember: boolean; chatId: string | null; wins: number; draws: number; losses: number; form: string[] };
type Tab = 'players' | 'teams' | 'matches';

function Filters({ groups }: { groups: { label: string; opts: [string, string][]; value: string[]; set: (v: string[]) => void; single?: boolean }[] }) {
  return (
    <div className="col" style={{ gap: 10 }}>
      {groups.map((g) => (
        <div key={g.label} className="dc-filter">
          <span className="label-sm c3" style={{ width: 96, flexShrink: 0 }}>{g.label}</span>
          <div className="row scroll-x" style={{ gap: 8 }}>
            {g.opts.map(([k, l]) => {
              const on = g.value.includes(k);
              return <button key={k} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => g.set(g.single ? (on ? [] : [k]) : on ? g.value.filter((x) => x !== k) : [...g.value, k])}>{l}</button>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamCard({ t, onChange }: { t: Team; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const join = async () => {
    setBusy(true);
    try { const r = await post<{ chatId: string }>(`/teams/${t.id}/join`); toast(`${t.name} jamoasiga qo‘shildingiz`, { action: { label: 'Chatni ochish', fn: () => router.push(`/messages/${r.chatId}`) } }); onChange(); }
    catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  const msgCaptain = async () => {
    try { const r = await post<{ id: string }>('/chats/dm', { userId: t.captainId }); router.push(`/messages/${r.id}`); } catch (e) { toast((e as Error).message, { kind: 'err' }); }
  };
  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row" style={{ gap: 14 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--inverse)', color: 'var(--on-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 20px var(--font-ui)', flexShrink: 0 }}>{t.short}</div>
        <div className="col grow"><b style={{ fontSize: 17 }} className="ellipsis">{t.name}</b><span className="c2 ellipsis" style={{ fontSize: 14 }}>{SKILL_LABEL[t.level]} · {t.district ?? 'Toshkent'} · {t.members} o‘yinchi</span></div>
      </div>
      <div className="row between mono" style={{ fontSize: 15 }}>
        <span className="row" style={{ gap: 14 }}><span><span style={{ color: 'var(--success)', fontSize: 12 }}>G</span> {t.wins}</span><span><span className="c3" style={{ fontSize: 12 }}>D</span> {t.draws}</span><span><span style={{ color: 'var(--error)', fontSize: 12 }}>M</span> {t.losses}</span></span>
        {t.plays && <span className="c2" style={{ fontFamily: 'var(--font-ui)', fontSize: 13 }}>{t.plays}</span>}
      </div>
      <div className="well row wrap" style={{ padding: '10px 12px', gap: 8 }}><span className="label-sm c2">Qidirmoqda</span>{(t.lookingFor.length ? t.lookingFor : ['—']).map((n) => <span key={n} className="tag solid">{n}</span>)}</div>
      <div className="row" style={{ gap: 8 }}>
        {t.isMember ? <Link href={t.chatId ? `/messages/${t.chatId}` : '/messages'} className="btn btn-outline" style={{ flex: 1 }}><Icon n="chat" size={18} />Jamoa chati</Link>
          : <Btn className="btn btn-primary" style={{ flex: 1 }} loading={busy} onClick={join}>Jamoaga qo‘shilish</Btn>}
        {!t.isMember && <button className="btn btn-outline" style={{ flex: 1 }} onClick={msgCaptain}>Sardorga yozish</button>}
      </div>
    </div>
  );
}

function TeamCreate({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', short: '', district: 'Yunusobod', level: 'intermediate', plays: '', lookingFor: [] as string[] });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const go = async () => {
    setBusy(true);
    try { await post('/teams', { ...f, plays: f.plays || undefined }); toast('Jamoa tuzildi · jamoa chati ochildi'); onDone(); onClose(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Jamoa tuzish">
      <div className="row" style={{ gap: 8 }}>
        <label className="field grow"><span>Nomi</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Yunusobod Lions" maxLength={40} /></label>
        <label className="field" style={{ width: 100 }}><span>Qisqa</span><input className="input" value={f.short} onChange={(e) => setF({ ...f, short: e.target.value.toUpperCase().slice(0, 3) })} placeholder="YL" /></label>
      </div>
      <label className="field"><span>Tuman</span><select className="select" value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })}>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></label>
      <div className="field"><span>Daraja</span><div className="row" style={{ gap: 8 }}>{(['beginner', 'intermediate', 'advanced'] as const).map((k) => <button key={k} className={`chip ${f.level === k ? 'on' : ''}`} onClick={() => setF({ ...f, level: k })}>{SKILL_LABEL[k]}</button>)}</div></div>
      <div className="field"><span>Kim kerak</span><div className="row wrap" style={{ gap: 8 }}>{['GK', 'DEF', 'MID', 'FWD'].map((k) => <button key={k} className={`chip ${f.lookingFor.includes(k) ? 'on' : ''}`} onClick={() => setF({ ...f, lookingFor: f.lookingFor.includes(k) ? f.lookingFor.filter((x) => x !== k) : [...f.lookingFor, k] })}>{k}</button>)}</div></div>
      <label className="field"><span>Qachon o‘ynaydi</span><input className="input" value={f.plays} onChange={(e) => setF({ ...f, plays: e.target.value })} placeholder="Payshanba kechqurun" /></label>
      <Btn className="btn btn-primary btn-block" loading={busy} disabled={f.name.trim().length < 2 || f.short.length < 2} onClick={go}>Jamoa tuzish</Btn>
    </Modal>
  );
}

function DiscoverInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>((sp.get('tab') as Tab) || 'players');
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [dq, setDq] = useState(q);
  const [pos, setPos] = useState<string[]>([]);
  const [skill, setSkill] = useState<string[]>([]);
  const [avail, setAvail] = useState<string[]>([]);
  const [tLevel, setTLevel] = useState<string[]>([]);
  const [tNeed, setTNeed] = useState<string[]>([]);
  const [mDate, setMDate] = useState<string[]>([]);
  const [mLevel, setMLevel] = useState<string[]>([]);
  const [mSpots, setMSpots] = useState<string[]>([]);
  const [mDistrict, setMDistrict] = useState<string[]>([]);
  const [invite, setInvite] = useState<PlayerT | null>(null);
  const [teamNew, setTeamNew] = useState(false);
  const inviteMatch = sp.get('invite');
  useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { router.replace(`/discover${qs({ tab: tab === 'players' ? undefined : tab, q: dq, invite: inviteMatch ?? undefined })}`, { scroll: false }); }, [tab, dq]);

  const players = useApi<{ items: PlayerT[] }>(`/players${qs({ q: dq, position: pos, skill, available: avail })}`);
  const teams = useApi<{ items: Team[] }>(`/teams${qs({ q: dq })}`);
  const today = todayStr();
  const sat = addDays(today, (5 - weekday(today) + 7) % 7), sun = addDays(today, (6 - weekday(today) + 7) % 7);
  const matches = useApi<{ items: MatchT[] }>(`/matches${qs({ date: mDate[0], level: mLevel[0], district: mDistrict[0] })}`);

  const teamItems = (teams.data?.items ?? []).filter((t) => (!tLevel.length || tLevel.includes(t.level)) && (!tNeed.length || tNeed.some((n) => t.lookingFor.includes(n) || t.lookingFor.includes('Har qanday'))));
  const matchItems = (matches.data?.items ?? []).filter((m) => !mSpots.length || m.filled < m.capacity);
  const counts = { players: players.data?.items.length ?? 0, teams: teamItems.length, matches: matchItems.length };

  const onInvite = async (p: PlayerT) => {
    if (inviteMatch) {
      try { const r = await post<{ chatId: string }>(`/matches/${inviteMatch}/invite`, { userId: p.id }); toast(`${p.name} ga taklif yuborildi`, { action: { label: 'Chatni ochish', fn: () => router.push(`/messages/${r.chatId}`) } }); }
      catch (e) { toast((e as Error).message, { kind: 'err' }); }
    } else setInvite(p);
  };
  const onMessage = async (p: PlayerT) => {
    try { const r = await post<{ id: string }>('/chats/dm', { userId: p.id }); router.push(`/messages/${r.id}`); } catch (e) { toast((e as Error).message, { kind: 'err' }); }
  };
  const clear = () => { setPos([]); setSkill([]); setAvail([]); setTLevel([]); setTNeed([]); setMDate([]); setMLevel([]); setMSpots([]); setMDistrict([]); setQ(''); };
  const emptyBlock = (
    <div className="col" style={{ padding: '56px 24px', borderRadius: 20, border: '1.5px dashed var(--border-strong)', alignItems: 'center', gap: 12, textAlign: 'center' }}>
      <Icon n="travel_explore" size={40} style={{ color: 'var(--text-3)' }} />
      <div style={{ fontSize: 18, fontWeight: 700 }}>Hozircha hech narsa topilmadi</div>
      <div className="c2" style={{ fontSize: 15, maxWidth: 380 }}>Filtrlarni kengaytiring yoki o‘zingiz o‘yin oching – o‘yinchilar sizni topadi.</div>
      <div className="row" style={{ gap: 8 }}><button className="btn btn-outline" onClick={clear}>Filtrlarni tozalash</button><Link href="/stadiums" className="btn btn-primary">O‘yin ochish</Link></div>
    </div>
  );
  const grid = { display: 'grid', gridTemplateColumns: `repeat(auto-fill,minmax(${tab === 'players' ? 280 : 320}px,1fr))`, gap: 16 } as const;

  return (
    <div className="page col" style={{ gap: 24 }}>
      <div className="row between wrap" style={{ gap: 16, alignItems: 'flex-end' }}>
        <div className="col" style={{ gap: 6 }}>
          <div className="label">Toshkent · 5 km radiusda</div>
          <h1 className="t-h2" style={{ fontSize: 36, lineHeight: '40px', fontWeight: 800, letterSpacing: '-.02em' }}>O‘yiningizni toping</h1>
        </div>
        <div className="search" style={{ width: 'min(420px,100%)' }}><Icon n="search" size={22} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'players' ? 'O‘yinchini ism yoki tuman bo‘yicha qidirish' : tab === 'teams' ? 'Jamoalarni qidirish' : 'O‘yin yoki stadionni qidirish'} aria-label="Qidirish" /></div>
      </div>
      {inviteMatch && tab === 'players' && <div className="row well" style={{ padding: '12px 14px', gap: 10, fontSize: 14 }}><Icon n="group_add" style={{ color: 'var(--accent)' }} />O‘yiningizga taklif qilish uchun o‘yinchilarni tanlang.<Link href={`/matches/${inviteMatch}`} style={{ marginLeft: 'auto', fontWeight: 600 }}>O‘yinni ko‘rish</Link></div>}
      <div className="tabs scroll-x" role="tablist">
        {([['players', 'O‘yinchilar'], ['teams', 'Jamoalar'], ['matches', 'O‘yinlar']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'on' : ''}`} style={{ fontSize: 17, fontWeight: 700 }} onClick={() => setTab(k)}>{l}<span className="n">{counts[k]}</span></button>
        ))}
        {tab === 'teams' && <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto', marginBottom: 8 }} onClick={() => setTeamNew(true)}><Icon n="add" size={18} />Jamoa tuzish</button>}
      </div>

      {tab === 'players' && (
        <>
          <Filters groups={[
            { label: 'Pozitsiya', opts: [['GK', 'GK'], ['DEF', 'DEF'], ['MID', 'MID'], ['FWD', 'FWD']], value: pos, set: setPos },
            { label: 'Daraja', opts: [['beginner', 'Boshlang‘ich'], ['intermediate', 'O‘rta'], ['advanced', 'Yuqori']], value: skill, set: setSkill },
            { label: 'Bo‘sh vaqti', opts: [['tonight', 'Bugun kechqurun'], ['fri', 'Juma'], ['weekends', 'Dam olish kunlari']], value: avail, set: setAvail },
          ]} />
          {players.error ? <ErrorState error={players.error} onRetry={players.reload} /> : !players.data ? <Loading rows={3} /> : !players.data.items.length ? emptyBlock : (
            <div style={grid}>{players.data.items.map((p) => <PlayerCard key={p.id} p={p} onInvite={onInvite} onMessage={onMessage} />)}</div>
          )}
        </>
      )}
      {tab === 'teams' && (
        <>
          <Filters groups={[
            { label: 'Daraja', opts: [['beginner', 'Boshlang‘ich'], ['intermediate', 'O‘rta'], ['advanced', 'Yuqori']], value: tLevel, set: setTLevel },
            { label: 'Kim kerak', opts: [['GK', 'GK'], ['DEF', 'DEF'], ['MID', 'MID'], ['FWD', 'FWD']], value: tNeed, set: setTNeed },
          ]} />
          {teams.error ? <ErrorState error={teams.error} onRetry={teams.reload} /> : !teams.data ? <Loading rows={3} /> : !teamItems.length ? emptyBlock : (
            <div style={grid}>{teamItems.map((t) => <TeamCard key={t.id} t={t} onChange={teams.reload} />)}</div>
          )}
        </>
      )}
      {tab === 'matches' && (
        <>
          <Filters groups={[
            { label: 'Sana', opts: [[today, 'Bugun'], [addDays(today, 1), 'Ertaga'], ...(sat > addDays(today, 1) ? [[sat, 'Shanba'] as [string, string]] : []), ...(sun > addDays(today, 1) ? [[sun, 'Yakshanba'] as [string, string]] : [])], value: mDate, set: setMDate, single: true },
            { label: 'Daraja', opts: [['beginner', 'Boshlang‘ich'], ['intermediate', 'O‘rta'], ['advanced', 'Yuqori']], value: mLevel, set: setMLevel, single: true },
            { label: 'Joy', opts: [['open', 'Bo‘sh joyi bor']], value: mSpots, set: setMSpots },
            { label: 'Tuman', opts: DISTRICTS.slice(0, 6).map((d) => [d, d] as [string, string]), value: mDistrict, set: setMDistrict, single: true },
          ]} />
          {matches.error ? <ErrorState error={matches.error} onRetry={matches.reload} /> : !matches.data ? <Loading rows={3} /> : !matchItems.length ? emptyBlock : (
            <div style={grid}>{matchItems.map((m) => <MatchCard key={m.id} m={m} />)}</div>
          )}
        </>
      )}
      <InviteModal user={invite} onClose={() => setInvite(null)} />
      <TeamCreate open={teamNew} onClose={() => setTeamNew(false)} onDone={teams.reload} />
    </div>
  );
}

export default function DiscoverPage() {
  return <Suspense><DiscoverInner /></Suspense>;
}
