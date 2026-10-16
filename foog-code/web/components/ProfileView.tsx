'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Async, Avatar, Btn, Empty, ErrorState, Icon, Loading, Modal } from '@/components/ui';
import { InviteModal } from '@/components/invite';
import { Verified, type MiniUser } from '@/components/social';
import { useApi } from '@/lib/useApi';
import { post } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { AVAIL_LABEL, FOOT_LABEL, MONTHS_SHORT, POS_LABEL, SIZE_LABEL, SKILL_LABEL, compact, dayMonthShort, dec, num } from '@/lib/format';

type Prof = {
  user: MiniUser & { bio: string | null; position: string | null; foot: string | null; district: string | null; level: number; xp: number; skill: string | null; jersey: number | null; available: string[]; coverUrl: string | null; role: string };
  me: boolean; followers: number; following: number; isFollowing: boolean; followsMe: boolean; mutual: { id: string; name: string; avatarUrl: string | null }[]; mutualCount: number;
  team: { id: string; name: string; captain: boolean } | null; stats: { matches: number; goals: number; assists: number; mvp: number; rating: number }; nextXp: number; prevXp: number;
};
type Tab = 'posts' | 'reels' | 'matches' | 'stats' | 'ach';

function Posts({ u }: { u: string }) {
  const q = useApi<{ items: { id: string; text: string; mediaUrl: string | null; mediaType: string | null; likes: number; stats: { result: string; goals: number } | null; kind: string }[] }>(`/users/${u}/posts`);
  return <Async q={q} empty={(d) => !d.items.length && <Empty icon="grid_view" title="Hali post yo‘q" />}>{(d) => (
    <div className="pf-grid">{d.items.map((p) => (
      <Link key={p.id} href="/home" className="pf-tile" style={{ background: p.mediaUrl && p.mediaType !== 'video' ? `center/cover url("${p.mediaUrl}")` : 'var(--ph)' }}>
        {(!p.mediaUrl || p.mediaType === 'video') && <span style={{ position: 'absolute', inset: 16, fontSize: 15, lineHeight: 1.45, color: 'var(--text-1)', overflow: 'hidden' }}>{p.text}</span>}
        <span className="pf-tile-meta"><Icon n="favorite" size={16} />{compact(p.likes)}{p.stats && <span>{p.stats.result} · {p.stats.goals}G</span>}</span>
      </Link>
    ))}</div>
  )}</Async>;
}

function Reels({ u, me }: { u: string; me: boolean }) {
  const q = useApi<{ items: { id: string; caption: string; posterUrl: string | null; status: string; views: number; likes: number }[] }>(`/users/${u}/reels`);
  return <Async q={q} empty={(d) => !d.items.length && <Empty icon="smart_display" title="Hali reel yo‘q" action={me ? <Link href="/reels?upload=1" className="btn btn-primary btn-sm">Reel joylash</Link> : undefined} />}>{(d) => (
    <div className="pf-grid reels">{d.items.map((r) => (
      <Link key={r.id} href={r.status === 'published' ? `/reels?start=${r.id}` : '#'} className="pf-tile" style={{ aspectRatio: '9/16', background: r.posterUrl ? `center/cover url("${r.posterUrl}")` : 'var(--ph)' }}>
        {r.status !== 'published' && <span className={`pill-tag ${r.status === 'failed' ? 'error' : 'warning'}`} style={{ position: 'absolute', top: 10, left: 10 }}>{r.status === 'failed' ? 'Xato' : 'Qayta ishlanmoqda'}</span>}
        <span className="pf-tile-meta"><Icon n="play_arrow" size={16} />{compact(r.views)}</span>
      </Link>
    ))}</div>
  )}</Async>;
}

