'use client';
import { useEffect, useState } from 'react';
import { Async, Empty, Icon, Loading } from '@/components/ui';
import { AdminHeader } from '@/components/admin';
import { useApi } from '@/lib/useApi';
import { qs } from '@/lib/api';
import { dayMonthShort, hhmm, isoDate } from '@/lib/format';

type L = { id: string; at: string; who: string; role: string | null; action: string; text: string; targetType: string | null };
const ICON: Record<string, string> = { stadium: 'stadium', booking: 'event_note', user: 'person', report: 'flag', dispute: 'gavel', staff: 'badge' };

export default function AdminAudit() {
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t); }, [q]);
  const r = useApi<{ items: L[] }>(`/admin/audit${qs({ q: dq })}`);
  let last = '';
  return (
    <>
      <AdminHeader title="Jurnal" />
      <div className="row between wrap" style={{ gap: 12 }}>
        <p className="c2" style={{ fontSize: 15 }}>Moderatorlar, stadion egalari va tizimning barcha muhim harakatlari.</p>
        <div className="search" style={{ height: 44, width: 'min(320px,100%)' }}><Icon n="search" size={20} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidirish: FG-2449, @kamol_y…" aria-label="Qidirish" /></div>
      </div>
      <Async q={r} loading={<Loading rows={5} />} empty={(d) => !d.items.length && <div className="card"><Empty icon="history" title="Yozuv topilmadi" /></div>}>
        {(d) => (
          <div className="card col" style={{ padding: '8px 20px' }}>
            {d.items.map((l) => {
              const day = isoDate(l.at);
              const sep = day !== last;
              last = day;
              return (
                <div key={l.id}>
                  {sep && <div className="label-sm c3" style={{ padding: '14px 0 6px' }}>{dayMonthShort(day)}</div>}
                  <div className="row" style={{ gap: 14, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
                    <span className="mono c3" style={{ fontSize: 12, width: 44, flexShrink: 0, paddingTop: 2 }}>{hhmm(l.at)}</span>
                    <Icon n={ICON[l.action.split('.')[0]] ?? 'bolt'} size={20} style={{ color: 'var(--text-2)' }} />
                    <span className="grow" style={{ fontSize: 14 }}><b>{l.who}</b> <span className="c2">{l.text}</span></span>
                    <span className="mono c3 hide-mobile" style={{ fontSize: 11 }}>{l.action}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Async>
    </>
  );
}
