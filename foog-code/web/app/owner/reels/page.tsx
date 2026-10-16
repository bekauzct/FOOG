'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Async, Avatar, Empty, Icon, Loading, Skeleton } from '@/components/ui';
import { NoStadium, OwnerHeader, useOwner } from '@/components/owner';
import { ReelUpload } from '@/components/ReelUpload';
import { useApi } from '@/lib/useApi';
import { post, del } from '@/lib/api';
import { useEvent, useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';
import { compact } from '@/lib/format';
import type { MiniUser } from '@/components/social';

type Mine = { stadium: { id: string; name: string } | null; totals: { views: number; bookings: number }; items: { id: string; caption: string; type: string; status: string; views: number; likes: number; comments: number; bookings: number; bookCta: boolean; videoUrl: string; posterUrl: string | null; createdAt: string }[] };
type Reel = { id: string; videoUrl: string; posterUrl: string | null; caption: string; type: string; views: number; likes: number; comments: number; liked: boolean; saved: boolean; author: MiniUser; stadium: { id: string; name: string } | null };

/** Lenta: stadionda olingan reellar (futbolchilar va egasi) – ko‘rish, like */
function Feed({ stadiumId, me }: { stadiumId: string; me: string }) {
  const q = useApi<{ items: Reel[] }>(`/reels?stadiumId=${stadiumId}`, [stadiumId]);
  const [i, setI] = useState(0);
  const [items, setItems] = useState<Reel[]>([]);
  useEffect(() => { setItems(q.data?.items ?? []); setI(0); }, [q.data]);
  const r = items[i];
  const like = async () => {
    if (!r) return;
    try { const x = await post<{ liked: boolean; likes: number }>(`/reels/${r.id}/like`); setItems((s) => s.map((y) => (y.id === r.id ? { ...y, liked: x.liked, likes: x.likes } : y))); } catch { /* noop */ }
  };
  return (
    <div className="col" style={{ gap: 12, alignItems: 'center' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '9/16', maxHeight: 680, borderRadius: 24, overflow: 'hidden', background: '#0D1221', color: '#fff' }}>
        {q.loading && !q.data ? <Skeleton h="100%" r={0} /> : !r ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}><Empty icon="smart_display" title="Stadioningizda hali reel yo‘q" text="Birinchi reelni joylang – futbolchilar lentasida va stadion sahifasida chiqadi." /></div> : (
          <>
            <video key={r.id} src={r.videoUrl} poster={r.posterUrl ?? undefined} autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div className="reel-shade" />
            <div className="row" style={{ position: 'absolute', top: 12, left: 12, right: 12, gap: 4 }}>{items.map((_, k) => <span key={k} style={{ flex: 1, height: 3, borderRadius: 2, background: k < i ? '#fff' : k === i ? '#C8F53A' : 'rgba(255,255,255,.3)' }} />)}</div>
            <div className="row between" style={{ position: 'absolute', top: 26, left: 14, right: 14 }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: '.12em' }}>LENTA · TOSHKENT</span>
              <span className="pill-tag volt">{r.author.id === me ? 'Sizning reel' : 'Stadioningizda'}</span>
            </div>
            <div className="col reel-rail">
              <button onClick={like} className="col" style={{ alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#fff' }} aria-label="Yoqdi"><span style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n="favorite" fill={r.liked} style={{ color: r.liked ? '#FF645F' : '#fff' }} /></span><span className="mono" style={{ fontSize: 12 }}>{compact(r.likes)}</span></button>
              <Link href={`/reels?start=${r.id}`} className="col" style={{ alignItems: 'center', gap: 4, color: '#fff' }}><span style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n="chat_bubble" /></span><span className="mono" style={{ fontSize: 12 }}>{compact(r.comments)}</span></Link>
            </div>
            <div className="col reel-info">
              <div className="row" style={{ gap: 10 }}><Avatar name={r.author.name} url={r.author.avatarUrl} size={40} /><span className="col"><b style={{ fontSize: 14 }}>@{r.author.username}</b><span style={{ fontSize: 12, opacity: 0.8 }}>{r.type}</span></span></div>
              <p style={{ fontSize: 14, lineHeight: 1.45 }}>{r.caption}</p>
              <span className="row" style={{ gap: 6, fontSize: 13, opacity: 0.85 }}><Icon n="play_arrow" size={16} />{compact(r.views)} ko‘rish</span>
            </div>
          </>
        )}
      </div>
      {items.length > 1 && (
        <div className="row" style={{ gap: 12 }}>
          <button className="icon-btn" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} aria-label="Oldingi"><Icon n="keyboard_arrow_up" /></button>
          <span className="mono c2" style={{ fontSize: 13 }}>{i + 1} / {items.length}</span>
          <button className="icon-btn" onClick={() => setI((x) => Math.min(items.length - 1, x + 1))} disabled={i >= items.length - 1} aria-label="Keyingi"><Icon n="keyboard_arrow_down" /></button>
        </div>
      )}
    </div>
  );
}

