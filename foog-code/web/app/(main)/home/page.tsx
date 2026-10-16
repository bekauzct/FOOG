'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Async, Avatar, Empty, ErrorState, Icon, Loading, Skeleton } from '@/components/ui';
import { Composer, PostCard, StoryCreate, StoryViewer, type MiniUser, type PostT, type StoryGroup } from '@/components/social';
import { MatchMini, UpcomingDate, type MatchT } from '@/components/cards';
import { useApi } from '@/lib/useApi';
import { get, post } from '@/lib/api';
import { useSession } from '@/lib/session';
import { DOW_FULL, dayMonth, dec, greeting, num, sum, weekday, todayStr, SIZE_LABEL, BOOKING_STATUS, relDay } from '@/lib/format';
import { useToast } from '@/lib/toast';

type HomeT = {
  greetingHour: number; date: string; matchesTonight: number;
  week: { matches: number; goals: number; hours: number; level: number; xp: number; nextXp: number };
  upcoming: { kind: 'booking' | 'match'; id: string; date: string; start: string; title: string; size: string; status: string }[];
  openMatches: MatchT[];
  stadiums: { id: string; name: string; distanceKm: number; freeSlots: number; price: number; photo: string | null }[];
  suggested: (MiniUser & { level: number; mutual: number })[];
  news: null | { id: string; title: string; date: string; stadium: string; home: string; homeShort: string; away: string; awayShort: string; homeScore: number | null; awayScore: number | null; mvp: MiniUser | null; followed: number; scorer: { name: string; goals: number } | null };
};

function Card({ title, link, href, children }: { title: string; link?: string; href?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row between"><div className="t-card">{title}</div>{link && href && <Link href={href} style={{ fontSize: 14, fontWeight: 600 }}>{link}</Link>}</div>
      {children}
    </div>
  );
}

function Upcoming({ d }: { d: HomeT }) {
  return (
    <Card title="Yaqin bronlar" link="Hammasi" href="/bookings">
      {!d.upcoming.length ? (
        <div className="col" style={{ gap: 10 }}><p className="c2 t-small">Kelgusi bron yoki o‘yin yo‘q.</p><Link href="/stadiums" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }}>Stadion topish</Link></div>
      ) : d.upcoming.map((u) => {
        const today = u.date === todayStr();
        const [st] = BOOKING_STATUS[u.status] ?? ['O‘yin'];
        return (
          <Link key={u.kind + u.id} href={u.kind === 'match' ? `/matches/${u.id}` : '/bookings'} className="row" style={{ gap: 12, padding: 10, margin: '0 -10px', borderRadius: 14, color: 'var(--text-1)' }}>
            <UpcomingDate date={u.date} />
            <div className="col grow" style={{ gap: 3 }}>
              <div className="ellipsis" style={{ fontSize: 15, fontWeight: 700 }}>{u.title}</div>
              <div className="mono c2 ellipsis" style={{ fontSize: 13 }}>{u.start} · {SIZE_LABEL[u.size]} · {u.kind === 'match' ? 'O‘yin' : st}</div>
            </div>
            <span className={`pill-tag ${today ? 'volt' : 'muted'}`} style={{ fontSize: 10, height: 22, padding: '0 8px' }}>{today ? 'Bugun' : relDay(u.date) === 'Ertaga' ? 'Ertaga' : DOW_FULL[weekday(u.date)].slice(0, 2)}</span>
          </Link>
        );
      })}
    </Card>
  );
}

function OpenMatches({ d }: { d: HomeT }) {
  return (
    <Card title="Yaqin atrofdagi ochiq o‘yinlar" link="Ko‘proq" href="/discover?tab=matches">
      {!d.openMatches.length ? <p className="c2 t-small">Hozircha ochiq o‘yin yo‘q. O‘zingiz bron qilib, o‘yin oching.</p> : d.openMatches.map((m) => <MatchMini key={m.id} m={m} />)}
    </Card>
  );
}

