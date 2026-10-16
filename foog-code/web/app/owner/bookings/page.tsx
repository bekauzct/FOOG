'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Async, Avatar, Btn, Empty, Icon, Loading, Seg } from '@/components/ui';
import { NoStadium, OwnerHeader, useOwner } from '@/components/owner';
import { useBookingActions, type OB } from '@/components/ownerBookings';
import { useApi } from '@/lib/useApi';
import { qs } from '@/lib/api';
import { useEvent } from '@/lib/session';
import { BOOKING_STATUS, minutesLabel, phone, relDay, sum, tashkent } from '@/lib/format';

type F = 'pending' | 'today' | 'confirmed' | 'history' | 'all';

function Inner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { current, stadiums, loading } = useOwner();
  const [filter, setFilter] = useState<F>((sp.get('filter') as F) || 'pending');
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [dq, setDq] = useState(q);
  useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setQ(sp.get('q') ?? ''); if (sp.get('filter')) setFilter(sp.get('filter') as F); }, [sp]);
  const path = current ? `/owner/bookings${qs({ stadiumId: current.id, filter, q: dq })}` : null;
  const all = useApi<{ items: OB[]; counts: { pending: number } }>(path, [current?.id]);
  const act = useBookingActions(all.reload);
  useEvent('booking', () => all.reload());
  if (!loading && stadiums && !stadiums.length) return <><OwnerHeader title="Bronlar" /><NoStadium /></>;
  const now = tashkent();
  const pendingN = all.data?.counts.pending ?? 0;
  return (
    <>
      <OwnerHeader title="Bronlar" />
      <div className="row between wrap" style={{ gap: 12 }}>
        <Seg<F> value={filter} onChange={(v) => { setFilter(v); router.replace(`/owner/bookings?filter=${v}`, { scroll: false }); }} items={[['pending', 'Kutilmoqda', pendingN], ['today', 'Bugun'], ['confirmed', 'Tasdiqlangan'], ['history', 'Tarix'], ['all', 'Hammasi']]} />
        <div className="row wrap" style={{ gap: 12 }}>
          <div className="search" style={{ height: 44, width: 'min(300px, 100%)' }}><Icon n="search" size={20} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mijoz, telefon yoki FG-raqam" aria-label="Qidirish" /></div>
          {filter === 'pending' && <span className="c2 t-small" style={{ alignSelf: 'center' }}>Tasdiqlanmagan so‘rov 2 soatdan keyin avtomatik bekor bo‘ladi.</span>}
        </div>
      </div>
      <Async q={all} loading={<Loading rows={4} />} empty={(d) => !d.items.length && (
        <div className="card"><Empty icon={filter === 'pending' ? 'task_alt' : 'event_note'} title={filter === 'pending' ? 'Kutilayotgan so‘rov yo‘q' : dq ? 'Hech narsa topilmadi' : 'Bronlar yo‘q'} text={filter === 'pending' ? 'Yangi so‘rov kelganda shu yerda va Telegramda ko‘rinadi.' : undefined} /></div>
      )}>
        {(d) => (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="ow-table">
              <thead><tr><th>Mijoz</th><th>Sana · vaqt</th><th>Maydon</th><th>Summa</th><th>Holat</th><th style={{ textAlign: 'right' }}>Amal</th></tr></thead>
              <tbody>
                {d.items.map((b) => {
                  const [label, tone] = BOOKING_STATUS[b.status] ?? [b.status, 'muted'];
                  const mins = (Number(b.end.slice(0, 2) || 24) * 60 + Number(b.end.slice(3))) - (Number(b.start.slice(0, 2)) * 60 + Number(b.start.slice(3)));
                  const canMark = b.status === 'confirmed' && (b.date < now.date || (b.date === now.date && Number(b.start.slice(0, 2)) <= now.hour + 1));
                  return (
                    <tr key={b.id}>
                      <td>
                        <div className="row" style={{ gap: 12 }}>
                          <Avatar name={b.user.name} url={b.user.avatarUrl} size={40} />
                          <div className="col" style={{ minWidth: 0 }}>
                            <b className="ellipsis" style={{ fontSize: 15 }}>{b.user.name}</b>
                            <span className="mono c3" style={{ fontSize: 11 }}>{b.code}</span>
                            <span className="mono c3" style={{ fontSize: 11 }}>{phone(b.user.phone)}{b.user.noShows ? <span style={{ color: 'var(--error)' }}> · {b.user.noShows} marta kelmagan</span> : null}</span>
                          </div>
                        </div>
                      </td>
                      <td><div className="col"><span className="mono" style={{ fontSize: 15 }}>{b.start}</span><span className="c2" style={{ fontSize: 12 }}>{relDay(b.date)} · {minutesLabel(mins < 0 ? mins + 1440 : mins)}</span></div></td>
                      <td style={{ fontSize: 14 }}>{b.pitch.name}</td>
                      <td><div className="col"><span className="mono" style={{ fontSize: 14 }}>{sum(b.price)}</span><span className="c3" style={{ fontSize: 11 }}>stadionda</span></div></td>
                      <td><span className={`pill-tag ${tone}`}>{label}</span>{b.rejectReason && <div className="c3" style={{ fontSize: 11, marginTop: 4, maxWidth: 160 }}>{b.rejectReason}</div>}</td>
                      <td>
                        <div className="row" style={{ gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {b.status === 'pending' && <><Btn className="btn btn-outline btn-sm" loading={act.busy === b.id + 'reject'} onClick={() => act.reject(b)}>Rad etish</Btn><Btn className="btn btn-primary btn-sm" loading={act.busy === b.id + 'confirm'} onClick={() => act.run(b, 'confirm')}>Tasdiqlash</Btn></>}
                          {canMark && <><Btn className="btn btn-outline btn-sm" loading={act.busy === b.id + 'no_show'} onClick={() => act.run(b, 'no_show')}>Kelmadi</Btn><Btn className="btn btn-inverse btn-sm" loading={act.busy === b.id + 'arrived'} onClick={() => act.run(b, 'arrived')}><Icon n="how_to_reg" size={18} />Keldi</Btn></>}
                          {b.status === 'confirmed' && !canMark && <span className="c3 t-cap">O‘yin kuni «Keldi / Kelmadi»</span>}
                          {b.user.phone && <a href={`tel:${b.user.phone}`} className="icon-btn sm" aria-label="Qo‘ng‘iroq qilish"><Icon n="call" size={20} /></a>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Async>
      {act.modal}
    </>
  );
}

export default function OwnerBookings() {
  return <Suspense><Inner /></Suspense>;
}
