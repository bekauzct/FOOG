'use client';
import { useEffect, useState } from 'react';
import { Async, Btn, Icon, Loading, Toggle } from '@/components/ui';
import { NoStadium, OwnerHeader, useOwner } from '@/components/owner';
import { useApi } from '@/lib/useApi';
import { del, post, put, qs } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useEvent } from '@/lib/session';
import { DOW, DOW_FULL, MONTHS, addDays } from '@/lib/format';

type Slot = { hour: number; state: string; who?: string; blockId?: string };
type Sched = { stadium: { id: string; name: string }; pitches: { id: string; name: string; size: string }[]; pitchId: string; today: string; week: string; hours: { weekday: number; closed: boolean; open: number; close: number }[]; days: { date: string; slots: Slot[] }[] };
const pad = (n: number) => String(n).padStart(2, '0');

export default function SchedulePage() {
  const { current, stadiums, loading } = useOwner();
  const toast = useToast();
  const [pitch, setPitch] = useState<string | null>(null);
  const [week, setWeek] = useState<string | null>(null);
  const q = useApi<Sched>(current ? `/owner/schedule${qs({ stadiumId: current.id, pitchId: pitch, week })}` : null, [current?.id]);
  const [hours, setHours] = useState<Sched['hours'] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyCell, setBusyCell] = useState<string | null>(null);
  useEffect(() => { if (q.data && !dirty) setHours(q.data.hours); }, [q.data]);
  useEffect(() => { setPitch(null); setWeek(null); setDirty(false); }, [current?.id]);
  useEvent('booking', () => q.reload());
  if (!loading && stadiums && !stadiums.length) return <><OwnerHeader title="Jadval" /><NoStadium /></>;

  const saveHours = async () => {
    if (!hours || !current) return;
    setSaving(true);
    try { await put('/owner/schedule/hours', { stadiumId: current.id, days: hours }); toast('Ish vaqti saqlandi'); setDirty(false); q.reload(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setSaving(false); }
  };
  const toggleCell = async (date: string, s: Slot, pitchId: string) => {
    const key = `${date}-${s.hour}`;
    if (s.state === 'booked' || s.state === 'pending') return toast(`Band soatni yopib bo‘lmaydi${s.who ? ` (${s.who})` : ''}. Avval bronni bekor qiling.`, { kind: 'warn' });
    if (s.state === 'closed' || s.state === 'past') return;
    setBusyCell(key);
    try {
      if (s.state === 'blocked' && s.blockId) await del(`/owner/schedule/block/${s.blockId}`);
      else await post('/owner/schedule/block', { pitchId, date, hour: s.hour });
      q.reload();
    } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusyCell(null); }
  };
  const setH = (d: number, p: Partial<Sched['hours'][0]>) => { setHours((h) => h?.map((x) => (x.weekday === d ? { ...x, ...p } : x)) ?? null); setDirty(true); };

  return (
    <>
      <OwnerHeader title="Jadval" />
      <Async q={q} loading={<Loading rows={3} />}>
        {(d) => {
          const wk = d.week;
          const end = addDays(wk, 6);
          const range = `${Number(wk.slice(8))}${wk.slice(5, 7) !== end.slice(5, 7) ? `-${MONTHS[Number(wk.slice(5, 7)) - 1]}` : ''}–${Number(end.slice(8))}-${MONTHS[Number(end.slice(5, 7)) - 1]}`;
          const hoursArr = Array.from({ length: 16 }, (_, i) => 8 + i);
          return (
            <div className="ow-side">
              <div className="card col" style={{ padding: 20, gap: 14 }}>
                <div className="col"><span className="t-card" style={{ fontSize: 18 }}>Ish vaqti</span><span className="c2" style={{ fontSize: 13 }}>Bu vaqtdan tashqarida bron qabul qilinmaydi.</span></div>
                {hours?.map((h) => (
                  <div key={h.weekday} className="row between" style={{ gap: 8, minHeight: 44 }}>
                    <b style={{ fontSize: 14, width: 92, flexShrink: 0, color: h.closed ? 'var(--text-3)' : undefined }}>{DOW_FULL[h.weekday]}</b>
                    {h.closed ? <span className="c3 t-small grow" style={{ textAlign: 'right' }}>Dam olish kuni</span> : (
                      <span className="row mono grow" style={{ gap: 4, fontSize: 13, justifyContent: 'flex-end' }}>
                        <select className="sel-mini" value={h.open} onChange={(e) => setH(h.weekday, { open: +e.target.value })} aria-label={`${DOW_FULL[h.weekday]} ochilish`}>{Array.from({ length: 17 }, (_, i) => 6 + i).map((x) => <option key={x} value={x}>{pad(x)}:00</option>)}</select>
                        –
                        <select className="sel-mini" value={h.close} onChange={(e) => setH(h.weekday, { close: +e.target.value })} aria-label={`${DOW_FULL[h.weekday]} yopilish`}>{Array.from({ length: 14 }, (_, i) => 11 + i).map((x) => <option key={x} value={x}>{pad(x)}:00</option>)}</select>
                      </span>
                    )}
                    <Toggle on={!h.closed} onChange={(v) => setH(h.weekday, { closed: !v })} label={`${DOW_FULL[h.weekday]} ochiq`} />
                  </div>
                ))}
                <div className="well c2" style={{ padding: 14, fontSize: 13, lineHeight: 1.5 }}>Kechki {d.pitches.length ? '18:00' : ''}–23:00 – «peak» soatlar. Narxni Stadionlarim bo‘limida o‘zgartirasiz.</div>
                <Btn className="btn btn-primary btn-block" disabled={!dirty} loading={saving} onClick={saveHours}>Ish vaqtini saqlash</Btn>
              </div>
              <div className="card col" style={{ padding: 20, gap: 16, minWidth: 0 }}>
                <div className="row between wrap" style={{ gap: 12 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="icon-btn sm" onClick={() => setWeek(addDays(wk, -7))} aria-label="Oldingi hafta"><Icon n="chevron_left" /></button>
                    <div className="col"><span className="t-card" style={{ fontSize: 18 }}>{range}</span><span className="c2" style={{ fontSize: 13 }}>Bo‘sh katakni bosing – soat yopiladi. Yana bosing – ochiladi.</span></div>
                    <button className="icon-btn sm" onClick={() => setWeek(addDays(wk, 7))} aria-label="Keyingi hafta"><Icon n="chevron_right" /></button>
                  </div>
                  <div className="seg scroll-x">{d.pitches.map((p) => <button key={p.id} className={d.pitchId === p.id ? 'on' : ''} onClick={() => setPitch(p.id)}>{p.name}</button>)}</div>
                </div>
                <div className="scroll-x">
                  <div style={{ minWidth: 720 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7,1fr)', gap: 6, marginBottom: 6 }}>
                      <span />
                      {d.days.map((x, i) => {
                        const on = x.date === d.today;
                        return <div key={x.date} className="col" style={{ alignItems: 'center', padding: '6px 0', borderRadius: 10, background: on ? 'var(--inverse)' : 'transparent', color: on ? 'var(--on-inverse)' : 'var(--text-2)' }}><span className="mono" style={{ fontSize: 10, letterSpacing: '.1em' }}>{DOW[i].toUpperCase()}</span><span className="mono" style={{ fontSize: 16, fontWeight: 500 }}>{Number(x.date.slice(8))}</span></div>;
                      })}
                    </div>
                    {hoursArr.map((h) => (
                      <div key={h} style={{ display: 'grid', gridTemplateColumns: '56px repeat(7,1fr)', gap: 6, marginBottom: 6 }}>
                        <span className="mono c3" style={{ fontSize: 12, alignSelf: 'center' }}>{pad(h)}:00</span>
                        {d.days.map((x) => {
                          const s = x.slots.find((y) => y.hour === h);
                          if (!s) return <span key={x.date} />;
                          const key = `${x.date}-${h}`;
                          const st = s.state;
                          const style: React.CSSProperties = st === 'booked' ? { background: 'var(--primary)', color: 'var(--on-primary)' } : st === 'pending' ? { background: 'var(--warning)', color: '#091025' }
                            : st === 'blocked' ? { background: 'repeating-linear-gradient(135deg,var(--surface-2) 0 4px,var(--border) 4px 5px)', color: 'var(--text-2)' }
                              : st === 'closed' ? { background: 'var(--bg)', color: 'var(--text-3)', cursor: 'not-allowed' } : st === 'past' ? { background: 'transparent', boxShadow: 'inset 0 0 0 1px var(--border)', opacity: 0.4, cursor: 'default' } : { background: 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--border)' };
                          return (
                            <button key={x.date} onClick={() => toggleCell(x.date, s, d.pitchId)} disabled={busyCell === key} title={`${pad(h)}:00 · ${s.who ?? (st === 'blocked' ? 'Yopiq – ochish uchun bosing' : st === 'closed' ? 'Ish vaqtidan tashqari' : st === 'past' ? 'O‘tgan' : 'Bo‘sh – yopish uchun bosing')}`}
                              className="ellipsis" style={{ height: 32, borderRadius: 8, border: 'none', padding: '0 8px', fontSize: 11, fontWeight: 600, textAlign: 'left', ...style, opacity: busyCell === key ? 0.5 : style.opacity }}>
                              {st === 'booked' || st === 'pending' ? s.who?.split(' ').slice(0, 2).map((w, i) => (i ? w[0] + '.' : w)).join(' ') : st === 'blocked' ? 'Yopiq' : ''}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="row wrap c2" style={{ gap: 16, fontSize: 12 }}>
                  {([['transparent', 'Bo‘sh'], ['var(--primary)', 'Band'], ['var(--warning)', 'Tasdiq kutilmoqda'], ['repeating-linear-gradient(135deg,var(--surface-2) 0 3px,var(--border-strong) 3px 4px)', 'Yopiq (siz yopgansiz)'], ['var(--bg)', 'Ish vaqtidan tashqari']] as const).map(([c, l]) => <span key={l} className="row" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c, boxShadow: c === 'transparent' ? 'inset 0 0 0 1.5px var(--border-strong)' : 'none' }} />{l}</span>)}
                </div>
              </div>
            </div>
          );
        }}
      </Async>
    </>
  );
}