function Matches({ u }: { u: string }) {
  const q = useApi<{ items: { id: string; title: string; status: string; date: string; start: string; stadium: string; size: string; home: string; away: string; homeScore: number | null; awayScore: number | null; goals: number; assists: number; mvp: boolean; result: 'W' | 'D' | 'L' | null }[] }>(`/users/${u}/matches`);
  const R = { W: ['G', 'var(--success)'], D: ['D', 'var(--text-2)'], L: ['M', 'var(--error)'] } as const;
  return <Async q={q} empty={(d) => !d.items.length && <Empty icon="sports_soccer" title="Hali o‘yin yo‘q" text="Izlash → O‘yinlar bo‘limidan ochiq o‘yinga qo‘shiling." />}>{(d) => (
    <div className="col" style={{ gap: 10 }}>{d.items.map((m) => (
      <Link key={m.id} href={`/matches/${m.id}`} className="card row" style={{ padding: '14px 18px', gap: 14, color: 'var(--text-1)' }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 14px var(--font-mono)', background: m.result ? `color-mix(in oklch, ${R[m.result][1]} 18%, transparent)` : 'var(--surface-2)', color: m.result ? R[m.result][1] : 'var(--text-2)', flexShrink: 0 }}>{m.result ? R[m.result][0] : '·'}</span>
        <div className="col grow"><b className="ellipsis" style={{ fontSize: 15 }}>{m.status === 'done' ? `${m.home} ${m.homeScore}–${m.awayScore} ${m.away}` : m.title}</b><span className="mono c2" style={{ fontSize: 12 }}>{dayMonthShort(m.date)} · {m.start} · {m.stadium} · {SIZE_LABEL[m.size]}</span></div>
        {m.status === 'done' ? <span className="mono c2" style={{ fontSize: 13, flexShrink: 0 }}>{m.goals}G {m.assists}A{m.mvp && <span className="pill-tag volt" style={{ marginLeft: 8, height: 20 }}>MVP</span>}</span> : <span className="pill-tag accent">Kelgusi</span>}
      </Link>
    ))}</div>
  )}</Async>;
}

function Stats({ u }: { u: string }) {
  const q = useApi<{ matches: number; goals: number; assists: number; mvp: number; rating: number; wins: number; draws: number; losses: number; cleanSheets: number; winRate: number; goalsPerMatch: number; months: { month: string; goals: number; assists: number; matches: number }[] }>(`/users/${u}/stats`);
  return <Async q={q}>{(s) => {
    const max = Math.max(1, ...s.months.map((m) => m.goals + m.assists));
    const tot = Math.max(1, s.wins + s.draws + s.losses);
    return (
      <div className="pf-stats">
        <div className="card col" style={{ padding: 20, gap: 16 }}>
          <span className="label-sm">Mavsum {new Date().getFullYear()}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {([[s.matches, 'O‘yin'], [s.goals, 'Gol'], [s.assists, 'Assist'], [`${s.winRate}%`, 'G‘alaba'], [s.mvp, 'MVP'], [dec(s.rating), 'Reyting']] as const).map(([v, l]) => <div key={l} className="col"><span className="mono" style={{ fontSize: 26 }}>{v}</span><span className="c2 t-cap">{l}</span></div>)}
          </div>
        </div>
        <div className="card col" style={{ padding: 20, gap: 12 }}>
          <span className="label-sm">Gol + assist · oylar bo‘yicha</span>
          {!s.months.length ? <p className="c2 t-small">Hali yakunlangan o‘yin yo‘q.</p> : (
            <>
              <div className="row" style={{ alignItems: 'flex-end', gap: 8, height: 120 }}>
                {s.months.map((m) => (
                  <div key={m.month} className="col" style={{ flex: 1, gap: 2, justifyContent: 'flex-end', height: '100%' }} title={`${m.goals} gol, ${m.assists} assist`}>
                    <div style={{ height: `${(m.assists / max) * 100}%`, background: 'var(--accent)', borderRadius: '6px 6px 0 0', minHeight: m.assists ? 4 : 0 }} />
                    <div style={{ height: `${(m.goals / max) * 100}%`, background: 'var(--primary)', borderRadius: m.assists ? 0 : '6px 6px 0 0', minHeight: m.goals ? 4 : 0 }} />
                  </div>
                ))}
              </div>
              <div className="row" style={{ gap: 8 }}>{s.months.map((m) => <span key={m.month} className="mono c3" style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>{MONTHS_SHORT[Number(m.month.slice(5)) - 1]}</span>)}</div>
              <div className="row c2" style={{ gap: 14, fontSize: 13 }}><span className="row" style={{ gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--primary)' }} />Gol</span><span className="row" style={{ gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent)' }} />Assist</span></div>
            </>
          )}
        </div>
        <div className="card col" style={{ padding: 20, gap: 12 }}>
          <span className="label-sm">Natijalar va ko‘rsatkichlar</span>
          {([['G‘alaba', s.wins, 'var(--success)'], ['Durang', s.draws, 'var(--text-3)'], ['Mag‘lubiyat', s.losses, 'var(--error)']] as const).map(([l, v, c]) => (
            <div key={l} className="row" style={{ gap: 12, fontSize: 14 }}><span className="c2" style={{ width: 96 }}>{l}</span><div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--surface-2)' }}><div style={{ width: `${(v / tot) * 100}%`, height: '100%', borderRadius: 999, background: c }} /></div><span className="mono" style={{ width: 24, textAlign: 'right' }}>{v}</span></div>
          ))}
          <div className="row between t-small"><span className="c2">Gol / o‘yin</span><span className="mono">{dec(s.goalsPerMatch, 2)}</span></div>
          <div className="row between t-small"><span className="c2">Quruq o‘yinlar</span><span className="mono">{s.cleanSheets}</span></div>
        </div>
      </div>
    );
  }}</Async>;
}

