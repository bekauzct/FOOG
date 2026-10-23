'use client';
import { useState } from 'react';
import { Art, Async, Btn, Empty, Icon, Loading, Modal, Toggle } from '@/components/ui';
import { AdminHeader } from '@/components/admin';
import { POSES } from '@/components/foogiPoses';
import { useApi } from '@/lib/useApi';
import { del, post, put, qs } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { ago } from '@/lib/format';

type Aud = 'all' | 'guest' | 'player' | 'owner' | 'admin';
const AUD: [Aud, string][] = [['all', 'Hamma'], ['guest', 'Mehmon'], ['player', 'Futbolchi'], ['owner', 'Stadion egasi'], ['admin', 'Admin']];
const audT = (a: string) => AUD.find(([k]) => k === a)?.[1] ?? a;
type Answer = { id: string; title: string; questions: string[]; keywords: string[]; answer: string; pose: string; linkHref: string | null; linkLabel: string | null; audience: Aud; active: boolean; hits: number };
type QGroup = { key: string; text: string; count: number; ids: string[]; last: string; page: string | null; status: string; answer: { id: string; title: string } | null; score: number; audience: string };
type Tip = { id: string; title: string | null; text: string; pose: string; ctaLabel: string | null; ctaHref: string | null; audience: Aud; page: string | null; sort: number; active: boolean };
type Step = { id: string; page: string; target: string; title: string; text: string; pose: string; audience: Aud; sort: number; active: boolean };
type Tested = { answerAt: number; suggestAt: number; normalized: string; items: { id: string; title: string; score: number; answer: string }[] };
const QST: Record<string, [string, string]> = { unanswered: ['Javobsiz', 'warning'], wrong: ['Noto‘g‘ri deb belgilandi', 'error'], answered: ['Javob berildi', 'success'], taught: ['O‘rgatildi', 'success'], dismissed: ['E’tiborsiz', 'muted'] };

