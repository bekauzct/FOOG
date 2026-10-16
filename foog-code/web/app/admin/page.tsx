'use client';
import Link from 'next/link';
import { Async, Icon, Loading } from '@/components/ui';
import { Kpi } from '@/components/owner';
import { AdminHeader } from '@/components/admin';
import { useApi } from '@/lib/useApi';
import { dayMonthShort, hhmm, num, ago } from '@/lib/format';

type O = {
  kpis: { users: number; usersWeek: number; live: number; mod: number; todayBookings: number; todayConfirmedPct: number; reportsOpen: number; disputesOpen: number };
  bars: { date: string; value: number }[]; total: number; delta: number | null;
  queue: { stadiums: number; reports: number; disputes: number; noShows: number };
  districts: { name: string; stadiums: number; occupancy: number }[];
  log: { id: string; at: string; who: string; text: string }[];
};

export default function AdminOverview() {
  const q = useApi<O>('/admin/overview');
  return (
    <>
      <AdminHeader title="Umumiy ko‘rinish" />
      <Async q={q} loading={<Loading rows={4} />}>
        {(d) => {
          const max = Math.max(1, ...d.bars.map((b) => b.value));
          const queue = [
            { href: '/admin/stadiums', icon: 'stadium', t: 'Stadion arizalari', s: 'Tasdiqlash yoki rad etish', n: d.queue.stadiums, c: 'var(--warning)' },
            { href: '/admin/content', icon: 'flag', t: 'Kontent shikoyatlari', s: 'Post, reel, izoh', n: d.queue.reports, c: 'var(--error)' },
            { href: '/admin/bookings?filter=dispute', icon: 'gavel', t: 'Bron nizolari', s: '«Kelmadi» bahslari', n: d.queue.disputes, c: 'var(--accent)' },
            { href: '/admin/users?filter=noshow', icon: 'person_alert', t: 'Ko‘p kelmaganlar', s: '3+ marta kelmagan futbolchilar', n: d.queue.noShows, c: 'var(--text-2)' },
          ];
          return (
            <>
              <div className="ow-kpis">
                <Kpi label="Foydalanuvchilar" icon="group" value={num(d.kpis.users)} sub={`+${num(d.kpis.usersWeek)} shu hafta`} />
                <Kpi label="Faol stadionlar" icon="stadium" value={String(d.kpis.live)} sub={`${d.kpis.mod} ta moderatsiyada`} color="var(--brand-ink)" />
                <Kpi label="Bugungi bronlar" icon="event" value={num(d.kpis.todayBookings)} sub={`${d.kpis.todayConfirmedPct}% tasdiqlangan`} />
                <Kpi label="Ochiq shikoyatlar" icon="flag" value={String(d.kpis.reportsOpen + d.kpis.disputesOpen)} sub={`${d.kpis.reportsOpen} kontent · ${d.kpis.disputesOpen} nizo`} color={d.kpis.reportsOpen + d.kpis.disputesOpen ? 'var(--error)' : 'var(--success)'} />
              </div>
              <div className="ow-two">
                <div className="card col" style={{ padding: 20, gap: 14 }}>
                  <div className="row between wrap" style={{ gap: 8 }}>
                    <div className="col"><span className="t-card" style={{ fontSize: 18 }}>Bronlar · so‘nggi 14 kun</span><span className="mono" style={{ fontSize: 26 }}>{num(d.total)}</span></div>
                    {d.delta != null && <span className={`pill-tag ${d.delta >= 0 ? 'success' : 'error'}`} style={{ textTransform: 'none' }}><Icon n={d.delta >= 0 ? 'trending_up' : 'trending_down'} size={16} />{d.delta >= 0 ? '+' : ''}{d.delta}%</span>}
                  </div>
                  <div className="row" style={{ alignItems: 'flex-end', gap: 6, height: 180 }}>
                    {d.bars.map((b, i) => <div key={b.date} title={`${dayMonthShort(b.date)} · ${b.value} bron`} style={{ flex: 1, height: `${Math.max(3, (b.value / max) * 100)}%`, borderRadius: 6, background: i === d.bars.length - 1 ? 'var(--primary)' : 'color-mix(in srgb, var(--brand-ink) 22%, transparent)' }} />)}
                  </div>
                  <div className="row between mono c3" style={{ fontSize: 11 }}><span>{dayMonthShort(d.bars[0].date)}</span><span>{dayMonthShort(d.bars[7].date)}</span><span>{dayMonthShort(d.bars[13].date)}</span></div>
                </div>
                <div className="card col" style={{ padding: 20, gap: 10 }}>
                  <span className="t-card" style={{ fontSize: 18 }}>Navbatdagi ishlar</span>
                  {queue.map((x) => (
                    <Link key={x.t} href={x.href} className="row" style={{ gap: 12, padding: 12, borderRadius: 14, boxShadow: 'inset 0 0 0 1px var(--border)', color: 'var(--text-1)' }}>
                      <span style={{ width: 36, height: 36, borderRadius: 10, background: `color-mix(in srgb, ${x.c} 16%, transparent)`, color: x.c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n={x.icon} size={20} /></span>
                      <span className="col grow"><b style={{ fontSize: 15 }}>{x.t}</b><span className="c2" style={{ fontSize: 12 }}>{x.s}</span></span>
                      <span className="mono" style={{ fontSize: 18, color: x.n ? x.c : 'var(--text-3)' }}>{x.n}</span><Icon n="chevron_right" size={20} style={{ color: 'var(--text-3)' }} />
                    </Link>
                  ))}
                </div>
              </div>
              <div className="ow-two">
                <div className="card col" style={{ padding: 20, gap: 10 }}>
                  <div className="col"><span className="t-card" style={{ fontSize: 18 }}>Tumanlar bo‘yicha</span><span className="c2" style={{ fontSize: 13 }}>Faol stadionlar va bugungi bandlik</span></div>
                  {d.districts.map((x) => (
                    <div key={x.name} className="row" style={{ gap: 14, fontSize: 14 }}>
                      <b style={{ width: 140, flexShrink: 0 }}>{x.name}</b>
                      <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--surface-2)' }}><div style={{ width: `${x.occupancy}%`, height: '100%', borderRadius: 999, background: 'var(--primary)' }} /></div>
                      <span className="mono c2" style={{ fontSize: 12, width: 90, textAlign: 'right' }}>{x.stadiums} ta · {x.occupancy}%</span>
                    </div>
                  ))}
                </div>
                <div className="card col" style={{ padding: 20, gap: 4 }}>
                  <div className="row between"><span className="t-card" style={{ fontSize: 18 }}>Faoliyat jurnali</span><Link href="/admin/audit" style={{ fontSize: 14, fontWeight: 600 }}>Hammasi</Link></div>
                  {d.log.map((l) => (
                    <div key={l.id} className="row" style={{ gap: 14, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
                      <span className="mono c3" style={{ fontSize: 12, width: 44, flexShrink: 0, paddingTop: 2 }} title={ago(l.at)}>{hhmm(l.at)}</span>
                      <span style={{ fontSize: 14 }}><b>{l.who}</b> <span className="c2">{l.text}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}
