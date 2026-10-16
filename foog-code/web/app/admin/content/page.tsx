'use client';
import { useState } from 'react';
import { Async, Btn, Empty, Loading } from '@/components/ui';
import { AdminHeader } from '@/components/admin';
import { useApi } from '@/lib/useApi';
import { patch } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { ago } from '@/lib/format';

type Rep = { targetType: 'post' | 'reel' | 'comment' | 'user'; targetId: string; count: number; reason: string; note: string | null; author: { id: string; name: string; username: string | null }; text: string; mediaUrl: string | null; video: string | null; hidden: boolean; firstAt: string };
const KIND: Record<string, string> = { post: 'Post', reel: 'Reel', comment: 'Izoh', user: 'Profil' };

export default function AdminContent() {
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
      <AdminHeader title="Kontent moderatsiyasi" />
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
