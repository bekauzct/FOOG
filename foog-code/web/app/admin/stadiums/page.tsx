'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Async, Btn, Empty, Icon, Loading, Seg } from '@/components/ui';
import { AdminHeader } from '@/components/admin';
import { useApi } from '@/lib/useApi';
import { patch, put, qs } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { SIZE_LABEL, SURFACE_LABEL, ago, phone, sum } from '@/lib/format';

type S = {
  id: string; code: string; name: string; district: string; address: string; lat: number; lng: number; status: string; createdAt: string; rejectReason: string | null;
  checklist: Record<string, boolean>; owner: { id: string; name: string; username: string | null; phone: string | null; telegram: boolean; stir: string | null };
  photos: string[]; pitches: { name: string; size: string; surface: string; indoor: boolean; price: number }[];
};
type R = { checks: string[]; reasons: string[]; counts: { mod: number }; items: S[] };
const TAG: Record<string, [string, string]> = { mod: ['Moderatsiyada', 'warning'], live: ['Faol', 'success'], off: ['To‘xtatilgan', 'error'], rejected: ['Rad etilgan', 'error'] };

function Inner() {
  const sp = useSearchParams();
  const [status, setStatus] = useState<'mod' | 'live' | 'off'>('mod');
  const [sel, setSel] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const q = useApi<R>(`/admin/stadiums${qs({ status, q: sp.get('q') })}`);
  const items = q.data?.items ?? [];
  const s = items.find((x) => x.id === sel) ?? items[0];
  useEffect(() => { if (s) setChecks(s.checklist ?? {}); setRejecting(false); setReason(null); }, [s?.id]);
  const all = q.data ? q.data.checks.every((_, i) => checks[i]) : false;
  const done = q.data ? q.data.checks.filter((_, i) => checks[i]).length : 0;
  const toggle = async (i: number) => {
    if (!s) return;
    const next = { ...checks, [i]: !checks[i] };
    setChecks(next);
    try { await put(`/admin/stadiums/${s.id}/checklist`, { checklist: next }); } catch { /* holat lokal saqlanadi */ }
  };
  const act = async (action: 'approve' | 'reject' | 'suspend' | 'activate') => {
    if (!s) return;
    setBusy(action);
    try {
      await patch(`/admin/stadiums/${s.id}`, { action, reason: reason ?? undefined, checklist: checks });
      toast(action === 'approve' ? `${s.name} tasdiqlandi · egasiga Telegram xabar ketdi` : action === 'reject' ? `${s.name} rad etildi: ${reason}` : action === 'suspend' ? `${s.name} to‘xtatildi · yangi bronlar yopildi` : `${s.name} qayta faol`, { kind: action === 'approve' || action === 'activate' ? 'ok' : 'warn' });
      setSel(null); q.reload();
    } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(null); }
  };
  return (
    <>
      <AdminHeader title="Stadionlar" />
      <Seg value={status} onChange={(v) => { setStatus(v); setSel(null); }} items={[['mod', 'Moderatsiyada', q.data?.counts.mod], ['live', 'Faol'], ['off', 'To‘xtatilgan']]} />
      <Async q={q} loading={<Loading rows={3} />} empty={(d) => !d.items.length && <div className="card"><Empty icon="task_alt" title={status === 'mod' ? 'Yangi ariza yo‘q' : 'Ro‘yxat bo‘sh'} text={status === 'mod' ? 'Yangi stadion arizasi kelganda shu yerda paydo bo‘ladi.' : undefined} /></div>}>
        {(d) => (
          <div className="ow-side ad-side">
            <div className="col" style={{ gap: 10 }}>
              {d.items.map((x) => (
                <button key={x.id} onClick={() => setSel(x.id)} className="row card" style={{ gap: 12, padding: 12, textAlign: 'left', color: 'var(--text-1)', boxShadow: s?.id === x.id ? 'inset 0 0 0 2px var(--brand-ink)' : undefined, border: s?.id === x.id ? '1px solid transparent' : undefined }}>
                  <span className="ph" style={{ width: 56, height: 56, borderRadius: 10, flexShrink: 0, background: x.photos[0] ? `center/cover url("${x.photos[0]}")` : undefined }} />
                  <span className="col grow" style={{ minWidth: 0 }}><b className="ellipsis">{x.name}</b><span className="c2 ellipsis" style={{ fontSize: 12 }}>{x.district} · {x.owner.name}</span><span className="mono c3" style={{ fontSize: 11 }}>{ago(x.createdAt)}</span></span>
                </button>
              ))}
            </div>
            {s && (
              <div className="card col" style={{ padding: 24, gap: 18, minWidth: 0 }}>
                <div className="row between wrap" style={{ gap: 8 }}>
                  <div className="col" style={{ gap: 2 }}><span className="label-sm c3">{s.code} · ariza {ago(s.createdAt)}</span><h2 className="t-h3" style={{ fontSize: 26 }}>{s.name}</h2><span className="c2 t-small">{s.address}</span></div>
                  <span className={`pill-tag ${TAG[s.status][1]}`}>{TAG[s.status][0]}</span>
                </div>
                {s.rejectReason && s.status !== 'live' && <div className="well c2 t-small" style={{ padding: 12 }}>Oldingi rad etish sababi: <b style={{ color: 'var(--text-1)' }}>{s.rejectReason}</b></div>}
                <div className="os-photos" style={{ gridTemplateRows: '100px 100px' }}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <a key={i} href={s.photos[i] ?? '#'} target="_blank" rel="noreferrer" className={`ph ${i === 0 ? 'os-main' : ''}`} style={{ borderRadius: 14, position: 'relative', background: s.photos[i] ? `center/cover url("${s.photos[i]}")` : undefined }}>
                      {i === 0 && <span className="mono" style={{ position: 'absolute', left: 10, bottom: 10, fontSize: 11, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.7)' }}>{s.photos.length} ta rasm yuklangan</span>}
                    </a>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20 }}>
                  <div className="col" style={{ gap: 4 }}>
                    <b style={{ fontSize: 14 }}>Egasi</b>
                    {([['Ism', s.owner.name], ['Telegram', s.owner.username ? `@${s.owner.username}` : '—'], ['Telefon', phone(s.owner.phone)], ['STIR', s.owner.stir ?? '—']] as const).map(([k, v]) => <div key={k} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}><span className="c2">{k}</span><b style={{ fontWeight: 600 }}>{v}</b></div>)}
                    <a href={`https://yandex.uz/maps/?pt=${s.lng},${s.lat}&z=16`} target="_blank" rel="noreferrer" className="row" style={{ gap: 6, fontSize: 13, paddingTop: 8 }}><Icon n="map" size={18} />Xaritada tekshirish</a>
                  </div>
                  <div className="col" style={{ gap: 4 }}>
                    <b style={{ fontSize: 14 }}>Maydonlar</b>
                    {s.pitches.map((p) => <div key={p.name} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}><span>{p.name} <span className="c2">· {SIZE_LABEL[p.size]} · {SURFACE_LABEL[p.surface].toLowerCase()}{p.indoor ? ' · yopiq' : ''}</span></span><span className="mono">{sum(p.price)}</span></div>)}
                  </div>
                </div>
                {s.status === 'mod' && (
                  <div className="col" style={{ gap: 8 }}>
                    <b style={{ fontSize: 14 }}>Tekshiruv ro‘yxati</b>
                    {d.checks.map((c, i) => (
                      <button key={c} type="button" role="checkbox" aria-checked={!!checks[i]} onClick={() => toggle(i)} className="row" style={{ gap: 12, padding: '12px 14px', borderRadius: 12, background: 'var(--bg)', border: 'none', color: 'var(--text-1)', textAlign: 'left', minHeight: 48 }}>
                        <span className={`check ${checks[i] ? 'on' : ''}`} aria-hidden="true">{checks[i] && <Icon n="check" size={16} />}</span>
                        <span className="grow" style={{ fontSize: 14 }}>{c}</span>
                        {i === 3 && <span className="mono c3" style={{ fontSize: 11 }}>{s.owner.telegram ? 'avto' : 'tekshiring'}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {rejecting && <div className="row wrap" style={{ gap: 8 }}>{d.reasons.map((r) => <button key={r} className="chip" style={reason === r ? { background: 'var(--error)', color: '#fff', boxShadow: 'none' } : undefined} onClick={() => setReason(r)}>{r}</button>)}</div>}
                <div className="row between wrap" style={{ gap: 12, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  {s.status === 'mod' ? (
                    <>
                      <span className="c2 t-small" style={{ flex: '1 1 240px' }}>{all ? 'Hammasi tekshirildi. Tasdiqlangach stadion futbolchilarga ko‘rinadi.' : `${done} / ${d.checks.length} tekshirildi – tasdiqlash uchun hammasini belgilang.`}</span>
                      <div className="row" style={{ gap: 8 }}>
                        <Btn className={`btn ${rejecting && reason ? 'btn-danger' : 'btn-outline'}`} loading={busy === 'reject'} onClick={() => (!rejecting ? setRejecting(true) : reason && act('reject'))}>{rejecting ? (reason ? 'Rad etishni yuborish' : 'Sababni tanlang') : 'Rad etish'}</Btn>
                        <Btn className="btn btn-primary" disabled={!all} loading={busy === 'approve'} onClick={() => act('approve')}>Tasdiqlash va chiqarish</Btn>
                      </div>
                    </>
                  ) : (
                    <>
                      <Link href={`/stadiums/${s.id}`} className="btn btn-outline">Saytda ko‘rish</Link>
                      {s.status !== 'rejected' && <Btn className={`btn ${s.status === 'live' ? 'btn-danger-outline' : 'btn-primary'}`} loading={busy === 'suspend' || busy === 'activate'} onClick={() => act(s.status === 'live' ? 'suspend' : 'activate')}>{s.status === 'live' ? 'Vaqtincha to‘xtatish' : 'Qayta faollashtirish'}</Btn>}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Async>
    </>
  );
}

export default function AdminStadiums() {
  return <Suspense><Inner /></Suspense>;
}
