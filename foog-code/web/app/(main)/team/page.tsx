'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Async, Avatar, Btn, Icon, Modal } from '@/components/ui';
import { PayModal, type PayMethod } from '@/components/pay';
import { useApi } from '@/lib/useApi';
import { del, get, post, qs } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useSession } from '@/lib/session';
import { DISTRICTS, MONTHS, SKILL_LABEL, sum, tashkent } from '@/lib/format';

type Pay = { id: string; code: string; purpose: 'team_create' | 'team_monthly'; purposeT: string; amount: number; status: 'review' | 'approved' | 'fraud'; team: string | null; createdAt: string };
type Member = { id: string; name: string; username: string | null; avatarUrl: string | null; position: string | null; joinedAt: string; captain: boolean };
type R = {
  tariff: { createPrice: number; monthlyPrice: number; memberLimit: number; periodDays: number };
  methods: PayMethod[]; serviceDown: string;
  block: { endsT: string; limit: number; hours: number } | null;
  pending: Pay | null;
  team: null | { id: string; name: string; short: string; district: string | null; level: string; status: 'active' | 'frozen'; paidUntil: string | null; limit: number; chatId: string | null; members: Member[] };
  history: Pay[];
};
const dm = (iso: string) => { const d = tashkent(new Date(iso)).date; return `${Number(d.slice(8))}-${MONTHS[Number(d.slice(5, 7)) - 1]}`; };
const since = (iso: string) => { const d = tashkent(new Date(iso)).date; return `${MONTHS[Number(d.slice(5, 7)) - 1].slice(0, 3)} ${d.slice(0, 4)}`; };
const ST: Record<string, [string, string]> = { approved: ['TASDIQLANDI', 'success'], review: ['TEKSHIRILMOQDA', 'warning'], fraud: ['RAD ETILDI', 'error'] };

