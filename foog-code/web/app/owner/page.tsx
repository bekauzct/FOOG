'use client';
import Link from 'next/link';
import { Async, Avatar, Btn, Empty, Icon, Loading } from '@/components/ui';
import { Kpi, NoStadium, OwnerHeader, sq, useOwner } from '@/components/owner';
import { useBookingActions, type OB } from '@/components/ownerBookings';
import { useApi } from '@/lib/useApi';
import { useEvent } from '@/lib/session';
import { DOW, MONTHS, ago, dec, mln, relDay, sum, SIZE_LABEL, minutesLabel } from '@/lib/format';

type Dash = {
  empty?: boolean; stadium: { id: string; name: string; status: string; accepting: boolean }; today: string; nowHour: number;
  kpis: { todayBookings: number; peak: number; pending: number; occupancy: number; pitches: number; openHours: number; monthRevenue: number };
  timeline: { id: string; name: string; size: string; slots: { hour: number; state: string; who?: string }[] }[];
  pending: OB[]; week: { date: string; value: number; plan: boolean; today: boolean }[]; weekTotal: number; weekDelta: number | null;
  reviews: { id: string; rating: number; text: string; reply: string | null; createdAt: string; user: { name: string; avatarUrl: string | null } }[]; rating: { avg: number; count: number } | null;
};

const cellBg = (st: string, past: boolean) => st === 'booked' ? 'var(--primary)' : st === 'pending' ? 'var(--warning)' : st === 'blocked' ? 'repeating-linear-gradient(135deg,var(--surface-2) 0 3px,var(--border-strong) 3px 4px)' : 'transparent';

