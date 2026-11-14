'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Btn, Empty, Icon, Loading, Modal } from '@/components/ui';
import { AdminHeader } from '@/components/admin';
import { ApiError, del, get, put } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { dayMonthShort, isoDate, phone } from '@/lib/format';

type Mehnat = { dan: string; gacha: string; matn: string };
type Rel = { rel: string; fish: string; yil: string; joy: string; ish: string; turar: string };
type Data = { lang: string; mehnat: Mehnat[]; qarindosh: Rel[] } & Record<string, unknown>;
type Res = { data: Data; photo: string; updatedAt: string; user: { name: string; username: string | null; phone: string | null } };

// Maydonlar tartibi va nomlari obyektivka varag‘idagidek
const FIELDS: [string, string, boolean?][] = [
  ['fish', 'Familiyasi, ismi, otasining ismi'], ['lavozim', 'Lavozimi (qachondan)', true], ['tugSana', 'Tug‘ilgan sanasi (KK.OO.YYYY)'], ['tugJoy', 'Tug‘ilgan joyi'],
  ['millati', 'Millati'], ['partiya', 'Partiyaviyligi'], ['malumoti', 'Ma’lumoti'], ['tamomlagan', 'Tamomlagan', true], ['mutaxassislik', 'Mutaxassisligi'],
  ['ilmiyDaraja', 'Ilmiy darajasi'], ['ilmiyUnvon', 'Ilmiy unvoni'], ['tillar', 'Biladigan tillari'], ['mukofot', 'Davlat mukofotlari', true], ['deputat', 'Deputatligi / saylov organlari a’zoligi', true],
];
const LANG: Record<string, string> = { new: 'O‘zbek (yangi lotin)', lat: 'O‘zbek (lotin)', cyr: 'O‘zbek (kirill)', ru: 'Rus' };
const REL_F: [keyof Rel, string][] = [['rel', 'Qarindoshligi'], ['fish', 'F.I.Sh.'], ['yil', 'Tug‘ilgan yili'], ['joy', 'Tug‘ilgan joyi'], ['ish', 'Ish joyi va lavozimi'], ['turar', 'Turar joyi']];

