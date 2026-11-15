'use client';
import { useEffect } from 'react';
import { Icon } from '@/components/ui';
import { JUGGLE_STATUS, JuggleBoard, JuggleStart, type JuggleMe } from '@/components/juggle';
import { useApi } from '@/lib/useApi';
import { useEvent, useSession } from '@/lib/session';
import { dayMonthShort, isoDate, num } from '@/lib/format';

/** Jonglyor Battle: shaxsiy natijalar, yozish va reyting */
export default function Battle() {
  const { me: user } = useSession();
  const q = useApi<JuggleMe>(user ? '/juggle/me' : null);
  const d = q.data;
  useEvent('notification', () => q.reload());
  // Video tayyorlanayotgan bo‘lsa – holat yangilanib turadi
  const busy = d?.items.some((i) => i.status === 'processing');
  useEffect(() => { if (!busy) return; const t = setInterval(() => q.reload(), 4000); return () => clearInterval(t); }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="page col" style={{ gap: 24, padding: '28px 16px 80px', maxWidth: 1080, margin: '0 auto' }}>
      <section className="jg-hero">
        <div className="col" style={{ gap: 12, maxWidth: 560 }}>
          <span className="label ink"><Icon n="swords" size={16} /> Jonglyor Battle</span>
          <h1 className="t-page">To‘pni yerga tushirmang. Har bir zarba – 1 ball.</h1>
          <p className="c2" style={{ fontSize: 16, lineHeight: 1.55 }}>Telefonni qo‘ying, kamerani yoqing va jonglyor qiling. Video shu yerda yoziladi, moderator tasdiqlagach natija FOOG ID’ingizga yoziladi. Reyting shaxsiy rekord bo‘yicha.</p>
          <div className="row wrap" style={{ gap: 10, alignItems: 'center' }}>
            <JuggleStart me={d} onDone={() => q.reload()} label={d?.best ? 'Rekordni yangilash' : 'Jonglyor yozish'} />
            {d && <span className="c3 t-small">Bugun yana {d.todayLeft} ta urinish</span>}
          </div>
        </div>
        {d && (
          <div className="jg-stats">
            <div><span className="mono">🏆 {num(d.best)}</span><small>Rekord</small></div>
            <div><span className="mono">{num(d.total)}</span><small>Jami ball</small></div>
            <div><span className="mono">{d.rank ? `#${d.rank}` : '—'}</span><small>O‘rin</small></div>
          </div>
        )}
      </section>

      <div className="jg-grid">
        <div className="card col" style={{ padding: 18, gap: 12 }}>
          <div className="row" style={{ gap: 10 }}><Icon n="leaderboard" size={22} style={{ color: 'var(--brand-ink)' }} /><b className="t-card">Reyting</b></div>
          <JuggleBoard />
        </div>
        {d && (
          <div className="card col" style={{ padding: 18, gap: 12, alignSelf: 'start' }}>
            <b className="t-card">Urinishlarim</b>
            {!d.items.length ? <p className="c2 t-small">Hali urinish yo‘q. Birinchi videoni yozing!</p> : d.items.map((i) => {
              const [label, tone] = JUGGLE_STATUS[i.status];
              return (
                <div key={i.id} className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                  {i.videoUrl ? <a href={i.videoUrl} target="_blank" rel="noopener" style={{ flexShrink: 0 }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={i.posterUrl ?? ''} alt="" width={56} height={72} style={{ objectFit: 'cover', borderRadius: 8, background: 'var(--surface-2)' }} /></a> : <span className="well" style={{ width: 56, height: 72, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon n="videocam" size={20} /></span>}
                  <div className="col grow" style={{ gap: 4, minWidth: 0 }}>
                    <span className="row between"><b className="mono" style={{ fontSize: 18 }}>{num(i.count ?? i.claimed)} ta</b><span className={`pill-tag ${tone}`}>{label}</span></span>
                    {i.count != null && i.count !== i.claimed && <span className="c3" style={{ fontSize: 12 }}>Siz {i.claimed} ta deb kiritgansiz</span>}
                    {i.rejectReason && <span style={{ fontSize: 12, color: 'var(--error)' }}>{i.rejectReason}</span>}
                    <span className="mono c3" style={{ fontSize: 11 }}>{dayMonthShort(isoDate(i.createdAt))}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