function Stadiums({ d }: { d: HomeT }) {
  return (
    <Card title="Yaqin stadionlar" link="Xarita" href="/stadiums?view=map">
      {d.stadiums.map((s) => (
        <Link key={s.id} href={`/stadiums/${s.id}`} className="row" style={{ gap: 12, color: 'var(--text-1)' }}>
          <div className="ph" style={{ width: 72, height: 56, borderRadius: 12, flexShrink: 0, background: s.photo ? `center/cover url("${s.photo}")` : undefined }} />
          <div className="col grow" style={{ gap: 3 }}>
            <div className="row between" style={{ gap: 8 }}><div className="ellipsis" style={{ fontSize: 15, fontWeight: 700 }}>{s.name}</div><div className="mono" style={{ fontSize: 13, fontWeight: 500, flexShrink: 0 }}>{sum(s.price)}</div></div>
            <div className="row c2" style={{ gap: 6, fontSize: 13 }}><span className="dot" style={{ color: s.freeSlots > 3 ? 'var(--success)' : s.freeSlots ? 'var(--warning)' : 'var(--error)' }} />{dec(s.distanceKm)} km · {s.freeSlots ? `bugun ${s.freeSlots} ta bo‘sh soat` : 'bugun band'}</div>
          </div>
        </Link>
      ))}
    </Card>
  );
}

function Suggested({ d }: { d: HomeT }) {
  const [f, setF] = useState<Record<string, boolean>>({});
  const toast = useToast();
  if (!d.suggested.length) return null;
  return (
    <Card title="Kuzatish uchun o‘yinchilar">
      {d.suggested.map((s) => {
        const on = f[s.id];
        return (
          <div key={s.id} className="row" style={{ gap: 12 }}>
            <Link href={`/u/${s.username}`}><Avatar name={s.name} url={s.avatarUrl} size={40} /></Link>
            <Link href={`/u/${s.username}`} className="col grow" style={{ color: 'var(--text-1)' }}>
              <div className="ellipsis" style={{ fontSize: 15, fontWeight: 700 }}>{s.name}</div>
              <div className="c2 ellipsis" style={{ fontSize: 13 }}>{[s.position, s.district, s.mutual ? `${s.mutual} umumiy` : `${s.level}-daraja`].filter(Boolean).join(' · ')}</div>
            </Link>
            <button className={`btn btn-sm ${on ? 'btn-outline' : 'btn-inverse'}`} onClick={async () => { setF((x) => ({ ...x, [s.id]: !on })); try { await post(`/users/${s.username}/follow`); } catch (e) { toast((e as Error).message, { kind: 'err' }); setF((x) => ({ ...x, [s.id]: on })); } }}>{on ? 'Kuzatilmoqda' : 'Kuzatish'}</button>
          </div>
        );
      })}
    </Card>
  );
}