function Invite({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<{ id: string; name: string; username: string | null; avatarUrl: string | null; position: string | null; district: string | null }[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const search = async (v: string) => { setQ(v); if (v.trim().length < 2) return setRes(null); try { setRes((await get<{ items: NonNullable<typeof res> }>(`/players${qs({ q: v.trim() })}`)).items.slice(0, 8)); } catch { setRes([]); } };
  const invite = async (id: string, name: string) => {
    setBusy(id);
    try { await post(`/teams/${teamId}/invite`, { userId: id }); toast(`Taklif yuborildi · ${name} qabul qilsa, tarkibga qo‘shiladi`); onClose(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(null); }
  };
  return (
    <Modal open onClose={onClose} title="O‘yinchini taklif qilish">
      <div className="search"><Icon n="search" size={22} /><input autoFocus value={q} onChange={(e) => search(e.target.value)} placeholder="Ism, @username yoki tuman" aria-label="O‘yinchini qidirish" /></div>
      <div className="col" style={{ gap: 4, maxHeight: '45vh', overflowY: 'auto' }}>
        {res?.map((p) => (
          <div key={p.id} className="row" style={{ gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', minHeight: 52 }}>
            <Avatar name={p.name} url={p.avatarUrl} size={36} />
            <span className="col grow" style={{ minWidth: 0 }}><b className="ellipsis" style={{ fontSize: 14 }}>{p.name}</b><span className="c2 t-cap">{[p.position, p.district].filter(Boolean).join(' · ') || '—'}</span></span>
            <Btn className="btn btn-outline btn-sm" loading={busy === p.id} onClick={() => invite(p.id, p.name)}>Taklif qilish</Btn>
          </div>
        ))}
        {res && !res.length && <span className="c3 t-small" style={{ padding: 8 }}>Hech kim topilmadi</span>}
      </div>
    </Modal>
  );
}

export default function TeamPage() {
  const q = useApi<R>('/me/team');
  const { me } = useSession();
  const toast = useToast();
  const [name, setName] = useState('');
  const [district, setDistrict] = useState(me?.district ?? 'Yunusobod');
  const [pay, setPay] = useState<null | 'team_create' | 'team_monthly'>(null);
  const [invite, setInvite] = useState(false);
  const [kick, setKick] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const doKick = async (teamId: string) => {
    if (!kick) return;
    setBusy(true);
    try { await del(`/teams/${teamId}/members/${kick.id}`); toast(`${kick.name} jamoadan chiqarildi`, { kind: 'warn' }); setKick(null); q.reload(); } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };

  return (
    <div className="page col" style={{ gap: 20 }}>
      <Async q={q}>
        {(d) => {
          const T = d.tariff, t = d.team, blocked = !!d.block, pending = !!d.pending;
          const frozen = t?.status === 'frozen';
          const count = t?.members.length ?? 0, full = !!t && count >= t.limit;
          const lockCreate = blocked || pending || name.trim().length < 2;
          return (
            <>
              <div className="col" style={{ gap: 4 }}>
                <div className="label">{t ? `Kapitan · ${me?.name ?? ''}` : 'Jamoa yaratish'}</div>
                <h1 className="t-page">{t ? 'Jamoam' : 'Jamoa yaratish'}</h1>
              </div>

              {d.block && (
                <div className="tm-banner" role="alert" style={{ background: 'color-mix(in oklch, var(--error) 14%, transparent)' }}>
                  <Icon n="block" style={{ color: 'var(--error)' }} />
                  <span><b>Hisobingiz {d.block.hours} soatga cheklangan</b><br />Ketma-ket {d.block.limit} ta to‘lov cheki tasdiqlanmadi. <b>{d.block.endsT}</b> gacha jamoa yaratish va yangi to‘lov yuborish yopiq. Xato deb hisoblasangiz: <a href="https://t.me/foog_pro" target="_blank" rel="noreferrer">@foog_pro</a></span>
                </div>
              )}
              {d.pending && (
                <div className="tm-banner" style={{ background: 'color-mix(in oklch, var(--accent) 14%, transparent)' }}>
                  <Icon n="hourglass_top" style={{ color: 'var(--accent)' }} />
                  <span><b>To‘lovingiz tekshirilmoqda · {d.pending.code}.</b> Odatda 15 daqiqadan 2 soatgacha. Natija Telegram’ga keladi.</span>
                </div>
              )}

              <div className="tm-grid">
                <div className="col" style={{ gap: 20, minWidth: 0 }}>
                  {!t ? (
                    <div className="card col" style={{ padding: 24, gap: 18 }}>
                      <div className="col" style={{ gap: 6 }}>
                        <span className="label-sm c3">JAMOA YARATISH</span>
                        <h2 style={{ fontSize: 24, fontWeight: 800 }}>O‘z jamoangizni yarating va boshqaring</h2>
                        <p className="c2" style={{ fontSize: 15, lineHeight: 1.5 }}>Jamoa chati, tarkib, o‘yinlarga jamoa bo‘lib yozilish va jamoa statistikasi. Jamoa admin tasdiqlagan to‘lovdan keyin faollashadi.</p>
                      </div>
                      <div className="tm-facts">
                        {([['Jamoa yaratish', sum(T.createPrice), 'bir martalik · 1-oy ichida'], ['Oylik obuna', sum(T.monthlyPrice), `${T.periodDays} kun`], ['A’zolar limiti', `${T.memberLimit} kishi`, 'kapitan bilan birga']] as const).map(([l, v, s]) => (
                          <div key={l} className="tm-fact"><span className="c2 t-cap">{l}</span><b className="mono" style={{ fontSize: 17 }}>{v}</b><span className="c3 t-cap">{s}</span></div>
                        ))}
                      </div>
                      <div className="row wrap" style={{ gap: 10 }}>
                        <label className="field grow" style={{ minWidth: 220 }}><span>Jamoa nomi</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Yunusobod FC" maxLength={40} /></label>
                        <label className="field" style={{ minWidth: 180 }}><span>Tuman</span><select className="select" value={district} onChange={(e) => setDistrict(e.target.value)}>{DISTRICTS.map((x) => <option key={x}>{x}</option>)}</select></label>
                      </div>
                      <button className="btn btn-primary btn-lg btn-block" disabled={lockCreate} onClick={() => setPay('team_create')}>{blocked ? 'Vaqtincha yopiq' : pending ? 'To‘lov tekshirilmoqda' : `Jamoa yaratish · ${sum(T.createPrice)}`}</button>
                      <span className="c3 t-cap" style={{ marginTop: -8 }}>Keyin oyiga {sum(T.monthlyPrice)} · birinchi oy narxga kiradi</span>
                    </div>
                  ) : (
                    <>
                      <div className="card col" style={{ padding: 20, gap: 16 }}>
                        <div className="row between wrap" style={{ gap: 12 }}>
                          <div className="row" style={{ gap: 14, minWidth: 0 }}>
                            <span style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--inverse)', color: 'var(--on-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 22px var(--font-ui)', flexShrink: 0 }}>{t.short}</span>
                            <span className="col" style={{ gap: 4, minWidth: 0 }}>
                              <span className="row wrap" style={{ gap: 8 }}><b style={{ fontSize: 22 }} className="ellipsis">{t.name}</b><span className={`pill-tag ${frozen ? 'warning' : pending ? 'accent' : 'success'}`}>{frozen ? 'MUZLATILGAN' : pending ? 'TEKSHIRILMOQDA' : 'FAOL'}</span></span>
                              <span className="c2 t-small">Kapitan: {me?.name} · {SKILL_LABEL[t.level]} · {t.district ?? 'Toshkent'}</span>
                            </span>
                          </div>
                          {T.monthlyPrice > 0 && <button className={`btn ${frozen ? 'btn-primary' : 'btn-outline'}`} disabled={pending || blocked} onClick={() => setPay('team_monthly')}>{pending ? 'Tekshirilmoqda…' : frozen ? `Obunani tiklash · ${sum(T.monthlyPrice)}` : 'Oylik to‘lov'}</button>}
                        </div>
                        {frozen && (
                          <div className="tm-banner" style={{ background: 'color-mix(in oklch, var(--warning) 14%, transparent)' }}>
                            <Icon n="ac_unit" style={{ color: 'var(--warning)' }} />
                            <span><b>Obuna {t.paidUntil ? dm(t.paidUntil) : ''}da tugagan – jamoa muzlatilgan.</b><br />Yangi a’zo qo‘shish, o‘yinga jamoa bo‘lib yozilish va jamoa chati yopiq. Tarkib va tarix saqlanadi.</span>
                          </div>
                        )}
                        <div className="tm-facts">
                          {([['Obuna', !t.paidUntil ? 'Muddatsiz' : frozen ? `${dm(t.paidUntil)} tugagan` : `${dm(t.paidUntil)}gacha`, frozen ? 'var(--warning)' : undefined], ['Keyingi to‘lov', sum(T.monthlyPrice), undefined], ['A’zolar', `${count} / ${t.limit}`, full ? 'var(--warning)' : undefined]] as const).map(([l, v, c]) => (
                            <div key={l} className="tm-fact"><span className="c2 t-cap">{l}</span><b className="mono" style={{ fontSize: 16, color: c }}>{v}</b></div>
                          ))}
                        </div>
                        {t.chatId && !frozen && <Link href={`/messages/${t.chatId}`} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}><Icon n="chat" size={18} />Jamoa chati</Link>}
                      </div>

                      <div className="card col" style={{ padding: 20, gap: 12 }}>
                        <div className="row between wrap" style={{ gap: 10 }}>
                          <span className="col" style={{ gap: 2 }}><b style={{ fontSize: 18 }}>A’zolar</b><span className="mono c2" style={{ fontSize: 13 }}>{count} / {t.limit} · {full ? 'limit to‘ldi' : `${t.limit - count} ta joy bo‘sh`}</span></span>
                          <button className="btn btn-inverse btn-sm" disabled={full || frozen} onClick={() => setInvite(true)}><Icon n="person_add" size={18} />{full ? 'Limit to‘ldi' : 'Taklif qilish'}</button>
                        </div>
                        <div className="tm-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.round((count / t.limit) * 100))}%`, background: full ? 'var(--warning)' : 'var(--volt)' }} /></div>
                        {full && <span className="c2 t-small">Limit to‘ldi. Yangi o‘yinchi qo‘shish uchun kimnidir chiqaring – limitni admin belgilaydi.</span>}
                        <div className="col">
                          {t.members.map((m) => (
                            <div key={m.id} className="row" style={{ gap: 12, padding: '10px 0', borderTop: '1px solid var(--border)', minHeight: 56 }}>
                              <Avatar name={m.name} url={m.avatarUrl} size={40} />
                              {m.position && <span className="tag" style={{ flexShrink: 0 }}>{m.position}</span>}
                              <Link href={m.username ? `/u/${m.username}` : '#'} className="grow ellipsis" style={{ color: 'var(--text-1)', fontWeight: 600, fontSize: 15, minWidth: 0 }}>{m.name}{m.captain && <span style={{ color: 'var(--brand-ink)', fontSize: 12, fontWeight: 600, marginLeft: 8 }}>kapitan</span>}</Link>
                              <span className="mono c3 hide-mobile" style={{ fontSize: 12 }}>{since(m.joinedAt)}</span>
                              {!m.captain && <button className="icon-btn ghost" aria-label={`${m.name} ni jamoadan chiqarish`} title="Jamoadan chiqarish" onClick={() => setKick(m)}><Icon n="person_remove" /></button>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="col" style={{ gap: 20 }}>
                  <div className="card col" style={{ padding: 20, gap: 4 }}>
                    <b style={{ fontSize: 18, marginBottom: 6 }}>Tarif</b>
                    {([['Jamoa yaratish', sum(T.createPrice)], ['Oylik obuna', sum(T.monthlyPrice)], ['A’zolar limiti', `${t?.limit ?? T.memberLimit} kishi`]] as const).map(([k, v]) => <div key={k} className="row between" style={{ padding: '6px 0', fontSize: 14 }}><span className="c2">{k}</span><span className="mono">{v}</span></div>)}
                    <span className="c3 t-cap" style={{ marginTop: 8 }}>Narx va limitlarni FOOG admini belgilaydi.</span>
                  </div>
                  <div className="card col" style={{ padding: 20, gap: 4 }}>
                    <b style={{ fontSize: 18, marginBottom: 6 }}>To‘lovlar tarixi</b>
                    {d.history.map((h) => (
                      <div key={h.id} className="row between" style={{ gap: 12, padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                        <span className="col" style={{ gap: 2, minWidth: 0 }}><b className="ellipsis" style={{ fontSize: 14 }}>{h.purposeT}{h.team ? ` · ${h.team}` : ''}</b><span className="mono c3" style={{ fontSize: 12 }}>{h.code} · {dm(h.createdAt)}</span></span>
                        <span className="col" style={{ gap: 4, alignItems: 'flex-end' }}><span className="mono" style={{ fontSize: 14, whiteSpace: 'nowrap' }}>{sum(h.amount)}</span><span className={`pill-tag ${ST[h.status][1]}`}>{ST[h.status][0]}</span></span>
                      </div>
                    ))}
                    {!d.history.length && <span className="c3 t-small">Hali to‘lov yo‘q.</span>}
                  </div>
                </div>
              </div>

              {pay && (
                <PayModal
                  purpose={pay} methods={d.methods} serviceDown={d.serviceDown}
                  amount={pay === 'team_create' ? T.createPrice : T.monthlyPrice}
                  title={pay === 'team_create' ? `Jamoa yaratish · ${name.trim() || 'Yangi jamoa'}` : `Oylik obuna · ${t?.name} (${T.periodDays} kun)`}
                  team={pay === 'team_create' ? { name: name.trim(), district } as { name: string } : undefined}
                  teamId={pay === 'team_monthly' ? t?.id : undefined}
                  onClose={() => { setPay(null); q.reload(); }} onSent={() => q.reload()}
                />
              )}
              {invite && t && <Invite teamId={t.id} onClose={() => setInvite(false)} />}
              {kick && t && (
                <Modal open onClose={() => setKick(null)} title="Jamoadan chiqarish">
                  <p className="c2" style={{ fontSize: 15, lineHeight: 1.5 }}>{kick.name} ni «{t.name}» jamoasidan chiqarasizmi? U jamoa chatidan ham chiqariladi.</p>
                  <div className="row" style={{ gap: 8 }}><button className="btn btn-outline grow" onClick={() => setKick(null)}>Bekor qilish</button><Btn className="btn btn-danger grow" loading={busy} onClick={() => doKick(t.id)}>Chiqarish</Btn></div>
                </Modal>
              )}
            </>
          );
        }}
      </Async>
    </div>
  );
}
