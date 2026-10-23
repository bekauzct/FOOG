'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import FoogMark from '@/components/FoogMark';
import { ThemeButton } from '@/components/TopBar';
import { Avatar, Empty, ErrorState, Icon, Skeleton } from '@/components/ui';
import { CommentsModal, ReportModal, ShareSheet, type MiniUser } from '@/components/social';
import { ReelUpload } from '@/components/ReelUpload';
import { get, post } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';
import { compact } from '@/lib/format';

type Reel = {
  id: string; videoUrl: string; posterUrl: string | null; caption: string; type: string; bookCta: boolean; views: number; createdAt: string;
  author: MiniUser & { role: string }; stadium: { id: string; name: string } | null; likes: number; comments: number; liked: boolean; saved: boolean; following: boolean;
};
const TYPE_ICON: Record<string, string> = { 'O‘yin lavhasi': 'sports_soccer', Gol: 'target', Seyv: 'sports_handball', Skill: 'bolt', Challenge: 'emoji_events', 'Stadion sharhi': 'stadium', Turnir: 'trophy', Aksiya: 'sell' };

function Caption({ text }: { text: string }) {
  const parts = text.split(/(#[\p{L}\d_]+)/u);
  const body = parts.filter((p) => !p.startsWith('#')).join('').trim();
  const tags = parts.filter((p) => p.startsWith('#'));
  return (
    <>
      {body && <p style={{ fontSize: 15, lineHeight: 1.45, margin: 0 }}>{body}</p>}
      {!!tags.length && <div className="row wrap reel-tags" style={{ gap: 8, fontSize: 14, fontWeight: 700 }}>{tags.map((t) => <span key={t}>{t}</span>)}</div>}
    </>
  );
}

function ReelsInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { me } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<'foryou' | 'following'>('foryou');
  const [items, setItems] = useState<Reel[] | null>(null);
  const [err, setErr] = useState<{ message: string; status?: number } | null>(null);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [burst, setBurst] = useState(0);
  const [comments, setComments] = useState(false);
  const [share, setShare] = useState(false);
  const [report, setReport] = useState(false);
  const [up, setUp] = useState(sp.get('upload') === '1');
  const video = useRef<HTMLVideoElement>(null);
  const tap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchY = useRef<number | null>(null);
  const wheelLock = useRef(0);
  const [prog, setProg] = useState(0);

  const load = async () => {
    setErr(null); setItems(null);
    try { const r = await get<{ items: Reel[] }>(`/reels?tab=${tab}${sp.get('start') ? `&start=${sp.get('start')}` : ''}`); setItems(r.items); setI(0); } catch (e) { setErr(e as Error); }
  };
  useEffect(() => { load(); }, [tab]);
  const r = items?.[i];
  useEffect(() => { if (r) post(`/reels/${r.id}/view`).catch(() => undefined); setPaused(false); setProg(0); }, [r?.id]);
  useEffect(() => { const v = video.current; if (!v) return; if (paused) v.pause(); else v.play().catch(() => undefined); }, [paused, r?.id]);
  const go = (d: number) => setI((x) => Math.max(0, Math.min((items?.length ?? 1) - 1, x + d)));
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return; if (e.key === 'ArrowDown') go(1); if (e.key === 'ArrowUp') go(-1); if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [items?.length]);

  const patch = (p: Partial<Reel>) => setItems((s) => s?.map((x, k) => (k === i ? { ...x, ...p } : x)) ?? null);
  const need = () => { if (!me) { router.push('/login?next=/reels'); return true; } return false; };
  const like = async (force?: boolean) => {
    if (!r || need()) return;
    if (force && r.liked) return;
    patch({ liked: !r.liked, likes: r.likes + (r.liked ? -1 : 1) });
    try { const x = await post<{ liked: boolean; likes: number }>(`/reels/${r.id}/like`); patch({ liked: x.liked, likes: x.likes }); } catch { patch({ liked: r.liked, likes: r.likes }); }
  };
  const save = async () => {
    if (!r || need()) return;
    patch({ saved: !r.saved });
    try { const x = await post<{ saved: boolean }>(`/reels/${r.id}/save`); patch({ saved: x.saved }); toast(x.saved ? 'Saqlandi' : 'Saqlanganlardan olib tashlandi'); } catch { patch({ saved: r.saved }); }
  };
  const follow = async () => {
    if (!r || need() || !r.author.username) return;
    const was = r.following;
    setItems((s) => s?.map((x) => (x.author.id === r.author.id ? { ...x, following: !was } : x)) ?? null);
    try { await post(`/users/${r.author.username}/follow`); } catch { setItems((s) => s?.map((x) => (x.author.id === r.author.id ? { ...x, following: was } : x)) ?? null); }
  };
  const onTap = () => {
    if (tap.current) { clearTimeout(tap.current); tap.current = null; like(true); setBurst((b) => b + 1); return; }
    tap.current = setTimeout(() => { tap.current = null; setPaused((p) => !p); }, 260);
  };
  const rail: [string, string, boolean, string | undefined, () => void][] = r ? [
    ['favorite', compact(r.likes), r.liked, r.liked ? '#FF645F' : undefined, () => like()],
    ['chat_bubble', compact(r.comments), false, undefined, () => setComments(true)],
    ['bookmark', r.saved ? 'Saqlandi' : 'Saqlash', r.saved, r.saved ? 'var(--on-dark-accent)' : undefined, save],
    ['send', 'Ulashish', false, undefined, () => setShare(true)],
  ] : [];

  return (
    <div className="reels-page" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>
      <header className="row between reels-head">
        <Link href={me?.role === 'owner' ? '/owner/reels' : '/home'} className="btn btn-sm btn-surface"><Icon n="arrow_back" size={20} />Asosiy</Link>
        <Link href="/home" style={{ width: 52, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }} aria-label="FOOG"><FoogMark kind="symbol" ink="var(--mark-ink)" primary="var(--mark-o)" accent="var(--mark-ink)" /></Link>
        <div className="row" style={{ gap: 8 }}>
          {me && <button className="btn btn-sm btn-primary" onClick={() => setUp(true)}><Icon n="add" size={20} /><span className="hide-mobile">Yaratish</span></button>}
          <ThemeButton />
        </div>
      </header>
      <div className="reels-stage" data-tour="reels">
        <div className="reel-card" onWheel={(e) => { if (Date.now() - wheelLock.current < 600 || Math.abs(e.deltaY) < 30) return; wheelLock.current = Date.now(); go(e.deltaY > 0 ? 1 : -1); }}
          onTouchStart={(e) => { touchY.current = e.touches[0].clientY; }} onTouchEnd={(e) => { if (touchY.current === null) return; const dy = touchY.current - e.changedTouches[0].clientY; touchY.current = null; if (Math.abs(dy) > 50) go(dy > 0 ? 1 : -1); }}>
          {err ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}><ErrorState error={err} onRetry={load} /></div> : !items ? <Skeleton h="100%" r={0} style={{ position: 'absolute', inset: 0, background: '#0D1221' }} /> : !r ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Empty icon="smart_display" title={tab === 'following' ? 'Kuzatganlaringiz hali reel joylamagan' : 'Hali reel yo‘q'} text="Birinchi bo‘lib o‘yin lavhangizni joylang." action={me ? <button className="btn btn-primary btn-sm" onClick={() => setUp(true)}>Reel joylash</button> : undefined} />
            </div>
          ) : (
            <>
              <video key={r.id} ref={video} src={r.videoUrl} poster={r.posterUrl ?? undefined} loop muted={muted} playsInline autoPlay onClick={onTap} onTimeUpdate={(e) => { const v = e.currentTarget; setProg(v.duration ? v.currentTime / v.duration : 0); }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#000', cursor: 'pointer' }} />
              <div className="reel-shade" />
              <div className="row" style={{ position: 'absolute', top: 12, left: 12, right: 12, gap: 4 }}>{items.map((_, k) => <span key={k} style={{ flex: 1, height: 3, borderRadius: 2, background: k < i ? '#fff' : k === i ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.3)', overflow: 'hidden' }}>{k === i && <span style={{ display: 'block', height: '100%', width: `${prog * 100}%`, background: '#C8F53A' }} />}</span>)}</div>
              <div className="row between" style={{ position: 'absolute', top: 24, left: 14, right: 14 }}>
                <div className="row" style={{ gap: 18 }}>
                  {([['following', 'Kuzatilayotganlar'], ['foryou', 'Siz uchun']] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ background: 'none', border: 'none', padding: '6px 0', minHeight: 36, color: tab === k ? '#fff' : 'rgba(255,255,255,.6)', fontSize: 16, fontWeight: 700, boxShadow: tab === k ? 'inset 0 -2px 0 #fff' : 'none' }}>{l}</button>)}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <span className="row mono" style={{ gap: 4, fontSize: 12 }}><Icon n="play_arrow" fill size={16} />{compact(r.views)}</span>
                  <button className="icon-btn sm" style={{ background: 'rgba(0,0,0,.35)', color: '#fff' }} onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Ovozni yoqish' : 'Ovozni o‘chirish'}><Icon n={muted ? 'volume_off' : 'volume_up'} size={20} /></button>
                </div>
              </div>
              {paused && <Icon n="play_arrow" fill size={72} style={{ position: 'absolute', left: '50%', top: '45%', transform: 'translate(-50%,-50%)', color: 'rgba(255,255,255,.85)', pointerEvents: 'none' }} />}
              {burst > 0 && <Icon key={burst} n="favorite" fill size={110} className="reel-burst" />}
              <div className="col reel-rail">
                {rail.map(([ic, l, on, c, fn]) => (
                  <button key={ic} onClick={fn} className="col" style={{ alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#fff', padding: 0, minWidth: 48 }} aria-label={l} aria-pressed={on}>
                    <span style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n={ic} fill={on} size={26} style={{ color: c }} /></span>
                    <span className="mono" style={{ fontSize: 12 }}>{l}</span>
                  </button>
                ))}
                {me && me.id !== r.author.id && <button onClick={() => setReport(true)} className="icon-btn sm" style={{ background: 'rgba(0,0,0,.35)', color: '#fff', alignSelf: 'center' }} aria-label="Shikoyat qilish"><Icon n="flag" size={20} /></button>}
              </div>
              <div className="col reel-info">
                <div className="row" style={{ gap: 10 }}>
                  <Link href={`/u/${r.author.username}`}><Avatar name={r.author.name} url={r.author.avatarUrl} size={44} /></Link>
                  <Link href={`/u/${r.author.username}`} className="col" style={{ color: '#fff', minWidth: 0 }}>
                    <span className="row" style={{ gap: 4, fontWeight: 700, fontSize: 15 }}>{r.author.username}{r.author.verified && <Icon n="verified" fill size={16} style={{ color: '#629BFF' }} />}</span>
                    <span style={{ fontSize: 12, opacity: 0.8 }} className="ellipsis">{[r.author.position, r.author.role === 'owner' ? 'Stadion' : r.author.district].filter(Boolean).join(' · ')}</span>
                  </Link>
                  {me?.id !== r.author.id && <button onClick={follow} className="btn btn-sm" style={{ height: 34, background: r.following ? 'transparent' : '#fff', color: r.following ? '#fff' : '#091025', boxShadow: r.following ? 'inset 0 0 0 1.5px rgba(255,255,255,.6)' : 'none' }}>{r.following ? 'Kuzatilmoqda' : 'Kuzatish'}</button>}
                </div>
                <Caption text={r.caption} />
                <div className="row wrap" style={{ gap: 8, fontSize: 13, opacity: 0.85 }}>
                  <span className="row" style={{ gap: 6 }}><Icon n={TYPE_ICON[r.type] ?? 'sports_soccer'} size={18} />{r.type}</span>
                  {r.stadium && <><span>·</span><Link href={`/stadiums/${r.stadium.id}`} className="row" style={{ gap: 6, color: '#fff' }}><Icon n="location_on" size={18} />{r.stadium.name}</Link></>}
                </div>
                {r.bookCta && r.stadium && <Link href={`/stadiums/${r.stadium.id}?reel=${r.id}`} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}><Icon n="event_available" size={20} />Bron qilish · {r.stadium.name}</Link>}
              </div>
            </>
          )}
        </div>
        {items && items.length > 1 && (
          <div className="col reel-nav hide-mobile">
            <button className="icon-btn" style={{ width: 48, height: 48, opacity: i === 0 ? 0.4 : 1 }} onClick={() => go(-1)} disabled={i === 0} aria-label="Oldingi reel"><Icon n="keyboard_arrow_up" /></button>
            <button className="icon-btn" style={{ width: 48, height: 48, opacity: i >= items.length - 1 ? 0.4 : 1 }} onClick={() => go(1)} disabled={i >= items.length - 1} aria-label="Keyingi reel"><Icon n="keyboard_arrow_down" /></button>
          </div>
        )}
      </div>
      {r && <CommentsModal open={comments} onClose={() => setComments(false)} target="reels" id={r.id} onCount={(n) => patch({ comments: n })} />}
      {r && <ShareSheet open={share} onClose={() => setShare(false)} url={`/reels?start=${r.id}`} title={r.caption.slice(0, 80) || 'FOOG reel'} reelId={r.id} videoUrl={r.videoUrl} />}
      {r && <ReportModal open={report} onClose={() => setReport(false)} targetType="reel" targetId={r.id} />}
      <ReelUpload open={up} onClose={() => setUp(false)} onPublished={load} />
    </div>
  );
}

export default function ReelsPage() {
  return <Suspense><ReelsInner /></Suspense>;
}