export default function AdminObyektivkaEdit() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const toast = useToast();
  const [res, setRes] = useState<Res | null>(null);
  const [d, setD] = useState<Data | null>(null);
  const [photo, setPhoto] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    get<Res>(`/admin/obyektivka/${userId}`).then((r) => { setRes(r); setD({ ...r.data, mehnat: r.data.mehnat ?? [], qarindosh: r.data.qarindosh ?? [] }); setPhoto(r.photo); })
      .catch((e) => setErr(e instanceof ApiError && e.status === 404 ? 'Bu foydalanuvchi hali obyektivka to‘ldirmagan' : (e as Error).message));
  }, [userId]);
  // Saqlanmagan o‘zgarish bilan sahifadan chiqib ketmaslik uchun
  useEffect(() => {
    if (!dirty) return;
    const f = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [dirty]);

  if (err) return (<><AdminHeader title="Obyektivka" /><div className="card"><Empty icon="description" title={err} /></div><Link href="/admin/obyektivka" className="btn btn-outline" style={{ alignSelf: 'flex-start' }}>Ro‘yxatga qaytish</Link></>);
  if (!res || !d) return (<><AdminHeader title="Obyektivka" /><Loading rows={6} /></>);

  const set = (patch: Partial<Data>) => { setD({ ...d, ...patch }); setDirty(true); };
  const setRow = <K extends 'mehnat' | 'qarindosh'>(list: K, i: number, patch: Partial<Data[K][number]>) => set({ [list]: d[list].map((x, j) => (j === i ? { ...x, ...patch } : x)) } as Partial<Data>);
  const save = async () => {
    setBusy(true);
    try {
      const r = await put<{ updatedAt: string }>(`/admin/obyektivka/${userId}`, { data: d, ...(photo !== res.photo ? { photo } : {}) });
      setRes({ ...res, data: d, photo, updatedAt: r.updatedAt }); setDirty(false);
      toast('Saqlandi. Foydalanuvchi obyektivkani keyingi ochganda yangilangan ma’lumotni ko‘radi');
    } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await del(`/admin/obyektivka/${userId}`); toast('Obyektivka ma’lumotlari o‘chirildi', { kind: 'warn' }); router.push('/admin/obyektivka'); } catch (e) { toast((e as Error).message, { kind: 'err' }); setBusy(false); }
  };

  return (
    <>
      <AdminHeader title={`Obyektivka: ${res.user.name}`}><Link href="/admin/obyektivka" className="btn btn-outline btn-sm"><Icon n="arrow_back" size={18} />Ro‘yxat</Link></AdminHeader>
      <p className="c2 t-small">@{res.user.username} · {phone(res.user.phone)} · yozuv: {LANG[d.lang] ?? d.lang} · oxirgi o‘zgarish: {dayMonthShort(isoDate(res.updatedAt))}</p>

      <div className="card col" style={{ padding: 20, gap: 16 }}>
        <div className="row wrap" style={{ gap: 20, alignItems: 'flex-start' }}>
          <div className="col" style={{ gap: 8, alignItems: 'center' }}>
            {photo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={photo} alt="Obyektivka rasmi" style={{ width: 120, height: 160, objectFit: 'cover', borderRadius: 8, boxShadow: 'inset 0 0 0 1px var(--border)' }} />
              : <div className="well" style={{ width: 120, height: 160, display: 'grid', placeItems: 'center', color: 'var(--text-3)', fontSize: 12 }}>Rasm yo‘q</div>}
            {photo && <button className="btn btn-danger-outline btn-sm" onClick={() => { setPhoto(''); setDirty(true); }}>Rasmni o‘chirish</button>}
          </div>
          <div className="grow" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, minWidth: 0 }}>
            {FIELDS.map(([k, label, long]) => (
              <label key={k} className="field" style={long ? { gridColumn: '1 / -1' } : undefined}><span>{label}</span>
                {long ? <textarea className="textarea" rows={2} value={String(d[k] ?? '')} onChange={(e) => set({ [k]: e.target.value })} maxLength={2000} />
                  : <input className="input" value={String(d[k] ?? '')} onChange={(e) => set({ [k]: e.target.value })} maxLength={k === 'tugSana' ? 20 : 300} />}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="card col" style={{ padding: 20, gap: 12 }}>
        <div className="row between"><b>Mehnat faoliyati</b><button className="btn btn-outline btn-sm" disabled={d.mehnat.length >= 60} onClick={() => set({ mehnat: [...d.mehnat, { dan: '', gacha: '', matn: '' }] })}><Icon n="add" size={18} />Qator</button></div>
        {!d.mehnat.length && <span className="c3 t-small">Kiritilmagan</span>}
        {d.mehnat.map((m, i) => (
          <div key={i} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <input className="input" style={{ width: 84 }} placeholder="dan" aria-label="Qaysi yildan" value={m.dan} maxLength={10} onChange={(e) => setRow('mehnat', i, { dan: e.target.value })} />
            <input className="input" style={{ width: 84 }} placeholder="gacha" aria-label="Qaysi yilgacha" value={m.gacha} maxLength={10} onChange={(e) => setRow('mehnat', i, { gacha: e.target.value })} />
            <textarea className="textarea grow" rows={1} placeholder="Ish joyi va lavozimi" aria-label="Ish joyi va lavozimi" value={m.matn} maxLength={2000} onChange={(e) => setRow('mehnat', i, { matn: e.target.value })} />
            <button className="icon-btn" style={{ color: 'var(--error)' }} aria-label="Qatorni o‘chirish" onClick={() => set({ mehnat: d.mehnat.filter((_, j) => j !== i) })}><Icon n="delete" size={20} /></button>
          </div>
        ))}
      </div>

      <div className="card col" style={{ padding: 20, gap: 12 }}>
        <div className="row between"><b>Yaqin qarindoshlari</b><button className="btn btn-outline btn-sm" disabled={d.qarindosh.length >= 40} onClick={() => set({ qarindosh: [...d.qarindosh, { rel: '', fish: '', yil: '', joy: '', ish: '', turar: '' }] })}><Icon n="add" size={18} />Qator</button></div>
        {!d.qarindosh.length && <span className="c3 t-small">Kiritilmagan</span>}
        {d.qarindosh.map((q, i) => (
          <div key={i} className="well" style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, position: 'relative' }}>
            {REL_F.map(([k, label]) => <label key={k} className="field"><span>{label}</span><input className="input" value={q[k]} maxLength={k === 'yil' ? 10 : k === 'ish' || k === 'turar' ? 2000 : 300} onChange={(e) => setRow('qarindosh', i, { [k]: e.target.value })} /></label>)}
            <button className="btn btn-danger-outline btn-sm" style={{ alignSelf: 'end', justifySelf: 'start' }} onClick={() => set({ qarindosh: d.qarindosh.filter((_, j) => j !== i) })}>Qatorni o‘chirish</button>
          </div>
        ))}
      </div>

      <div className="card row between wrap" style={{ gap: 12, position: 'sticky', bottom: 12, padding: 12, zIndex: 2, boxShadow: '0 4px 20px rgba(0,0,0,.25)' }}>
        <button className="btn btn-danger-outline" onClick={() => setAsking(true)}>Obyektivkani o‘chirish</button>
        <Btn className="btn btn-primary" loading={busy} disabled={!dirty} onClick={save}>{dirty ? 'Saqlash' : 'Saqlangan'}</Btn>
      </div>
      <Modal open={asking} onClose={() => setAsking(false)} title="Obyektivka ma’lumotlarini o‘chirish">
        <p className="c2 t-small">{res.user.name} ning saqlangan obyektivka ma’lumotlari bazadan o‘chiriladi. Hisobning o‘zi qoladi. Brauzerida qoralama saqlangan bo‘lsa, foydalanuvchi keyingi tahrirda uni qayta yuborishi mumkin.</p>
        <Btn className="btn btn-danger btn-block" loading={busy} onClick={remove}>O‘chirish</Btn>
      </Modal>
    </>
  );
}