export default function OwnerDashboard() {
  const { current, stadiums, loading } = useOwner();
  const q = useApi<Dash>(current ? `/owner/dashboard?${sq(current.id)}` : null, [current?.id]);
  const act = useBookingActions(q.reload);
  useEvent('booking', () => q.reload());
  if (!loading && stadiums && !stadiums.length) return <><OwnerHeader title="Bosh sahifa" /><NoStadium /></>;
  return (
    <>
      <OwnerHeader title="Bosh sahifa" />
      {current && current.status !== 'live' && (
        <div className="card row" style={{ padding: 16, gap: 12, boxShadow: `inset 0 0 0 1px ${current.status === 'mod' ? 'var(--warning)' : 'var(--error)'}` }}>
          <Icon n={current.status === 'mod' ? 'hourglass_top' : 'report'} style={{ color: current.status === 'mod' ? 'var(--warning)' : 'var(--error)' }} />
          <span className="grow t-small">{current.status === 'mod' ? `${current.name} moderatsiyada. Admin tekshirgach futbolchilarga ko‘rinadi – Telegram orqali xabar beramiz.` : current.status === 'rejected' ? `Ariza rad etildi: ${current.rejectReason}. Tuzatib, qayta yuboring.` : 'Stadion vaqtincha to‘xtatilgan.'}</span>
          {current.status === 'rejected' && <Link href="/owner/stadiums" className="btn btn-outline btn-sm">Tuzatish</Link>}
        </div>
      )}
      <Async q={q} loading={<Loading rows={3} />}>
        {(d) => {
          const hours = Array.from({ length: 16 }, (_, i) => 8 + i);
          const wmax = Math.max(1, ...d.week.map((w) => w.value));
          return (
            <>
              <div className="ow-kpis">
                <Kpi label="Bugungi bronlar" icon="event" value={String(d.kpis.todayBookings)} sub={d.kpis.todayBookings ? `shundan ${d.kpis.peak} tasi kechki peak` : 'Bugun hali bron yo‘q'} />
                <Kpi label="Tasdiq kutmoqda" icon="hourglass_top" value={String(d.kpis.pending)} sub={d.kpis.pending ? 'Javob berish – 2 soatgacha' : 'Hammasi ko‘rib chiqildi'} color={d.kpis.pending ? 'var(--warning)' : 'var(--success)'} />
                <Kpi label="Bugungi bandlik" icon="donut_large" value={`${d.kpis.occupancy}%`} sub={`${d.kpis.pitches} maydon · ${d.kpis.openHours} soat`} color="var(--brand-ink)" />
                <Kpi label={`${MONTHS[Number(d.today.slice(5, 7)) - 1].replace(/^./, (c) => c.toUpperCase())} daromadi`} icon="payments" value={mln(d.kpis.monthRevenue)} sub="so‘m · stadionda olingan" />
              </div>
              <div className="ow-two">
                <div className="card col" style={{ padding: 20, gap: 16, minWidth: 0 }}>
                  <div className="row between wrap" style={{ gap: 8 }}>
                    <div className="col"><span className="t-card" style={{ fontSize: 18 }}>Bugungi jadval</span><span className="c2" style={{ fontSize: 13 }}>{d.timeline.length} maydon · 08:00–24:00</span></div>
                    <Link href="/owner/schedule" className="btn btn-outline btn-sm">Jadvalni ochish</Link>
                  </div>
                  <div className="scroll-x">
                    <div style={{ minWidth: 640 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: `96px repeat(16,1fr)`, gap: 4, marginBottom: 6 }}>
                        <span />{hours.map((h) => <span key={h} className="mono c3" style={{ fontSize: 10, textAlign: 'center' }}>{String(h).padStart(2, '0')}</span>)}
                      </div>
                      {d.timeline.map((p) => (
                        <div key={p.id} style={{ display: 'grid', gridTemplateColumns: `96px repeat(16,1fr)`, gap: 4, marginBottom: 6, alignItems: 'center' }}>
                          <span className="col"><b style={{ fontSize: 14 }}>{p.name}</b><span className="c3 mono" style={{ fontSize: 10 }}>{SIZE_LABEL[p.size]}</span></span>
                          {p.slots.map((s) => (
                            <span key={s.hour} title={`${String(s.hour).padStart(2, '0')}:00 · ${s.who ? `${s.who}${s.state === 'pending' ? ' (kutilmoqda)' : ''}` : s.state === 'blocked' ? 'Yopiq' : s.state === 'closed' ? 'Ish vaqtidan tashqari' : 'Bo‘sh'}`}
                              style={{ height: 40, borderRadius: 8, background: s.state === 'closed' ? 'var(--bg)' : cellBg(s.state, s.hour < d.nowHour), boxShadow: ['booked', 'pending', 'blocked', 'closed'].includes(s.state) ? 'none' : 'inset 0 0 0 1.5px var(--border)', opacity: s.hour < d.nowHour && s.state !== 'pending' ? 0.55 : 1, position: 'relative' }}>
                              {s.hour === d.nowHour && <span style={{ position: 'absolute', left: 0, right: 0, bottom: -6, height: 2, background: 'var(--error)', borderRadius: 2 }} />}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="row wrap c2" style={{ gap: 16, fontSize: 12 }}>
                    {([['var(--primary)', 'Band'], ['var(--warning)', 'Tasdiq kutilmoqda'], ['repeating-linear-gradient(135deg,var(--surface-2) 0 3px,var(--border-strong) 3px 4px)', 'Yopiq'], ['transparent', 'Bo‘sh']] as const).map(([c, l]) => <span key={l} className="row" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c, boxShadow: c === 'transparent' ? 'inset 0 0 0 1.5px var(--border-strong)' : 'none' }} />{l}</span>)}
                  </div>
                </div>
                <div className="card col" style={{ padding: 20, gap: 12 }}>
                  <div className="row between"><span className="t-card" style={{ fontSize: 18 }}>Yangi so‘rovlar</span><Link href="/owner/bookings" style={{ fontSize: 14, fontWeight: 600 }}>Barchasi</Link></div>
                  {!d.pending.length ? <Empty icon="task_alt" title="Yangi so‘rov yo‘q" text="Yangi bron so‘rovi kelganda shu yerda va Telegramda ko‘rinadi." /> : d.pending.map((b) => {
                    const mins = (Number(b.end.slice(0, 2) || 24) * 60 + Number(b.end.slice(3))) - (Number(b.start.slice(0, 2)) * 60 + Number(b.start.slice(3)));
                    return (
                      <div key={b.id} className="well col" style={{ padding: 14, gap: 10, background: 'var(--bg)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                        <div className="row" style={{ gap: 12 }}>
                          <Avatar name={b.user.name} url={b.user.avatarUrl} size={40} />
                          <div className="col grow" style={{ minWidth: 0 }}><b className="ellipsis" style={{ fontSize: 15 }}>{b.user.name}</b><span className="c2" style={{ fontSize: 12 }}>{b.pitch.name} · {minutesLabel(mins < 0 ? mins + 1440 : mins)}</span></div>
                          <div className="col" style={{ alignItems: 'flex-end' }}><span className="mono" style={{ fontSize: 18 }}>{b.start}</span><span className="mono ink" style={{ fontSize: 11 }}>{relDay(b.date)}</span></div>
                        </div>
                        <div className="row between"><span className="c2" style={{ fontSize: 13 }}>{ago(b.createdAt)}</span><span className="mono" style={{ fontSize: 14 }}>{sum(b.price)}</span></div>
                        <div className="row" style={{ gap: 8 }}>
                          <Btn className="btn btn-outline" style={{ flex: 1 }} loading={act.busy === b.id + 'reject'} onClick={() => act.reject(b)}>Rad etish</Btn>
                          <Btn className="btn btn-primary" style={{ flex: 1.5 }} loading={act.busy === b.id + 'confirm'} onClick={() => act.run(b, 'confirm')}>Tasdiqlash</Btn>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="ow-two">
                <div className="card col" style={{ padding: 20, gap: 16 }}>
                  <div className="row between wrap" style={{ gap: 8 }}>
                    <div className="col"><span className="t-card" style={{ fontSize: 18 }}>Shu hafta daromadi</span><span className="mono" style={{ fontSize: 26 }}>{sum(d.weekTotal)}</span></div>
                    {d.weekDelta != null && <span className={`pill-tag ${d.weekDelta >= 0 ? 'success' : 'error'}`} style={{ textTransform: 'none', letterSpacing: 0 }}><Icon n={d.weekDelta >= 0 ? 'trending_up' : 'trending_down'} size={16} />{d.weekDelta >= 0 ? '+' : ''}{d.weekDelta}% o‘tgan haftaga</span>}
                  </div>
                  <div className="row" style={{ alignItems: 'flex-end', gap: 12, height: 180 }}>
                    {d.week.map((w, i) => (
                      <div key={w.date} className="col" style={{ flex: 1, alignItems: 'stretch', justifyContent: 'flex-end', height: '100%', gap: 6 }}>
                        <span className="mono c2" style={{ fontSize: 11, textAlign: 'center' }}>{w.value ? dec(w.value / 1e6, 2).replace(/,?0+$/, '') : '0'}</span>
                        <div style={{ height: `${Math.max(4, (w.value / wmax) * 78)}%`, borderRadius: 8, background: w.plan ? 'transparent' : w.today ? 'color-mix(in oklch,var(--brand-ink) 22%,transparent)' : 'var(--primary)', boxShadow: w.plan ? 'inset 0 0 0 1.5px var(--border-strong)' : 'none' }} />
                        <span className="mono" style={{ fontSize: 11, textAlign: 'center', color: w.today ? 'var(--text-1)' : 'var(--text-3)', fontWeight: w.today ? 600 : 400 }}>{DOW[i].toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                  <span className="c3 t-cap">Mln so‘m · «Keldi» deb belgilangan bronlar bo‘yicha. Kelgusi kunlar – tasdiqlangan reja.</span>
                </div>
                <div className="card col" style={{ padding: 20, gap: 12 }}>
                  <div className="row between"><span className="t-card" style={{ fontSize: 18 }}>So‘nggi sharhlar</span>{d.rating && <span className="row mono" style={{ gap: 4 }}><Icon n="star" fill size={18} style={{ color: 'var(--brand-ink)' }} />{dec(d.rating.avg)}</span>}</div>
                  {!d.reviews.length ? <p className="c2 t-small">Hali sharh yo‘q.</p> : d.reviews.map((r) => (
                    <div key={r.id} className="col" style={{ gap: 6, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                      <div className="row between"><b style={{ fontSize: 15 }}>{r.user.name}</b><span className="mono c3" style={{ fontSize: 12 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)} · {ago(r.createdAt)}</span></div>
                      <p className="c2" style={{ fontSize: 14, lineHeight: 1.5 }}>{r.text}</p>
                    </div>
                  ))}
                  <Link href="/owner/reviews" style={{ fontWeight: 600, fontSize: 15 }}>Sharhlarga javob berish</Link>
                </div>
              </div>
            </>
          );
        }}
      </Async>
      {act.modal}
    </>
  );
}