function PosePick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="well row" style={{ gap: 10, padding: 8, width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer' }} onClick={() => setOpen(true)}>
        <Art pose={value} size={48} /><span className="col grow"><b style={{ fontSize: 14 }}>Poza</b><span className="mono c2" style={{ fontSize: 12 }}>{value}</span></span><Icon n="keyboard_arrow_down" />
      </button>
      {open && (
        <Modal open wide onClose={() => setOpen(false)} title="FOOGI pozasi">
          <div className="fg-poses">
            {POSES.map((p) => (
              <button key={p} type="button" className={`fg-pose ${p === value ? 'on' : ''}`} onClick={() => { onChange(p); setOpen(false); }} title={p} aria-pressed={p === value}>
                <Art pose={p} size={72} /><span className="mono">{p}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

function AudSelect({ value, onChange, allowAll = true }: { value: Aud; onChange: (v: Aud) => void; allowAll?: boolean }) {
  return (
    <label className="col" style={{ gap: 6 }}><span className="label-sm">Kimga</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as Aud)}>{AUD.filter(([k]) => allowAll || k !== 'all').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    </label>
  );
}

/** Bilim (javob) formasi: namuna savollar + kalit so‘zlar → javob */
function AnswerForm({ init, extraQuestions = [], onClose, onSaved }: { init?: Answer | null; extraQuestions?: string[]; onClose: () => void; onSaved: (a: Answer) => void }) {
  const [f, setF] = useState({
    title: init?.title ?? extraQuestions[0]?.slice(0, 60) ?? '', questions: [...(init?.questions ?? []), ...extraQuestions].join('\n'), keywords: (init?.keywords ?? []).join(', '), answer: init?.answer ?? '',
    pose: init?.pose ?? 'thumbs_up', linkHref: init?.linkHref ?? '', linkLabel: init?.linkLabel ?? '', audience: init?.audience ?? ('all' as Aud), active: init?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const body = () => ({ ...f, questions: f.questions.split('\n').map((x) => x.trim()).filter(Boolean), keywords: f.keywords.split(',').map((x) => x.trim()).filter(Boolean), linkHref: f.linkHref.trim() || null, linkLabel: f.linkLabel.trim() || null });
  const save = async () => {
    setBusy(true); setErr(null);
    try { const a = init ? await put<Answer>(`/admin/foogi/answers/${init.id}`, body()) : await post<Answer>('/admin/foogi/answers', body()); onSaved(a); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open wide onClose={() => !busy && onClose()} title={init ? 'Bilimni tahrirlash' : 'Yangi bilim'}>
      <div className="fg-form">
        <label className="col" style={{ gap: 6 }}><span className="label-sm">Sarlavha</span><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Masalan: Bronni bekor qilish" maxLength={80} /></label>
        <label className="col" style={{ gap: 6 }}><span className="label-sm">Namuna savollar – har qatorda bittasi</span><textarea className="input" rows={5} value={f.questions} onChange={(e) => set('questions', e.target.value)} placeholder={'bronni qanday bekor qilaman\nbron kerak emas'} /><span className="c3 t-cap">Foydalanuvchilar qanday so‘rashi mumkin bo‘lsa, shunday yozing. Ko‘p misol – aniqroq javob.</span></label>
        <label className="col" style={{ gap: 6 }}><span className="label-sm">Kalit so‘zlar – vergul bilan</span><input className="input" value={f.keywords} onChange={(e) => set('keywords', e.target.value)} placeholder="bekor, otmen, qaytarish" /></label>
        <label className="col" style={{ gap: 6 }}><span className="label-sm">FOOGI javobi</span><textarea className="input" rows={4} value={f.answer} onChange={(e) => set('answer', e.target.value)} maxLength={800} /></label>
        <div className="fg-2">
          <label className="col" style={{ gap: 6 }}><span className="label-sm">Havola (ixtiyoriy)</span><input className="input mono" value={f.linkHref} onChange={(e) => set('linkHref', e.target.value)} placeholder="/bookings" /></label>
          <label className="col" style={{ gap: 6 }}><span className="label-sm">Tugma matni</span><input className="input" value={f.linkLabel} onChange={(e) => set('linkLabel', e.target.value)} placeholder="Bronlarim" maxLength={40} /></label>
        </div>
        <div className="fg-2"><AudSelect value={f.audience} onChange={(v) => set('audience', v)} /><PosePick value={f.pose} onChange={(v) => set('pose', v)} /></div>
        <div className="row between"><span>Faol</span><Toggle on={f.active} onChange={(v) => set('active', v)} label="Faol" /></div>
        {err && <div role="alert" className="row pay-alert"><Icon n="error" size={20} /><span>{err}</span></div>}
        <div className="row" style={{ gap: 10 }}><button className="btn btn-outline grow" onClick={onClose} disabled={busy}>Bekor qilish</button><Btn className="btn btn-primary grow" loading={busy} disabled={!f.title.trim() || !f.answer.trim()} onClick={save}>Saqlash</Btn></div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- 1. O‘rgatish navbati
function Teach({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState<'open' | 'taught' | 'answered' | 'dismissed' | 'all'>('open');
  const [q, setQ] = useState('');
  const r = useApi<{ items: QGroup[] }>(`/admin/foogi/questions${qs({ status, q: q.trim() || undefined })}`);
  const answers = useApi<{ items: Answer[] }>('/admin/foogi/answers');
  const [sel, setSel] = useState<QGroup | null>(null);
  const [link, setLink] = useState<string>('');
  const [sug, setSug] = useState<Tested | null>(null);
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const pick = async (g: QGroup) => {
    setSel(g); setLink(''); setSug(null);
    try { const t = await post<Tested>('/admin/foogi/test', { text: g.text, audience: g.audience === 'all' ? 'player' : g.audience }); setSug(t); if (t.items[0]) setLink(t.items[0].id); } catch { /* ixtiyoriy */ }
  };
  const done = (msg: string) => { toast(msg); setSel(null); r.reload(); answers.reload(); onChange(); };
  const teach = async () => {
    if (!sel || !link) return;
    setBusy(true);
    try { await post('/admin/foogi/questions/teach', { ids: sel.ids, answerId: link }); done('O‘rgatildi · FOOGI endi bu savolga javob beradi'); }
    catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  const dismiss = async (g: QGroup) => { await post('/admin/foogi/questions/dismiss', { ids: g.ids }); done('E’tiborsiz qoldirildi'); };
  return (
    <div className="fg-teach">
      <div className="col" style={{ gap: 12, minWidth: 0 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          {([['open', 'O‘rgatish kerak'], ['taught', 'O‘rgatilgan'], ['answered', 'Javob berilgan'], ['dismissed', 'E’tiborsiz'], ['all', 'Hammasi']] as const).map(([k, l]) => <button key={k} className={`chip ${status === k ? 'on' : ''}`} aria-pressed={status === k} onClick={() => setStatus(k)}>{l}</button>)}
          <div className="search" style={{ width: 'min(260px,100%)', marginLeft: 'auto' }}><Icon n="search" size={20} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Savol matni" aria-label="Qidirish" /></div>
        </div>
        <Async q={r} loading={<Loading rows={4} />} empty={(d) => !d.items.length && <div className="card"><Empty art="thumbs_up" title={status === 'open' ? 'Navbat bo‘sh – FOOGI hamma savolga javob bera oldi' : 'Savol yo‘q'} /></div>}>
          {(d) => (
            <div className="card col" style={{ padding: 0 }}>
              {d.items.map((g) => (
                <button key={g.key} className={`fg-q ${sel?.key === g.key ? 'on' : ''}`} onClick={() => pick(g)}>
                  <span className="col grow" style={{ minWidth: 0, textAlign: 'left', gap: 4 }}>
                    <b style={{ fontSize: 15 }}>«{g.text}»</b>
                    <span className="row wrap c2" style={{ gap: 8, fontSize: 12 }}>
                      <span className={`pill-tag ${QST[g.status]?.[1] ?? 'muted'}`}>{QST[g.status]?.[0] ?? g.status}</span>
                      {g.count > 1 && <span className="mono">×{g.count}</span>}
                      <span>{audT(g.audience)}</span>{g.page && <span className="mono">{g.page}</span>}<span>{ago(g.last)}</span>
                      {g.answer && <span>→ {g.answer.title}</span>}
                    </span>
                  </span>
                  <Icon n="chevron_right" style={{ color: 'var(--text-3)' }} />
                </button>
              ))}
            </div>
          )}
        </Async>
      </div>
      <div className="card col fg-side" style={{ gap: 14 }}>
        {!sel ? <Empty art="thinking" title="Savolni tanlang" text="FOOGI javob bera olmagan savolni tanlang va unga to‘g‘ri javobni bog‘lang yoki yangi bilim yarating." /> : (
          <>
            <div className="col" style={{ gap: 4 }}><span className="label-sm">Savol{sel.count > 1 ? ` · ${sel.count} marta so‘ralgan` : ''}</span><b style={{ fontSize: 18 }}>«{sel.text}»</b></div>
            {sug && (
              <div className="col" style={{ gap: 8 }}>
                <span className="label-sm">FOOGI shu javoblarni o‘ylagan edi</span>
                {sug.items.length ? sug.items.map((m) => (
                  <label key={m.id} className={`fg-opt ${link === m.id ? 'on' : ''}`}>
                    <input type="radio" name="ans" checked={link === m.id} onChange={() => setLink(m.id)} />
                    <span className="col grow" style={{ minWidth: 0 }}><b style={{ fontSize: 14 }}>{m.title}</b><span className="c2 ellipsis" style={{ fontSize: 12 }}>{m.answer}</span></span>
                    <span className={`mono ${m.score >= sug.answerAt ? 'c-ok' : 'c3'}`} style={{ fontSize: 12 }}>{Math.round(m.score * 100)}%</span>
                  </label>
                )) : <span className="c2 t-small">Mos javob topilmadi.</span>}
              </div>
            )}
            <label className="col" style={{ gap: 6 }}><span className="label-sm">Yoki boshqa javobni tanlang</span>
              <select className="input" value={link} onChange={(e) => setLink(e.target.value)}><option value="">— tanlang —</option>{answers.data?.items.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select>
            </label>
            <Btn className="btn btn-primary" loading={busy} disabled={!link} onClick={teach}><Icon n="school" size={20} />Shu javobga o‘rgatish</Btn>
            <button className="btn btn-outline" onClick={() => setCreate(true)}><Icon n="add" size={20} />Yangi bilim yaratish</button>
            {sel.status !== 'dismissed' && <button className="btn btn-ghost" onClick={() => dismiss(sel)}>E’tiborsiz qoldirish</button>}
          </>
        )}
      </div>
      {create && sel && (
        <AnswerForm extraQuestions={[sel.text]} onClose={() => setCreate(false)} onSaved={async (a) => { setCreate(false); await post('/admin/foogi/questions/teach', { ids: sel.ids, answerId: a.id }); done('Yangi bilim yaratildi va o‘rgatildi'); }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 2. Bilimlar
function Knowledge() {
  const [q, setQ] = useState('');
  const r = useApi<{ items: Answer[] }>(`/admin/foogi/answers${qs({ q: q.trim() || undefined })}`);
  const [edit, setEdit] = useState<Answer | null | 'new'>(null);
  const [ask, setAsk] = useState<Answer | null>(null);
  const toast = useToast();
  const toggle = async (a: Answer) => { await put(`/admin/foogi/answers/${a.id}`, { ...a, active: !a.active }); r.reload(); };
  return (
    <>
      <div className="row between wrap" style={{ gap: 8 }}>
        <div className="search" style={{ width: 'min(360px,100%)' }}><Icon n="search" size={20} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sarlavha yoki javob" aria-label="Qidirish" /></div>
        <button className="btn btn-primary" onClick={() => setEdit('new')}><Icon n="add" size={20} />Bilim qo‘shish</button>
      </div>
      <Async q={r} loading={<Loading rows={4} />} empty={(d) => !d.items.length && <div className="card"><Empty art="thinking" title="Bilim yo‘q" text="FOOGI javob berishi uchun birinchi bilimni qo‘shing." /></div>}>
        {(d) => (
          <div className="fg-cards">
            {d.items.map((a) => (
              <div key={a.id} className={`card col fg-card ${a.active ? '' : 'off'}`} style={{ gap: 10 }}>
                <div className="row" style={{ gap: 12 }}>
                  <Art pose={a.pose} size={56} />
                  <span className="col grow" style={{ minWidth: 0 }}><b className="ellipsis" style={{ fontSize: 16 }}>{a.title}</b><span className="c2" style={{ fontSize: 12 }}>{audT(a.audience)} · {a.questions.length} ta savol · {a.hits} marta javob berdi</span></span>
                  <Toggle on={a.active} onChange={() => toggle(a)} label="Faol" />
                </div>
                <p className="c2" style={{ fontSize: 14, lineHeight: 1.5 }}>{a.answer}</p>
                {a.linkHref && <span className="mono c3" style={{ fontSize: 12 }}>→ {a.linkLabel ?? 'Ochish'} · {a.linkHref}</span>}
                <div className="row wrap" style={{ gap: 6 }}>{a.questions.slice(0, 4).map((x) => <span key={x} className="pill-tag muted">{x}</span>)}{a.questions.length > 4 && <span className="c3 t-cap">+{a.questions.length - 4}</span>}</div>
                <div className="row" style={{ gap: 8, marginTop: 'auto' }}><button className="btn btn-outline btn-sm grow" onClick={() => setEdit(a)}><Icon n="edit" size={18} />Tahrirlash</button><button className="icon-btn ghost" aria-label="O‘chirish" onClick={() => setAsk(a)}><Icon n="delete" style={{ color: 'var(--error)' }} /></button></div>
              </div>
            ))}
          </div>
        )}
      </Async>
      {edit && <AnswerForm init={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast('Saqlandi · FOOGI yangilandi'); r.reload(); }} />}
      {ask && (
        <Modal open onClose={() => setAsk(null)} title="Tasdiqlang">
          <p className="c2" style={{ fontSize: 15, lineHeight: 1.5 }}>«{ask.title}» bilimini o‘chirasizmi? FOOGI bu mavzudagi savollarga javob bermay qo‘yadi.</p>
          <div className="row" style={{ gap: 8 }}><button className="btn btn-outline grow" onClick={() => setAsk(null)}>Bekor qilish</button><button className="btn btn-danger grow" onClick={async () => { await del(`/admin/foogi/answers/${ask.id}`); setAsk(null); r.reload(); toast('O‘chirildi', { kind: 'warn' }); }}>O‘chirish</button></div>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------- 3. Sinov maydoni
function Playground() {
  const [text, setText] = useState('');
  const [aud, setAud] = useState<Aud>('player');
  const [res, setRes] = useState<Tested | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => { if (!text.trim()) return; setBusy(true); try { setRes(await post<Tested>('/admin/foogi/test', { text, audience: aud })); } finally { setBusy(false); } };
  const best = res?.items[0];
  return (
    <div className="card col" style={{ gap: 14, maxWidth: 820 }}>
      <p className="c2" style={{ fontSize: 14, lineHeight: 1.5 }}>Savol yozing – FOOGI qaysi bilimni tanlashini va qanchalik ishonchli ekanini ko‘rasiz. {res && <>Javob berish chegarasi: <b className="mono">{Math.round(res.answerAt * 100)}%</b>, taklif: <b className="mono">{Math.round(res.suggestAt * 100)}%</b>.</>}</p>
      <form className="row wrap" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); run(); }}>
        <input className="input grow" style={{ minWidth: 220 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Masalan: bronni otmen qilsam bo‘ladimi?" aria-label="Savol" />
        <select className="input" style={{ width: 170 }} value={aud} onChange={(e) => setAud(e.target.value as Aud)} aria-label="Kim so‘rayapti">{AUD.filter(([k]) => k !== 'all').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <Btn className="btn btn-primary" loading={busy}>Sinash</Btn>
      </form>
      {res && (
        <>
          <span className="mono c3" style={{ fontSize: 12 }}>Normallashtirilgan: «{res.normalized}»</span>
          <div className="well row" style={{ gap: 14, padding: 16 }}>
            <Art pose={best && best.score >= res.answerAt ? 'thumbs_up' : best && best.score >= res.suggestAt ? 'thinking' : 'facepalm'} size={72} />
            <span className="col grow" style={{ gap: 4 }}>
              <b>{best && best.score >= res.answerAt ? `Javob beradi: «${best.title}»` : best && best.score >= res.suggestAt ? 'Aniq emas – variantlar taklif qiladi' : 'Javob bera olmaydi – savol o‘rgatish navbatiga tushadi'}</b>
              {best && best.score >= res.answerAt && <span className="c2" style={{ fontSize: 14 }}>{best.answer}</span>}
            </span>
          </div>
          {res.items.map((m) => (
            <div key={m.id} className="col" style={{ gap: 6 }}>
              <div className="row between" style={{ gap: 8 }}><b style={{ fontSize: 14 }}>{m.title}</b><span className="mono" style={{ fontSize: 13 }}>{Math.round(m.score * 100)}%</span></div>
              <div className="fg-bar"><span style={{ width: `${Math.round(m.score * 100)}%`, background: m.score >= res.answerAt ? 'var(--success)' : m.score >= res.suggestAt ? 'var(--warning)' : 'var(--text-3)' }} /></div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 4. Takliflar
function Tips() {
  const r = useApi<{ items: Tip[] }>('/admin/foogi/tips');
  const [edit, setEdit] = useState<Tip | null | 'new'>(null);
  const toast = useToast();
  return (
    <>
      <div className="row between wrap" style={{ gap: 8 }}><p className="c2" style={{ fontSize: 14, maxWidth: 640, lineHeight: 1.5 }}>FOOGI sahifa sayridan keyin taxminan 1,5 daqiqada bir marta bitta taklif beradi – avval ko‘rilmaganlari. Mehmonlarga beriladigan takliflar ularni kirishga undaydi.</p><button className="btn btn-primary" onClick={() => setEdit('new')}><Icon n="add" size={20} />Taklif qo‘shish</button></div>
      <Async q={r} loading={<Loading rows={3} />} empty={(d) => !d.items.length && <div className="card"><Empty art="present" title="Taklif yo‘q" /></div>}>
        {(d) => (
          <div className="card col" style={{ padding: 0 }}>
            {d.items.map((t) => (
              <div key={t.id} className="row" style={{ gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', opacity: t.active ? 1 : 0.55 }}>
                <Art pose={t.pose} size={48} />
                <span className="col grow" style={{ minWidth: 0 }}><b className="ellipsis" style={{ fontSize: 15 }}>{t.title ?? t.text.slice(0, 50)}</b><span className="c2 ellipsis" style={{ fontSize: 13 }}>{t.text}</span><span className="mono c3" style={{ fontSize: 11 }}>{audT(t.audience)}{t.page ? ` · ${t.page}` : ' · hamma sahifa'}{t.ctaHref ? ` · → ${t.ctaHref}` : ''}</span></span>
                <button className="btn btn-outline btn-sm" onClick={() => setEdit(t)}>Tahrirlash</button>
              </div>
            ))}
          </div>
        )}
      </Async>
      {edit && <TipForm init={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast('Saqlandi'); r.reload(); }} />}
    </>
  );
}
function TipForm({ init, onClose, onSaved }: { init: Tip | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: init?.title ?? '', text: init?.text ?? '', pose: init?.pose ?? 'present', ctaLabel: init?.ctaLabel ?? '', ctaHref: init?.ctaHref ?? '', audience: init?.audience ?? ('player' as Aud), page: init?.page ?? '', sort: init?.sort ?? 0, active: init?.active ?? true });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true); setErr(null);
    const b = { ...f, title: f.title.trim() || null, ctaLabel: f.ctaLabel.trim() || null, ctaHref: f.ctaHref.trim() || null, page: f.page.trim() || null };
    try { if (init) await put(`/admin/foogi/tips/${init.id}`, b); else await post('/admin/foogi/tips', b); onSaved(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async () => { if (!init) return; await del(`/admin/foogi/tips/${init.id}`); onSaved(); };
  return (
    <Modal open wide onClose={() => !busy && onClose()} title={init ? 'Taklifni tahrirlash' : 'Yangi taklif'}>
      <div className="fg-form">
        <label className="col" style={{ gap: 6 }}><span className="label-sm">Sarlavha</span><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={80} /></label>
        <label className="col" style={{ gap: 6 }}><span className="label-sm">Matn</span><textarea className="input" rows={3} value={f.text} onChange={(e) => set('text', e.target.value)} maxLength={300} /></label>
        <div className="fg-2">
          <label className="col" style={{ gap: 6 }}><span className="label-sm">Tugma matni</span><input className="input" value={f.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} maxLength={30} placeholder="Kirish" /></label>
          <label className="col" style={{ gap: 6 }}><span className="label-sm">Tugma havolasi</span><input className="input mono" value={f.ctaHref} onChange={(e) => set('ctaHref', e.target.value)} placeholder="/login" /></label>
        </div>
        <div className="fg-2">
          <AudSelect value={f.audience} onChange={(v) => set('audience', v)} />
          <label className="col" style={{ gap: 6 }}><span className="label-sm">Faqat sahifada (ixtiyoriy)</span><input className="input mono" value={f.page} onChange={(e) => set('page', e.target.value)} placeholder="/stadiums" /></label>
        </div>
        <div className="fg-2"><PosePick value={f.pose} onChange={(v) => set('pose', v)} /><label className="col" style={{ gap: 6 }}><span className="label-sm">Tartib</span><input className="input mono" type="number" min={0} value={f.sort} onChange={(e) => set('sort', +e.target.value || 0)} /></label></div>
        <div className="row between"><span>Faol</span><Toggle on={f.active} onChange={(v) => set('active', v)} label="Faol" /></div>
        {err && <div role="alert" className="row pay-alert"><Icon n="error" size={20} /><span>{err}</span></div>}
        <div className="row" style={{ gap: 10 }}>{init && <button className="btn btn-danger-outline" onClick={remove}>O‘chirish</button>}<button className="btn btn-outline grow" onClick={onClose}>Bekor qilish</button><Btn className="btn btn-primary grow" loading={busy} disabled={!f.text.trim()} onClick={save}>Saqlash</Btn></div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- 5. Sayr qadamlari
const PAGES: [string, string][] = [['site', 'Saytning to‘liq sayri'], ['landing', 'Bosh sahifa (mehmon)'], ['home', 'Asosiy'], ['stadiums', 'Stadionlar'], ['stadium', 'Stadion sahifasi'], ['discover', 'Izlash'], ['team', 'Jamoam'], ['bookings', 'Bronlarim'], ['messages', 'Xabarlar'], ['notifications', 'Bildirishnomalar'], ['reels', 'Reels'], ['profile', 'Profil'], ['owner', 'Egasi paneli'], ['admin', 'Admin']];
function Tour() {
  const r = useApi<{ items: Step[] }>('/admin/foogi/tour');
  const [page, setPage] = useState('site');
  const [edit, setEdit] = useState<Step | null | 'new'>(null);
  const toast = useToast();
  const items = (r.data?.items ?? []).filter((s) => s.page === page);
  return (
    <>
      <div className="row wrap" style={{ gap: 8 }}>{PAGES.map(([k, l]) => <button key={k} className={`chip ${page === k ? 'on' : ''}`} aria-pressed={page === k} onClick={() => setPage(k)}>{l}<span className="c3 mono" style={{ fontSize: 11 }}>{(r.data?.items ?? []).filter((s) => s.page === k).length || ''}</span></button>)}</div>
      <div className="row between wrap" style={{ gap: 8 }}>
        <p className="c2" style={{ fontSize: 14, maxWidth: 680, lineHeight: 1.5 }}>{page === 'site' ? 'To‘liq sayr sahifadan sahifaga o‘tadi. Element: «/yo‘l#kalit», masalan «/stadiums#list». Kalit – sahifadagi data-tour qiymati yoki CSS selektor.' : 'Element: sahifadagi data-tour kaliti (masalan «list», «search», «nav») yoki CSS selektor. Topilmagan qadam o‘tkazib yuboriladi.'}</p>
        <button className="btn btn-primary" onClick={() => setEdit('new')}><Icon n="add" size={20} />Qadam qo‘shish</button>
      </div>
      <Async q={r} loading={<Loading rows={3} />}>
        {() => (!items.length ? <div className="card"><Empty art="present" title="Bu sahifada sayr yo‘q" /></div> : (
          <div className="card col" style={{ padding: 0 }}>
            {items.map((s, i) => (
              <div key={s.id} className="row" style={{ gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', opacity: s.active ? 1 : 0.55 }}>
                <span className="mono c3" style={{ width: 22, textAlign: 'center' }}>{i + 1}</span>
                <Art pose={s.pose} size={44} />
                <span className="col grow" style={{ minWidth: 0 }}><b className="ellipsis" style={{ fontSize: 15 }}>{s.title}</b><span className="c2 ellipsis" style={{ fontSize: 13 }}>{s.text}</span><span className="mono c3" style={{ fontSize: 11 }}>{s.target} · {audT(s.audience)}</span></span>
                <button className="btn btn-outline btn-sm" onClick={() => setEdit(s)}>Tahrirlash</button>
              </div>
            ))}
          </div>
        ))}
      </Async>
      {edit && <StepForm init={edit === 'new' ? null : edit} page={page} nextSort={(items[items.length - 1]?.sort ?? 0) + 1} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast('Saqlandi'); r.reload(); }} />}
    </>
  );
}
function StepForm({ init, page, nextSort, onClose, onSaved }: { init: Step | null; page: string; nextSort: number; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ page: init?.page ?? page, target: init?.target ?? '', title: init?.title ?? '', text: init?.text ?? '', pose: init?.pose ?? 'present', audience: init?.audience ?? ('all' as Aud), sort: init?.sort ?? nextSort, active: init?.active ?? true });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => { setBusy(true); setErr(null); try { if (init) await put(`/admin/foogi/tour/${init.id}`, f); else await post('/admin/foogi/tour', f); onSaved(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const remove = async () => { if (!init) return; await del(`/admin/foogi/tour/${init.id}`); onSaved(); };
  return (
    <Modal open wide onClose={() => !busy && onClose()} title={init ? 'Qadamni tahrirlash' : 'Yangi qadam'}>
      <div className="fg-form">
        <div className="fg-2">
          <label className="col" style={{ gap: 6 }}><span className="label-sm">Sahifa</span><select className="input" value={f.page} onChange={(e) => set('page', e.target.value)}>{PAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="col" style={{ gap: 6 }}><span className="label-sm">Element</span><input className="input mono" value={f.target} onChange={(e) => set('target', e.target.value)} placeholder={f.page === 'site' ? '/stadiums#list' : 'list'} /></label>
        </div>
        <label className="col" style={{ gap: 6 }}><span className="label-sm">Sarlavha</span><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={80} /></label>
        <label className="col" style={{ gap: 6 }}><span className="label-sm">Matn</span><textarea className="input" rows={3} value={f.text} onChange={(e) => set('text', e.target.value)} maxLength={300} /></label>
        <div className="fg-2"><AudSelect value={f.audience} onChange={(v) => set('audience', v)} /><label className="col" style={{ gap: 6 }}><span className="label-sm">Tartib</span><input className="input mono" type="number" min={0} value={f.sort} onChange={(e) => set('sort', +e.target.value || 0)} /></label></div>
        <PosePick value={f.pose} onChange={(v) => set('pose', v)} />
        <div className="row between"><span>Faol</span><Toggle on={f.active} onChange={(v) => set('active', v)} label="Faol" /></div>
        {err && <div role="alert" className="row pay-alert"><Icon n="error" size={20} /><span>{err}</span></div>}
        <div className="row" style={{ gap: 10 }}>{init && <button className="btn btn-danger-outline" onClick={remove}>O‘chirish</button>}<button className="btn btn-outline grow" onClick={onClose}>Bekor qilish</button><Btn className="btn btn-primary grow" loading={busy} disabled={!f.target.trim() || !f.title.trim()} onClick={save}>Saqlash</Btn></div>
      </div>
    </Modal>
  );
}

export default function AdminFoogi() {
  const [tab, setTab] = useState<'teach' | 'kb' | 'test' | 'tips' | 'tour'>('teach');
  const stats = useApi<{ open: number; answers: number; tips: number; steps: number; asked24: number; answered24: number }>('/admin/foogi/stats');
  const s = stats.data;
  const tabs = [['teach', 'O‘rgatish', 'school', s?.open], ['kb', 'Bilimlar', 'menu_book', undefined], ['test', 'Sinov', 'science', undefined], ['tips', 'Takliflar', 'lightbulb', undefined], ['tour', 'Sayr', 'tour', undefined]] as const;
  return (
    <>
      <AdminHeader title="FOOGI – yordamchini o‘rgatish" />
      <div className="fg-hero card">
        <Art pose="thinking" size={96} />
        <div className="col grow" style={{ gap: 6, minWidth: 0 }}>
          <b style={{ fontSize: 18 }}>FOOGI tashqi xizmatlarsiz ishlaydi – u faqat siz o‘rgatgan bilimlardan javob beradi.</b>
          <span className="c2" style={{ fontSize: 14, lineHeight: 1.5 }}>Javob topa olmagan yoki foydalanuvchi «foydali emas» degan savollar «O‘rgatish» navbatiga tushadi. Har birini mos bilimga bog‘lang – keyingi safar FOOGI o‘zi javob beradi.</span>
        </div>
        {s && (
          <div className="fg-stats">
            <span><b className="mono">{s.open}</b>o‘rgatish kerak</span>
            <span><b className="mono">{s.answers}</b>bilim</span>
            <span><b className="mono">{s.asked24 ? Math.round((s.answered24 / s.asked24) * 100) : 0}%</b>24 soatda javob ({s.answered24}/{s.asked24})</span>
          </div>
        )}
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        {tabs.map(([k, t, icon, n]) => (
          <button key={k} className={`chip ${tab === k ? 'on' : ''}`} aria-pressed={tab === k} onClick={() => setTab(k)} style={{ minHeight: 44 }}>
            <Icon n={icon} size={18} />{t}{!!n && <span className="badge-n">{n}</span>}
          </button>
        ))}
      </div>
      {tab === 'teach' ? <Teach onChange={stats.reload} /> : tab === 'kb' ? <Knowledge /> : tab === 'test' ? <Playground /> : tab === 'tips' ? <Tips /> : <Tour />}
    </>
  );
}