function News({ n }: { n: NonNullable<HomeT['news']> }) {
  return (
    <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row between" style={{ gap: 8 }}>
        <span className="pill-tag volt"><span className="dot" />Yakuniy hisob</span>
        <div className="c2 ellipsis" style={{ fontSize: 13 }}>{n.stadium} · {dayMonth(n.date)}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 16 }}>
        <div className="row" style={{ gap: 10 }}><div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--inverse)', color: 'var(--on-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 14px var(--font-ui)', flexShrink: 0 }}>{n.homeShort}</div><div className="ellipsis" style={{ fontSize: 16, fontWeight: 700 }}>{n.home}</div></div>
        <div className="mono" style={{ fontSize: 34, fontWeight: 500, letterSpacing: '-.02em', whiteSpace: 'nowrap' }}>{n.homeScore}<span className="c3"> – </span>{n.awayScore}</div>
        <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}><div className="ellipsis" style={{ fontSize: 16, fontWeight: 700, textAlign: 'right' }}>{n.away}</div><div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 14px var(--font-ui)', flexShrink: 0 }}>{n.awayShort}</div></div>
      </div>
      <div className="row between" style={{ paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 14, gap: 8 }}>
        <span className="c2"><Icon n="sports_soccer" size={16} style={{ verticalAlign: -3, color: 'var(--brand-ink)' }} /> {n.scorer ? `${n.scorer.name} – ${n.scorer.goals} gol` : n.title}{n.mvp ? ` · MVP: ${n.mvp.name}` : ''}{n.followed ? ` · ${n.followed} ta kuzatganingiz o‘ynadi` : ''}</span>
        <Link href={`/matches/${n.id}`} style={{ fontWeight: 600, flexShrink: 0 }}>O‘yinni ko‘rish</Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { me } = useSession();
  const router = useRouter();
  const home = useApi<HomeT>('/home');
  const stories = useApi<{ mine: StoryGroup | null; items: StoryGroup[] }>('/stories');
  const [tab, setTab] = useState<'foryou' | 'following' | 'nearby'>('foryou');
  const [posts, setPosts] = useState<PostT[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [feedErr, setFeedErr] = useState<{ message: string; status?: number } | null>(null);
  const [more, setMore] = useState(false);
  const [compose, setCompose] = useState<null | 'post' | 'result' | 'find_players'>(null);
  const [story, setStory] = useState<StoryGroup | null>(null);
  const [addStory, setAddStory] = useState(false);

  const loadFeed = async (cursor?: string) => {
    setFeedErr(null);
    if (!cursor) setPosts(null);
    else setMore(true);
    try {
      const r = await get<{ items: PostT[]; next: string | null }>(`/feed?tab=${tab}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      setPosts((p) => (cursor ? [...(p ?? []), ...r.items] : r.items));
      setNext(r.next);
    } catch (e) { setFeedErr(e as Error); } finally { setMore(false); }
  };
  useEffect(() => { loadFeed(); }, [tab]);

  const h = home.data;
  const first = me?.name.split(' ')[0] ?? '';
  const today = todayStr();
  return (
    <div className="home-grid">
      <aside className="home-left">
        <button className="btn btn-inverse btn-lg btn-block" onClick={() => setCompose('post')}><Icon n="add" />Yaratish</button>
        <div className="card" style={{ marginTop: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, borderRadius: 16 }}>
          {!h ? <Skeleton h={90} /> : (
            <>
              <div className="row between"><div className="label-sm">Bu hafta</div><div className="mono ink" style={{ fontSize: 11, fontWeight: 500 }}>LVL {h.week.level}</div></div>
              <div className="row" style={{ gap: 16 }}>
                {([[h.week.matches, 'O‘yin'], [h.week.goals, 'Gol'], [`${h.week.hours}s`, 'O‘ynadi']] as const).map(([v, l]) => <div key={l}><div className="mono" style={{ fontSize: 22, fontWeight: 500 }}>{v}</div><div className="c2" style={{ fontSize: 12 }}>{l}</div></div>)}
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}><div style={{ width: `${Math.min(100, ((h.week.xp - (h.week.level - 1) * 500) / 500) * 100)}%`, height: '100%', background: 'var(--primary)', borderRadius: 999 }} /></div>
              <div className="c2" style={{ fontSize: 12 }}>{num(Math.max(0, h.week.nextXp - h.week.xp))} XP – {h.week.level + 1}-darajagacha</div>
            </>
          )}
        </div>
      </aside>

      <main className="col" style={{ gap: 20, padding: '28px 0 80px', maxWidth: 640, width: '100%', justifySelf: 'center' }}>
        <div className="col" style={{ gap: 6 }}>
          <div className="label">{dayMonth(today)}, {DOW_FULL[weekday(today)]} · Toshkent</div>
          <h1 className="t-page" style={{ textWrap: 'pretty' } as React.CSSProperties}>
            {greeting(h?.greetingHour)}, {first}.{' '}
            {h && <span className="c2">{h.matchesTonight ? `Bugun kechqurun yaqin atrofda ${h.matchesTonight} ta o‘yin.` : 'Bugun o‘yin oching yoki qo‘shiling.'}</span>}
          </h1>
        </div>

        <div className="scroll-x" style={{ display: 'flex', gap: 14, padding: '4px 2px 6px' }}>
          <button onClick={() => (stories.data?.mine ? setStory(stories.data.mine) : setAddStory(true))} className="col" style={{ alignItems: 'center', gap: 6, width: 68, flexShrink: 0, background: 'none', border: 'none', color: 'var(--text-2)', padding: 0 }}>
            {stories.data?.mine ? <Avatar name={me?.name} url={me?.avatarUrl} size={64} ring="var(--primary)" /> : (
              <span style={{ width: 64, height: 64, borderRadius: '50%', border: '2px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n="add" size={26} /></span>
            )}
            <span style={{ fontSize: 12 }}>Hikoyangiz</span>
          </button>
          {stories.loading && !stories.data && Array.from({ length: 5 }, (_, i) => <Skeleton key={i} h={64} w={64} r={32} style={{ flexShrink: 0 }} />)}
          {stories.data?.items.map((g, i) => (
            <button key={g.author.id} onClick={() => setStory(g)} className="col" style={{ alignItems: 'center', gap: 6, width: 68, flexShrink: 0, background: 'none', border: 'none', color: 'var(--text-1)', padding: 0, position: 'relative' }}>
              <Avatar name={g.author.name} url={g.author.avatarUrl} size={64} ring={i < 4 ? 'var(--primary)' : 'var(--border-strong)'} />
              {g.live && <span style={{ position: 'absolute', left: '50%', top: 54, transform: 'translateX(-50%)', height: 16, padding: '0 6px', borderRadius: 999, background: 'var(--primary)', color: 'var(--on-primary)', font: '600 9px var(--font-mono)', letterSpacing: '.1em', display: 'flex', alignItems: 'center', boxShadow: '0 0 0 2px var(--bg)' }}>JONLI</span>}
              <span className="ellipsis" style={{ fontSize: 12, maxWidth: 68 }}>{g.author.name.split(' ')[0]}</span>
            </button>
          ))}
          {stories.data && !stories.data.items.length && <span className="c3 t-small" style={{ alignSelf: 'center' }}>Kuzatganlaringiz hikoyalari shu yerda chiqadi</span>}
        </div>

        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row" style={{ gap: 12 }}>
            <Avatar name={me?.name} url={me?.avatarUrl} size={40} />
            <button onClick={() => setCompose('post')} style={{ flex: 1, height: 44, borderRadius: 999, background: 'var(--bg)', border: 'none', display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 15, color: 'var(--text-3)', textAlign: 'left' }}>Gol, natija yoki o‘yinchi qidirayotganingizni yozing…</button>
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            {([['photo_camera', 'Rasm', 'var(--accent)', () => setCompose('post')], ['smart_display', 'Reel', 'var(--error)', () => router.push('/reels?upload=1')], ['scoreboard', 'O‘yin natijasi', 'var(--brand-ink)', () => setCompose('result')], ['person_search', 'O‘yinchi topish', 'var(--success)', () => setCompose('find_players')]] as const).map(([ic, l, c, fn]) => (
              <button key={l} onClick={fn} className="btn btn-ghost btn-sm" style={{ color: 'var(--text-2)', fontWeight: 500 }}><Icon n={ic} size={20} style={{ color: c }} />{l}</button>
            ))}
          </div>
        </div>

        {/* Tor ekranlarda o‘ng panel bloklari lenta ustida */}
        {h && <div className="home-inline col" style={{ gap: 16 }}><Upcoming d={h} /><OpenMatches d={h} /></div>}

        <div className="tabs scroll-x" role="tablist">
          {([['foryou', 'Siz uchun'], ['following', 'Kuzatilayotganlar'], ['nearby', 'Yaqin atrofda']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {h?.news && tab === 'foryou' && <News n={h.news} />}
        {feedErr && !posts ? <ErrorState error={feedErr} onRetry={() => loadFeed()} /> : !posts ? <Loading rows={2} /> : !posts.length ? (
          <div className="card"><Empty icon={tab === 'following' ? 'group' : 'dynamic_feed'} title={tab === 'following' ? 'Kuzatganlaringiz hali post joylamagan' : 'Lenta bo‘sh'} text={tab === 'following' ? 'O‘yinchilarni kuzating – ularning gollari va natijalari shu yerda chiqadi.' : 'Birinchi postni siz joylang.'} action={<Link href="/discover" className="btn btn-outline btn-sm">O‘yinchilarni topish</Link>} /></div>
        ) : posts.map((p) => <PostCard key={p.id} p={p} onRemoved={() => setPosts((s) => s?.filter((x) => x.id !== p.id) ?? null)} />)}
        {next && posts && <button className="btn btn-outline" onClick={() => loadFeed(next)} disabled={more}>{more ? 'Yuklanmoqda…' : 'Yana ko‘rsatish'}</button>}
      </main>

      <aside className="home-right col" style={{ gap: 20, padding: '28px 0 80px' }}>
        <Async q={home} loading={<Loading rows={4} />}>
          {(d) => (<><Upcoming d={d} /><OpenMatches d={d} /><Stadiums d={d} /><Suggested d={d} /></>)}
        </Async>
      </aside>

      <Composer open={!!compose} initialKind={compose ?? 'post'} onClose={() => setCompose(null)} onCreated={(p) => { if (tab === 'foryou') setPosts((s) => [p, ...(s ?? [])]); }} />
      <StoryViewer group={story} onClose={() => setStory(null)} />
      <StoryCreate open={addStory} onClose={() => setAddStory(false)} onDone={() => stories.reload()} />
    </div>
  );
}
