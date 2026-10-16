'use client';
import { useSearchParams } from 'next/navigation';
import { Fragment, Suspense, useState } from 'react';
import { Async, Btn, Empty, Icon, Loading, Seg } from '@/components/ui';
import { AdminHeader } from '@/components/admin';
import { useApi } from '@/lib/useApi';
import { patch, qs } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { BOOKING_STATUS, ago, relDay, sum } from '@/lib/format';

type B = { id: string; code: string; date: string; start: string; price: number; status: string; stadium: { name: string }; user: { name: string; phone: string | null; noShows: number }; dispute: { id: string; reason: string; status: string; createdAt: string } | null };

function Inner() {
  const sp = useSearchParams();
  const [filter, setFilter] = useState<'all' | 'today' | 'dispute'>((sp.get('filter') as 'all') || 'all');
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const q = useApi<{ counts: { disputes: number }; items: B[] }>(`/admin/bookings${qs({ filter, q: sp.get('q') })}`);
  const resolve = async (b: B, decision: 'owner' | 'player') => {
    if (!b.dispute) return;
    setBusy(b.id + decision);
    try { await patch(`/admin/disputes/${b.dispute.id}`, { decision, note: note[b.id] || undefined }); toast(`${b.code} nizosi ${decision === 'owner' ? 'egasi' : 'futbolchi'} foydasiga yopildi`); q.reload(); }
    catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(null); }
  };
  return (
    <>
      <AdminHeader title="Bronlar" />
      <div className="row between wrap" style={{ gap: 12 }}>
        <Seg value={filter} onChange={setFilter} items={[['all', 'Hammasi'], ['today', 'Bugun'], ['dispute', 'Nizolar', q.data?.counts.disputes]]} />
        <span className="c2 t-small">To‘lov stadionda bo‘lgani uchun nizolar faqat «Kelmadi» va bekor qilish holatlarida.</span>
      </div>
      <Async q={q} loading={<Loading rows={5} />} empty={(d) => !d.items.length && <div className="card"><Empty icon="event_note" title={filter === 'dispute' ? 'Ochiq nizo yo‘q' : 'Bron topilmadi'} /></div>}>
        {(d) => (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="ow-table">
              <thead><tr><th>ID</th><th>Futbolchi</th><th>Stadion</th><th>Vaqt</th><th>Summa</th><th>Holat</th></tr></thead>
              <tbody>
                {d.items.map((b) => {
                  const open = b.dispute?.status === 'open';
                  const [label, tone] = open ? ['Nizo', 'error'] : BOOKING_STATUS[b.status] ?? [b.status, 'muted'];
                  return (
                    <Fragment key={b.id}>
                      <tr>
                        <td className="mono c2" style={{ fontSize: 13 }}>{b.code}</td>
                        <td><b style={{ fontSize: 14 }}>{b.user.name}</b>{b.user.noShows > 0 && <div className="mono" style={{ fontSize: 11, color: b.user.noShows >= 3 ? 'var(--error)' : 'var(--text-3)' }}>{b.user.noShows} marta kelmagan</div>}</td>
                        <td style={{ fontSize: 14 }}>{b.stadium.name}</td>
                        <td className="mono" style={{ fontSize: 13 }}>{relDay(b.date)} {b.start}</td>
                        <td className="mono" style={{ fontSize: 13 }}>{sum(b.price)}</td>
                        <td><span className={`pill-tag ${tone}`}>{label}</span></td>
                      </tr>
                      {open && b.dispute && (
                        <tr>
                          <td colSpan={6} style={{ background: 'color-mix(in srgb, var(--error) 6%, transparent)' }}>
                            <div className="row wrap" style={{ gap: 12, alignItems: 'flex-start' }}>
                              <Icon n="gavel" style={{ color: 'var(--accent)' }} />
                              <div className="col grow" style={{ gap: 6, minWidth: 240 }}>
                                <span style={{ fontSize: 14 }}><b>Futbolchi e’tirozi:</b> <span className="c2">{b.dispute.reason}</span></span>
                                <span className="mono c3" style={{ fontSize: 11 }}>{ago(b.dispute.createdAt)} · egasi «Kelmadi» deb belgilagan</span>
                                <input className="input" style={{ height: 40 }} value={note[b.id] ?? ''} onChange={(e) => setNote({ ...note, [b.id]: e.target.value })} placeholder="Qaror izohi (ikkala tomonga yuboriladi)" />
                              </div>
                              <div className="row" style={{ gap: 8 }}>
                                <Btn className="btn btn-outline btn-sm" loading={busy === b.id + 'owner'} onClick={() => resolve(b, 'owner')}>Egasi foydasiga</Btn>
                                <Btn className="btn btn-primary btn-sm" loading={busy === b.id + 'player'} onClick={() => resolve(b, 'player')}>Futbolchi foydasiga</Btn>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Async>
    </>
  );
}

export default function AdminBookings() {
  return <Suspense><Inner /></Suspense>;
}
