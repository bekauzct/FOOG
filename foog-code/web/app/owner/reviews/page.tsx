'use client';
import { Async, Empty, Icon, Loading } from '@/components/ui';
import { NoStadium, OwnerHeader, ReviewRow, useOwner, type ReviewT } from '@/components/owner';
import { useApi } from '@/lib/useApi';
import { dec } from '@/lib/format';
import { useState } from 'react';

export default function OwnerReviews() {
  const { current, stadiums, loading } = useOwner();
  const q = useApi<{ rating: { avg: number; count: number } | null; items: ReviewT[] }>(current ? `/owner/reviews?stadiumId=${current.id}` : null, [current?.id]);
  const [f, setF] = useState<'all' | 'noreply'>('all');
  if (!loading && stadiums && !stadiums.length) return <><OwnerHeader title="Sharhlar" /><NoStadium /></>;
  return (
    <>
      <OwnerHeader title="Sharhlar" />
      <Async q={q} loading={<Loading rows={3} />}>
        {(d) => {
          const items = d.items.filter((r) => f === 'all' || !r.reply);
          return (
            <div className="card col" style={{ padding: 20, gap: 4, maxWidth: 820 }}>
              <div className="row between wrap" style={{ gap: 12, paddingBottom: 8 }}>
                <span className="row" style={{ gap: 8, fontSize: 18, fontWeight: 700 }}>{d.rating ? <><Icon n="star" fill style={{ color: 'var(--brand-ink)' }} /><span className="mono">{dec(d.rating.avg)}</span><span className="c2" style={{ fontSize: 14, fontWeight: 400 }}>· {d.rating.count} ta sharh</span></> : 'Sharhlar'}</span>
                <div className="seg"><button className={f === 'all' ? 'on' : ''} onClick={() => setF('all')}>Hammasi</button><button className={f === 'noreply' ? 'on' : ''} onClick={() => setF('noreply')}>Javobsiz · {d.items.filter((r) => !r.reply).length}</button></div>
              </div>
              {!items.length ? <Empty icon="reviews" title={f === 'noreply' ? 'Hamma sharhga javob berilgan' : 'Hali sharh yo‘q'} text="Futbolchilar o‘yindan keyin («Keldi» belgisidan so‘ng) sharh qoldiradi." /> : items.map((r) => <ReviewRow key={r.id} r={r} onReplied={q.reload} />)}
            </div>
          );
        }}
      </Async>
    </>
  );
}