function Achievements({ u }: { u: string }) {
  const q = useApi<{ items: { id: string; title: string; description: string; icon: string; rarity: string; goal: number; progress: number; earnedAt: string | null; share: number }[] }>(`/users/${u}/achievements`);
  return <Async q={q}>{(d) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
      {d.items.map((a) => {
        const on = !!a.earnedAt;
        return (
          <div key={a.id} className="card col" style={{ padding: 20, gap: 10, alignItems: 'center', textAlign: 'center', opacity: on ? 1 : 0.75 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', padding: 4, background: on ? 'var(--primary)' : 'var(--border-strong)' }}><div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: on ? 'var(--brand-ink)' : 'var(--text-3)' }}><Icon n={on ? a.icon : 'lock'} fill={on} size={30} /></div></div>
            <b style={{ fontSize: 15 }}>{a.title}</b>
            <span className="c2 t-cap">{a.description}</span>
            {on ? <span className="mono c3" style={{ fontSize: 11 }}>{a.rarity} · {a.share}% o‘yinchilarda</span> : (
              <div className="col" style={{ gap: 4, width: '100%' }}><div style={{ height: 4, borderRadius: 999, background: 'var(--surface-2)' }}><div style={{ width: `${(a.progress / a.goal) * 100}%`, height: '100%', borderRadius: 999, background: 'var(--accent)' }} /></div><span className="mono c3" style={{ fontSize: 11 }}>{a.progress} / {a.goal}</span></div>
            )}
          </div>
        );
      })}
    </div>
  )}</Async>;
}

function People({ u, list, onClose }: { u: string; list: 'followers' | 'following' | null; onClose: () => void }) {
  const q = useApi<{ items: MiniUser[] }>(list ? `/users/${u}/${list}` : null, [list]);
  return (
    <Modal open={!!list} onClose={onClose} title={list === 'followers' ? 'Kuzatuvchilar' : 'Kuzatilmoqda'}>
      <div className="col" style={{ gap: 10, maxHeight: '60vh', overflowY: 'auto' }}>
        {q.loading ? <Loading rows={3} card={false} /> : q.error ? <ErrorState error={q.error} /> : !q.data?.items.length ? <Empty icon="group" title="Ro‘yxat bo‘sh" /> : q.data.items.map((p) => (
          <Link key={p.id} href={`/u/${p.username}`} onClick={onClose} className="row" style={{ gap: 12, color: 'var(--text-1)' }}><Avatar name={p.name} url={p.avatarUrl} size={40} /><span className="col"><b style={{ fontSize: 15 }}>{p.name}</b><span className="c2 t-cap">@{p.username}</span></span></Link>
        ))}
      </div>
    </Modal>
  );
}

export function ProfileView({ username }: { username: string }) {
  const q = useApi<Prof>(`/users/${username}`);
  const [tab, setTab] = useState<Tab>('posts');
  const [invite, setInvite] = useState(false);
  const [list, setList] = useState<'followers' | 'following' | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  return (
    <Async q={q}>{(p) => {
      const u = p.user;
      const pct = Math.min(100, ((u.xp - p.prevXp) / Math.max(1, p.nextXp - p.prevXp)) * 100);
      const follow = async () => {
        setBusy(true);
        try { const r = await post<{ following: boolean; followers: number }>(`/users/${u.username}/follow`); q.setData({ ...p, isFollowing: r.following, followers: r.followers }); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
      };
      const message = async () => {
        try { const r = await post<{ id: string }>('/chats/dm', { userId: u.id }); router.push(`/messages/${r.id}`); } catch (e) { toast((e as Error).message, { kind: 'err' }); }
      };
      const chips: [string, string][] = [
        ...(u.position ? [['sports_soccer', `${u.position} · ${POS_LABEL[u.position] ?? ''}`] as [string, string]] : []),
        ...(u.foot ? [['footprint', FOOT_LABEL[u.foot]] as [string, string]] : []),
        ['location_on', u.district ?? 'Toshkent'],
        ...(u.jersey ? [['apparel', String(u.jersey)] as [string, string]] : []),
        ...(u.available.length ? [['schedule', `Bo‘sh: ${u.available.map((a) => AVAIL_LABEL[a] ?? a).join(', ')}`] as [string, string]] : []),
      ];
      return (
        <div className="pf-wrap">
          <div className="pf-cover ph" style={{ background: u.coverUrl ? `center/cover url("${u.coverUrl}")` : undefined }} />
          <div className="pf-head">
            <div className="pf-av"><Avatar name={u.name} url={u.avatarUrl} size={132} ring="var(--primary)" /></div>
            <div className="row wrap pf-actions" style={{ gap: 8 }}>
              {p.me ? (
                <>
                  <Link href="/profile/edit" className="btn btn-inverse btn-lg"><Icon n="edit" />Profilni tahrirlash</Link>
                  <Link href="/reels?upload=1" className="btn btn-primary btn-lg"><Icon n="add" />Reel joylash</Link>
                </>
              ) : (
                <>
                  <Btn className={`btn btn-lg ${p.isFollowing ? 'btn-outline' : 'btn-inverse'}`} loading={busy} onClick={follow}><Icon n={p.isFollowing ? 'how_to_reg' : 'person_add'} />{p.isFollowing ? 'Kuzatilmoqda' : p.followsMe ? 'Javoban kuzatish' : 'Kuzatish'}</Btn>
                  <button className="btn btn-outline btn-lg" onClick={message}><Icon n="chat_bubble" />Xabar yozish</button>
                  <button className="btn btn-primary btn-lg" onClick={() => setInvite(true)}><Icon n="sports_soccer" />O‘yinga taklif</button>
                </>
              )}
            </div>
          </div>
          <div className="pf-info">
            <div className="col" style={{ gap: 14, minWidth: 0 }}>
              <div className="col" style={{ gap: 4 }}>
                <h1 className="row" style={{ gap: 8, fontSize: 36, lineHeight: '40px', fontWeight: 800, letterSpacing: '-.02em' }}>{u.name}{u.verified && <Icon n="verified" fill size={28} style={{ color: 'var(--accent)' }} />}</h1>
                <div className="c2" style={{ fontSize: 16 }}>@{u.username}{p.team && <> · <b style={{ color: 'var(--text-1)' }}>{p.team.name}</b>{p.team.captain && ' · Sardor'}</>}</div>
              </div>
              {u.bio && <p style={{ fontSize: 16, lineHeight: 1.55, maxWidth: 580 }}>{u.bio}</p>}
              <div className="row wrap" style={{ gap: 6 }}>{chips.map(([ic, t], i) => <span key={t} className={`tag ${i === 0 ? 'solid' : ''}`} style={{ height: 30, padding: '0 12px', fontSize: 12, gap: 8 }}><Icon n={ic} size={16} />{t}</span>)}</div>
              <div className="row wrap" style={{ gap: 24, fontSize: 15 }}>
                <button onClick={() => setList('followers')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-1)', minHeight: 32 }}><span className="mono" style={{ fontWeight: 500 }}>{num(p.followers)}</span> <span className="c2">kuzatuvchi</span></button>
                <button onClick={() => setList('following')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-1)', minHeight: 32 }}><span className="mono" style={{ fontWeight: 500 }}>{num(p.following)}</span> <span className="c2">kuzatilmoqda</span></button>
                {!!p.mutualCount && <span className="row c2" style={{ gap: 8 }}><span className="row">{p.mutual.map((m, i) => <span key={m.id} style={{ marginLeft: i ? -8 : 0, borderRadius: '50%', boxShadow: '0 0 0 2px var(--bg)', display: 'inline-flex' }}><Avatar name={m.name} url={m.avatarUrl} size={24} /></span>)}</span>{p.mutual.map((m) => m.name.split(' ')[0]).join(', ')}{p.mutualCount > p.mutual.length ? ` + ${p.mutualCount - p.mutual.length} umumiy` : ' umumiy'}</span>}
              </div>
            </div>
            <div className="card col" style={{ padding: 20, gap: 14, alignSelf: 'start' }}>
              <div className="row between">
                <div className="row" style={{ gap: 12 }}><span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary)', color: 'var(--on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 16px var(--font-mono)' }}>{u.level}</span><div className="col"><b>{SKILL_LABEL[u.skill ?? ''] ?? `${u.level}-daraja`}</b><span className="mono c2" style={{ fontSize: 12 }}>{num(u.xp)} / {num(p.nextXp)} XP</span></div></div>
                <span className="label-sm c3">O‘yinchi darajasi</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-2)' }}><div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'var(--primary)' }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {([[p.stats.matches, 'O‘yin', ''], [p.stats.goals, 'Gol', 'ink'], [p.stats.assists, 'Assist', ''], [p.stats.mvp, 'MVP', '']] as const).map(([v, l, c]) => <div key={l} className="col"><span className={`mono ${c}`} style={{ fontSize: 24 }}>{v}</span><span className="c2 t-cap">{l}</span></div>)}
              </div>
            </div>
          </div>
          <div className="tabs scroll-x" role="tablist" style={{ marginTop: 8 }}>
            {([['posts', 'grid_view', 'Postlar'], ['reels', 'smart_display', 'Reels'], ['matches', 'sports_soccer', 'O‘yinlar'], ['stats', 'monitoring', 'Statistika'], ['ach', 'trophy', 'Yutuqlar']] as const).map(([k, ic, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'on' : ''}`} style={{ fontSize: 16 }} onClick={() => setTab(k)}><Icon n={ic} size={20} fill={tab === k} />{l}</button>
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            {tab === 'posts' && <Posts u={u.username!} />}
            {tab === 'reels' && <Reels u={u.username!} me={p.me} />}
            {tab === 'matches' && <Matches u={u.username!} />}
            {tab === 'stats' && <Stats u={u.username!} />}
            {tab === 'ach' && <Achievements u={u.username!} />}
          </div>
          {invite && <InviteModal user={{ id: u.id, name: u.name, avatarUrl: u.avatarUrl }} onClose={() => setInvite(false)} />}
          <People u={u.username!} list={list} onClose={() => setList(null)} />
        </div>
      );
    }}</Async>
  );
}