export default function OwnerReels() {
  const { current, stadiums, loading } = useOwner();
  const { me } = useSession();
  const q = useApi<Mine>('/owner/reels');
  const [up, setUp] = useState(false);
  const toast = useToast();
  useEvent('reel', () => q.reload());
  if (!loading && stadiums && !stadiums.length) return <><OwnerHeader title="Reels" /><NoStadium /></>;
  const remove = async (id: string) => { try { await del(`/reels/${id}`); toast('Reel o‘chirildi'); q.reload(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } };
  return (
    <>
      <OwnerHeader title="Reels" />
      <div className="ow-reels">
        {current ? <Feed stadiumId={current.id} me={me?.id ?? ''} /> : <Loading />}
        <div className="col" style={{ gap: 20, minWidth: 0 }}>
          <div className="card col" style={{ padding: 20, gap: 14 }}>
            <div className="col"><span className="t-card" style={{ fontSize: 18 }}>Reel joylash</span><span className="c2" style={{ fontSize: 13 }}>Stadioningizni ko‘rsating: kechki o‘yinlar, yangi o‘t, turnirlar, aksiyalar.</span></div>
            <button onClick={() => setUp(true)} className="row" style={{ gap: 14, padding: 18, borderRadius: 16, border: '1.5px dashed var(--border-strong)', background: 'transparent', color: 'var(--text-1)', textAlign: 'left' }}>
              <Icon n="video_call" size={32} style={{ color: 'var(--text-2)' }} />
              <span className="col grow"><b>Video tanlang</b><span className="c2 t-cap">9:16 · 60 soniyagacha · «Bron qilish» tugmasi bilan</span></span>
              <span className="btn btn-primary btn-sm">Joylash</span>
            </button>
          </div>
          <div className="card col" style={{ padding: 20, gap: 14 }}>
            <div className="row between wrap" style={{ gap: 8 }}><span className="t-card" style={{ fontSize: 18 }}>Mening reellarim</span>{q.data && <span className="mono c2" style={{ fontSize: 13 }}>{compact(q.data.totals.views)} ko‘rish · {q.data.totals.bookings} bron reellar orqali</span>}</div>
            <Async q={q} loading={<Loading rows={2} card={false} />} empty={(d) => !d.items.length && <Empty icon="smart_display" title="Hali reel joylamagansiz" />}>
              {(d) => (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
                  {d.items.map((r) => (
                    <div key={r.id} className="col" style={{ gap: 6 }}>
                      <Link href={r.status === 'published' ? `/reels?start=${r.id}` : '#'} style={{ position: 'relative', aspectRatio: '9/16', borderRadius: 16, overflow: 'hidden', background: r.posterUrl ? `center/cover url("${r.posterUrl}")` : 'var(--ph)', display: 'block', color: '#fff' }}>
                        <span className="row mono" style={{ position: 'absolute', top: 10, left: 10, gap: 4, fontSize: 12, textShadow: '0 1px 4px rgba(0,0,0,.6)' }}><Icon n="play_arrow" fill size={16} />{compact(r.views)}</span>
                        {r.status !== 'published' && <span className={`pill-tag ${r.status === 'failed' ? 'error' : 'warning'}`} style={{ position: 'absolute', top: 36, left: 10 }}>{r.status === 'failed' ? 'Xato' : 'Qayta ishlanmoqda'}</span>}
                        <span style={{ position: 'absolute', left: 10, right: 10, bottom: 10, fontSize: 13, fontWeight: 600, textShadow: '0 1px 6px rgba(0,0,0,.7)' }}>{r.caption || r.type}</span>
                      </Link>
                      <div className="row between mono" style={{ fontSize: 12 }}><span className="c2">♥ {compact(r.likes)}</span>{r.bookCta && <span className="ink">{r.bookings} bron</span>}<button className="icon-btn ghost sm" style={{ width: 32, height: 32 }} onClick={() => remove(r.id)} aria-label="O‘chirish"><Icon n="delete" size={18} /></button></div>
                    </div>
                  ))}
                </div>
              )}
            </Async>
          </div>
        </div>
      </div>
      <ReelUpload open={up} onClose={() => setUp(false)} onPublished={q.reload} owner={current ? { stadiumId: current.id, stadiumName: current.name } : null} />
    </>
  );
}
