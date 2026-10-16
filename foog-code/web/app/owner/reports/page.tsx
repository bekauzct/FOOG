'use client';
import { useState } from 'react';
import { Async, Avatar, Empty, ErrorState, Icon, Loading, Seg } from '@/components/ui';
import { Kpi, NoStadium, OwnerHeader, useOwner } from '@/components/owner';
import { useApi } from '@/lib/useApi';
import { qs } from '@/lib/api';
import { useSession } from '@/lib/session';
import { DOW, dayMonthShort, dec, mln, phone, sum } from '@/lib/format';

type Rep = {
  range: 'week' | 'year'; from: string; to: string; stadium: { id: string; name: string };
  kpis: { revenue: number; bookings: number; occupancy: number; noShows: number; noShowRate: number };
  bars: { label: string; value: number; current: boolean; plan?: boolean }[];
  pitches: { id: string; name: string; bookings: number; revenue: number; occupancy: number }[];
  heat: number[][]; heatMax: number;
  noShowList: { id: string; code: string; date: string; start: string; price: number; user: { id: string; name: string; phone: string | null; noShows: number } }[];
};

function csv(r: Rep) {
  const rows = [['Ko‘rsatkich', 'Qiymat'], ['Davr', `${r.from} – ${r.to}`], ['Daromad (so‘m)', String(r.kpis.revenue)], ['Bronlar', String(r.kpis.bookings)], ['O‘rtacha bandlik (%)', String(r.kpis.occupancy)], ['Kelmaganlar', String(r.kpis.noShows)], [], ['Davr', 'Daromad (so‘m)'], ...r.bars.map((b) => [b.label, String(b.value)]), [], ['Maydon', 'Bronlar', 'Daromad (so‘m)', 'Bandlik (%)'], ...r.pitches.map((p) => [p.name, String(p.bookings), String(p.revenue), String(p.occupancy)]), [], ['Kelmaganlar', 'Telefon', 'Sana', 'Vaqt', 'Bron'], ...r.noShowList.map((n) => [n.user.name, n.user.phone ?? '', n.date, n.start, n.code])];
  const text = '﻿' + rows.map((x) => x.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = `FOOG-hisobot-${r.stadium.name.replace(/\s+/g, '-')}-${r.from}.csv`;
  a.click();
}

export default function ReportsPage() {
  const { current, stadiums, loading } = useOwner();
  const { me } = useSession();
  const [range, setRange] = useState<'week' | 'year'>('week');
  const q = useApi<Rep>(current ? `/owner/reports${qs({ stadiumId: current.id, range })}` : null, [current?.id]);
  if (!loading && stadiums && !stadiums.length) return <><OwnerHeader title="Hisobot" /><NoStadium /></>;
  if (q.error?.status === 403 || (me && me.role !== 'owner' && me.role !== 'admin')) return <><OwnerHeader title="Hisobot" /><ErrorState error={{ message: 'Hisobot va biznes ma’lumotlarini faqat stadion egasi ko‘radi.', status: 403 }} /></>;
  return (
    <>
      <OwnerHeader title="Hisobot" />
      <div className="row between wrap" style={{ gap: 12 }}>
        <Seg value={range} onChange={setRange} items={[['week', 'Shu hafta'], ['year', '6 oy']]} />
        <button className="btn btn-outline btn-sm" disabled={!q.data} onClick={() => q.data && csv(q.data)}><Icon n="download" size={18} />Excel’ga yuklash</button>
      </div>
      <Async q={q} loading={<Loading rows={3} />}>
        {(r) => {
          const max = Math.max(1, ...r.bars.map((b) => b.value));
          return (
            <>
              <div className="ow-kpis">
                <Kpi label="Daromad" icon="payments" value={mln(r.kpis.revenue)} sub="so‘m · stadionda olingan" />
                <Kpi label="Bronlar" icon="event" value={String(r.kpis.bookings)} sub={range === 'week' ? 'shu hafta' : `o‘rtacha ${Math.round(r.kpis.bookings / 6)} / oy`} />
                <Kpi label="O‘rtacha bandlik" icon="donut_large" value={`${r.kpis.occupancy}%`} sub="ish vaqti ichida" color="var(--brand-ink)" />
                <Kpi label="Kelmaganlar" icon="person_off" value={String(r.kpis.noShows)} sub={`${dec(r.kpis.noShowRate)}% bronlardan${r.kpis.noShowRate <= 5 ? ' · me’yorda' : ''}`} color="var(--warning)" />
              </div>
              <div className="ow-two">
                <div className="card col" style={{ padding: 20, gap: 16 }}>
                  <span className="t-card" style={{ fontSize: 18 }}>{range === 'week' ? `Kunlar bo‘yicha daromad · ${dayMonthShort(r.from)} – ${dayMonthShort(r.to)}` : `Oylar bo‘yicha daromad · ${r.to.slice(0, 4)}`}</span>
                  <div className="row" style={{ alignItems: 'flex-end', gap: 12, height: 220 }}>
                    {r.bars.map((b, i) => (
                      <div key={i} className="col" style={{ flex: 1, height: '100%', justifyContent: 'flex-end', gap: 6 }}>
                        <span className="mono c2" style={{ fontSize: 11, textAlign: 'center' }}>{b.value ? dec(b.value / 1e6, b.value >= 1e7 ? 1 : 2).replace(/,?0+$/, '') : '0'}</span>
                        <div style={{ height: `${Math.max(3, (b.value / max) * 82)}%`, borderRadius: 10, background: b.plan ? 'color-mix(in oklch,var(--brand-ink) 20%,transparent)' : 'var(--primary)', boxShadow: b.current ? 'inset 0 0 0 2px var(--brand-ink)' : 'none' }} />
                        <span className="mono" style={{ fontSize: 11, textAlign: 'center', color: b.current ? 'var(--text-1)' : 'var(--text-3)' }}>{b.label.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                  <span className="c3 t-cap">Mln so‘m · faqat «Keldi» deb belgilangan bronlar. Onlayn to‘lov yo‘q – summa stadionda olingan pul.{range === 'week' ? ' Kelgusi kunlar – tasdiqlangan reja.' : ''}</span>
                </div>
                <div className="card col" style={{ padding: 20, gap: 14 }}>
                  <span className="t-card" style={{ fontSize: 18 }}>Maydonlar bo‘yicha</span>
                  {r.pitches.map((p) => (
                    <div key={p.id} className="col" style={{ gap: 6, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                      <div className="row between"><b>{p.name}</b><span className="mono" style={{ fontSize: 14 }}>{mln(p.revenue)} so‘m</span></div>
                      <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-2)' }}><div style={{ width: `${Math.min(100, p.occupancy)}%`, height: '100%', borderRadius: 999, background: 'var(--primary)' }} /></div>
                      <div className="row between mono c2" style={{ fontSize: 12 }}><span>{p.occupancy}% bandlik</span><span>{p.bookings} bron</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card col" style={{ padding: 20, gap: 12 }}>
                <div className="col"><span className="t-card" style={{ fontSize: 18 }}>Eng band soatlar</span><span className="c2" style={{ fontSize: 13 }}>Rang qancha to‘q bo‘lsa, bandlik shuncha yuqori. Bo‘sh soatlarga chegirma qo‘yishni o‘ylab ko‘ring.</span></div>
                <div className="scroll-x"><div style={{ minWidth: 720 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(16,1fr)', gap: 4 }}><span />{Array.from({ length: 16 }, (_, i) => <span key={i} className="mono c3" style={{ fontSize: 10 }}>{String(8 + i).padStart(2, '0')}</span>)}</div>
                  {r.heat.map((row, d) => (
                    <div key={d} style={{ display: 'grid', gridTemplateColumns: '40px repeat(16,1fr)', gap: 4, marginTop: 4 }}>
                      <span className="mono c2" style={{ fontSize: 11 }}>{DOW[d].toUpperCase()}</span>
                      {row.map((n, h) => <span key={h} title={`${DOW[d]} ${8 + h}:00 · ${n} bron`} style={{ height: 22, borderRadius: 4, background: n ? `color-mix(in srgb, var(--brand-ink) ${Math.round((n / r.heatMax) * 85) + 10}%, var(--surface-2))` : 'var(--surface-2)' }} />)}
                    </div>
                  ))}
                </div></div>
              </div>
              <div className="card col" style={{ padding: 20, gap: 12 }}>
                <div className="row between"><span className="t-card" style={{ fontSize: 18 }}>Kelmaganlar</span><span className="c2 t-small">3 marta kelmagan futbolchi 7 kunga avtomatik bloklanadi</span></div>
                {!r.noShowList.length ? <Empty icon="sentiment_satisfied" title="Bu davrda kelmaganlar yo‘q" /> : r.noShowList.map((n) => (
                  <div key={n.id} className="row wrap" style={{ gap: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                    <Avatar name={n.user.name} size={36} />
                    <span className="col grow"><b style={{ fontSize: 14 }}>{n.user.name}</b><span className="mono c3" style={{ fontSize: 11 }}>{phone(n.user.phone)}</span></span>
                    <span className="mono c2" style={{ fontSize: 12 }}>{dayMonthShort(n.date)} · {n.start} · {n.code}</span>
                    <span className="mono" style={{ fontSize: 13 }}>{sum(n.price)}</span>
                    <span className={`pill-tag ${n.user.noShows >= 3 ? 'error' : 'warning'}`}>{n.user.noShows} marta</span>
                  </div>
                ))}
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}
