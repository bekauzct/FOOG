'use client';
import { useEffect, useState } from 'react';
import { Btn, Empty, Icon, Loading, Modal, Seg } from '@/components/ui';
import { AdminHeader } from '@/components/admin';
import { useApi } from '@/lib/useApi';
import { post } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { dayMonthShort, isoDate } from '@/lib/format';

type Target = 'all' | 'player' | 'owner';
type Item = { id: string; title: string; body: string; target: Target; recipients: number; tgTotal: number; tgSent: number; tgFailed: number; status: 'sending' | 'done' | 'interrupted'; createdAt: string };
type Res = { audience: Record<Target, { users: number; telegram: number }>; botOn: boolean; items: Item[] };
const TARGET: Record<Target, string> = { all: 'Hammaga', player: 'Futbolchilarga', owner: 'Stadion egalariga' };

/** Hamma foydalanuvchilarga e’lon: saytdagi bildirishnoma (qo‘ng‘iroqcha) + Telegram bot xabari */
export default function AdminBroadcast() {
  const toast = useToast();
  const r = useApi<Res>('/admin/broadcast');
  const [target, setTarget] = useState<Target>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState<'test' | 'send' | null>(null);
  const [asking, setAsking] = useState(false);
  const [tested, setTested] = useState('');
  const sending = r.data?.items.some((i) => i.status === 'sending');
  // Yuborish davom etayotganda hisoblagichlar yangilanib turadi
  useEffect(() => { if (!sending) return; const t = setInterval(() => r.reload(), 2000); return () => clearInterval(t); }, [sending]); // eslint-disable-line react-hooks/exhaustive-deps

  const a = r.data?.audience[target];
  const valid = title.trim().length >= 3 && body.trim().length >= 3;
  const sig = `${title}\n${body}`;
  const test = async () => {
    setBusy('test');
    try {
      const x = await post<{ telegram: 'sent' | 'failed' | 'off' }>('/admin/broadcast', { title, body, target, test: true });
      setTested(sig);
      toast(x.telegram === 'sent' ? 'Sinov xabari o‘zingizga yuborildi: qo‘ng‘iroqcha va Telegram’ni tekshiring' : x.telegram === 'failed' ? 'Saytga tushdi, lekin Telegram’ga yuborib bo‘lmadi (botni ishga tushirganmisiz?)' : 'Saytdagi bildirishnomangizga tushdi. Hisobingiz Telegram’ga bog‘lanmagan', { kind: x.telegram === 'sent' ? undefined : 'warn' });
    } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(null); }
  };
  const send = async () => {
    setBusy('send');
    try {
      const x = await post<{ recipients: number; telegram: number }>('/admin/broadcast', { title, body, target });
      toast(`E’lon ${x.recipients} kishiga yuborilmoqda`);
      setAsking(false); setTitle(''); setBody(''); setTested(''); r.reload();
    } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(null); }
  };

  return (
    <>
      <AdminHeader title="E’lon yuborish" />
      <div className="card col" style={{ padding: 20, gap: 14, maxWidth: 760 }}>
        <p className="c2 t-small">Xabar tanlangan foydalanuvchilarning saytdagi bildirishnomalariga (qo‘ng‘iroqcha) tushadi va Telegram bot orqali ham yuboriladi. Bloklangan hisoblarga yuborilmaydi.</p>
        <div className="field"><span>Kimga</span><Seg value={target} onChange={setTarget} items={[['all', 'Hammaga'], ['player', 'Futbolchilarga'], ['owner', 'Stadion egalariga']]} /></div>
        {a && <div className="well row wrap" style={{ padding: 12, gap: 16, fontSize: 14 }}>
          <span><Icon n="notifications" size={18} /> Saytda: <b>{a.users}</b> kishi</span>
          <span><Icon n="send" size={18} /> Telegram’da: <b>{r.data?.botOn ? a.telegram : 0}</b> kishi</span>
          {!r.data?.botOn && <span style={{ color: 'var(--warning)' }}>Bot sozlanmagan – faqat saytga tushadi</span>}
        </div>}
        <label className="field"><span>Sarlavha</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Masalan: Yangi stadionlar qo‘shildi" /></label>
        <label className="field"><span>Matn <span className="c3 mono" style={{ fontSize: 11 }}>{body.length}/1500</span></span><textarea className="textarea" rows={6} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1500} placeholder="Xabar matni. Oxiriga sayt havolasi o‘zi qo‘shiladi." /></label>
        <div className="row wrap" style={{ gap: 10, justifyContent: 'flex-end' }}>
          <Btn className="btn btn-outline" loading={busy === 'test'} disabled={!valid} onClick={test}>Avval o‘zimga sinov yuborish</Btn>
          <Btn className="btn btn-primary" disabled={!valid || !!sending} onClick={() => setAsking(true)}><Icon n="send" size={18} />{sending ? 'Oldingisi yuborilmoqda…' : 'Yuborish'}</Btn>
        </div>
      </div>

      <b style={{ marginTop: 8 }}>Yuborilgan e’lonlar</b>
      {!r.data ? <Loading rows={3} /> : !r.data.items.length ? <div className="card"><Empty icon="notifications_active" title="Hali e’lon yuborilmagan" /></div> : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="ow-table">
            <thead><tr><th>E’lon</th><th>Kimga</th><th>Saytda</th><th>Telegram</th><th>Holat</th></tr></thead>
            <tbody>
              {r.data.items.map((i) => (
                <tr key={i.id}>
                  <td style={{ maxWidth: 380 }}><div className="col"><b style={{ fontSize: 15 }}>{i.title}</b><span className="c3 ellipsis" style={{ fontSize: 12, display: 'block' }}>{i.body}</span><span className="mono c3" style={{ fontSize: 11 }}>{dayMonthShort(isoDate(i.createdAt))}</span></div></td>
                  <td style={{ fontSize: 14 }}>{TARGET[i.target]}</td>
                  <td className="mono" style={{ fontSize: 14 }}>{i.recipients}</td>
                  <td className="mono" style={{ fontSize: 14 }}>{i.tgSent} / {i.tgTotal}{i.tgFailed > 0 && <div className="c3" style={{ fontSize: 11 }}>{i.tgFailed} ta yetmadi (botni bloklagan yoki ishga tushirmagan)</div>}</td>
                  <td><span className={`pill-tag ${i.status === 'done' ? 'success' : i.status === 'sending' ? 'warning' : 'error'}`}>{i.status === 'done' ? 'Yuborildi' : i.status === 'sending' ? 'Yuborilmoqda…' : 'Uzilib qoldi'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={asking} onClose={() => setAsking(false)} title="E’lonni yuborish">
        <p className="c2 t-small"><b>{TARGET[target]}</b>: saytda <b>{a?.users ?? 0}</b> kishi, Telegram’da <b>{r.data?.botOn ? a?.telegram ?? 0 : 0}</b> kishi oladi. Yuborilgan xabarni qaytarib bo‘lmaydi.</p>
        <div className="well col" style={{ padding: 14, gap: 6 }}><b>{title}</b><span className="c2" style={{ fontSize: 14, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{body}</span></div>
        {tested !== sig && <p className="t-small" style={{ color: 'var(--warning)' }}>Bu matnni hali o‘zingizga sinov qilib yubormadingiz.</p>}
        <Btn className="btn btn-primary btn-block" loading={busy === 'send'} onClick={send}>Ha, yuborish</Btn>
      </Modal>
    </>
  );
}
