'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Async, Btn, Empty, Icon, Loading, Modal, Seg } from '@/components/ui';
import { AdminHeader } from '@/components/admin';
import { useApi } from '@/lib/useApi';
import { del, patch, post, qs } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { SKILL_LABEL, ago, dayMonth } from '@/lib/format';

type Rep = { targetType: 'post' | 'reel' | 'comment' | 'user'; targetId: string; count: number; reason: string; note: string | null; author: { id: string; name: string; username: string | null }; text: string; mediaUrl: string | null; video: string | null; hidden: boolean; firstAt: string };
const KIND: Record<string, string> = { post: 'Post', reel: 'Reel', comment: 'Izoh', user: 'Profil' };

function Reports() {
  const q = useApi<{ items: Rep[] }>('/admin/reports');
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const act = async (r: Rep, action: 'keep' | 'warn' | 'remove') => {
    setBusy(r.targetId + action);
    try { await patch('/admin/reports', { targetType: r.targetType, targetId: r.targetId, action }); toast(action === 'keep' ? 'Kontent qoldirildi · shikoyat yopildi' : action === 'warn' ? `@${r.author.username} ga ogohlantirish yuborildi` : `${KIND[r.targetType]} o‘chirildi`, { kind: action === 'remove' ? 'warn' : 'ok' }); q.reload(); }
    catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(null); }
  };
  return (
    <>
      <div className="row between wrap" style={{ gap: 8 }}><p className="c2" style={{ fontSize: 15 }}>Foydalanuvchilar shikoyat qilgan postlar, reellar va izohlar. 5+ shikoyat – avtomatik yashiriladi.</p>{q.data && <span className="mono c2" style={{ fontSize: 13 }}>{q.data.items.length} ta ochiq</span>}</div>
      <Async q={q} loading={<Loading rows={3} />} empty={(d) => !d.items.length && <div className="card"><Empty icon="verified_user" title="Ochiq shikoyat yo‘q" text="Hamma shikoyatlar ko‘rib chiqildi." /></div>}>
        {(d) => (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(380px,1fr))', gap: 16 }} className="ad-content">
            {d.items.map((r) => (
              <div key={r.targetId} className="card row" style={{ padding: 16, gap: 16, alignItems: 'flex-start' }}>
                <div className="ph" style={{ width: 110, flexShrink: 0, aspectRatio: r.targetType === 'reel' ? '9/16' : '1', borderRadius: 14, position: 'relative', overflow: 'hidden', background: r.mediaUrl ? `center/cover url("${r.mediaUrl}")` : undefined }}>
                  {!r.mediaUrl && <span className="mono c3" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{KIND[r.targetType].toLowerCase()}</span>}
                  {r.hidden && <span className="mono" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', background: 'rgba(5,8,21,.7)', letterSpacing: '.08em' }}>YASHIRILGAN</span>}
                </div>
                <div className="col grow" style={{ gap: 8, minWidth: 0 }}>
                  <div className="row between" style={{ gap: 8 }}><span className="pill-tag error ellipsis">{r.reason}</span><span className="mono c3" style={{ fontSize: 12, flexShrink: 0 }}>{r.count} shikoyat</span></div>
                  <b style={{ fontSize: 15 }}>{KIND[r.targetType]} · @{r.author.username}</b>
                  <p className="c2" style={{ fontSize: 14, lineHeight: 1.45, wordBreak: 'break-word' }}>{r.note ? `${r.note} ` : ''}<span style={{ color: 'var(--text-1)' }}>«{r.text.slice(0, 140)}»</span></p>
                  <span className="mono c3" style={{ fontSize: 11 }}>Birinchi shikoyat: {ago(r.firstAt)}</span>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <Btn className="btn btn-outline btn-sm" loading={busy === r.targetId + 'keep'} onClick={() => act(r, 'keep')}>Qoldirish</Btn>
                    <Btn className="btn btn-outline btn-sm" loading={busy === r.targetId + 'warn'} onClick={() => act(r, 'warn')}>Ogohlantirish</Btn>
                    <Btn className="btn btn-danger btn-sm" loading={busy === r.targetId + 'remove'} onClick={() => act(r, 'remove')}>{r.targetType === 'user' ? 'Bloklash' : 'O‘chirish'}</Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Async>
    </>
  );
}

type MatchRow = { id: string; title: string; status: string; capacity: number; filled: number; date: string; start: string; stadium: string; organizer: { id: string; name: string; username: string | null }; createdAt: string };
const MST: Record<string, [string, string]> = { open: ['Ochiq', 'success'], full: ['To‘ldi', 'warning'], done: ['Yakunlangan', 'muted'], cancelled: ['Bekor qilingan', 'error'] };

function Confirm({ text, label, busy, onYes, onNo }: { text: string; label: string; busy: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <Modal open onClose={onNo} title="Tasdiqlang">
      <p className="c2" style={{ fontSize: 15, lineHeight: 1.5 }}>{text}</p>
      <div className="row" style={{ gap: 8 }}><button className="btn btn-outline grow" onClick={onNo}>Bekor qilish</button><Btn className="btn btn-danger grow" loading={busy} onClick={onYes}>{label}</Btn></div>
    </Modal>
  );
}

function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <div className="search" style={{ width: 'min(360px,100%)' }}><Icon n="search" size={22} /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label="Qidirish" /></div>;
}

function Matches() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'active' | 'done' | 'cancelled'>('active');
  const r = useApi<{ items: MatchRow[] }>(`/admin/matches${qs({ status, q: q.trim() || undefined })}`);
  const [sel, setSel] = useState<MatchRow | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const cancel = async () => {
    if (!sel) return;
    setBusy(true);
    try { await post(`/admin/matches/${sel.id}/cancel`); toast(`«${sel.title}» bekor qilindi · o‘yinchilarga xabar ketdi`, { kind: 'warn' }); setSel(null); r.reload(); }
    catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  return (
    <>
      <div className="row between wrap" style={{ gap: 8 }}>
        <Search value={q} onChange={setQ} placeholder="O‘yin yoki tashkilotchi nomi" />
        <div className="row" style={{ gap: 8 }}>{([['active', 'Faol'], ['done', 'Yakunlangan'], ['cancelled', 'Bekor qilingan']] as const).map(([k, l]) => <button key={k} className={`chip ${status === k ? 'on' : ''}`} aria-pressed={status === k} onClick={() => setStatus(k)}>{l}</button>)}</div>
      </div>
      <Async q={r} loading={<Loading rows={3} />} empty={(d) => !d.items.length && <div className="card"><Empty icon="sports_soccer" title="O‘yin topilmadi" /></div>}>
        {(d) => (
          <div className="card col" style={{ padding: 0 }}>
            {d.items.map((m) => (
              <div key={m.id} className="row" style={{ gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', minHeight: 64 }}>
                <span className="col grow" style={{ minWidth: 0 }}>
                  <span className="row" style={{ gap: 8, minWidth: 0 }}><Link href={`/matches/${m.id}`} className="ellipsis" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{m.title}</Link><span className={`pill-tag ${MST[m.status][1]}`}>{MST[m.status][0]}</span></span>
                  <span className="c2 ellipsis" style={{ fontSize: 13 }}>Tashkilotchi: {m.organizer.username ? <Link href={`/u/${m.organizer.username}`}>{m.organizer.name}</Link> : m.organizer.name} · {m.stadium}</span>
                  <span className="mono c3" style={{ fontSize: 11 }}>{dayMonth(m.date)} · {m.start} · {m.filled}/{m.capacity} o‘yinchi</span>
                </span>
                {['open', 'full'].includes(m.status) && <button className="btn btn-danger-outline btn-sm" onClick={() => setSel(m)}>Bekor qilish</button>}
              </div>
            ))}
          </div>
        )}
      </Async>
      {sel && <Confirm text={`«${sel.title}» o‘yinini bekor qilasizmi? ${sel.filled} o‘yinchiga xabar boradi. Stadiondagi bron o‘zgarmaydi. Amal audit jurnaliga yoziladi.`} label="Bekor qilish" busy={busy} onYes={cancel} onNo={() => setSel(null)} />}
    </>
  );
}

export default function AdminContent() {
  const [tab, setTab] = useState<'reports' | 'matches'>('reports');
  return (
    <>
      <AdminHeader title="Kontent moderatsiyasi" />
      <Seg value={tab} onChange={setTab} items={[['reports', 'Shikoyatlar'], ['matches', 'O‘yinlar']]} />
      {tab === 'reports' ? <Reports /> : <Matches />}
    </>
  );
}
