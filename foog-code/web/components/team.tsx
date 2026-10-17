'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Async, Avatar, Btn, Icon, Modal } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { del, patch, post } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { DISTRICTS, SKILL_LABEL } from '@/lib/format';

export type TeamFields = { name: string; short: string; district: string; level: string; plays: string; lookingFor: string[] };
type Member = { id: string; name: string; username: string | null; avatarUrl: string | null; position: string | null; captain: boolean };
type TeamDetail = { id: string; name: string; short: string; district: string | null; level: string; lookingFor: string[]; plays: string | null; isMember: boolean; isCaptain: boolean; chatId: string | null; members: Member[] };

/** Jamoa tuzish va tahrirlash formasi (team bo‘lsa – tahrirlash) */
export function TeamForm({ open, onClose, onDone, team }: { open: boolean; onClose: () => void; onDone: () => void; team?: TeamDetail }) {
  const [f, setF] = useState<TeamFields>(team
    ? { name: team.name, short: team.short, district: team.district ?? 'Yunusobod', level: team.level, plays: team.plays ?? '', lookingFor: team.lookingFor }
    : { name: '', short: '', district: 'Yunusobod', level: 'intermediate', plays: '', lookingFor: [] });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const go = async () => {
    setBusy(true);
    try {
      if (team) { await patch(`/teams/${team.id}`, { ...f, plays: f.plays || null }); toast('Jamoa ma’lumotlari saqlandi'); }
      else { await post('/teams', { ...f, plays: f.plays || undefined }); toast('Jamoa tuzildi · jamoa chati ochildi'); }
      onDone(); onClose();
    } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={team ? 'Jamoani tahrirlash' : 'Jamoa tuzish'}>
      <div className="row" style={{ gap: 8 }}>
        <label className="field grow"><span>Nomi</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Yunusobod Lions" maxLength={40} /></label>
        <label className="field" style={{ width: 100 }}><span>Qisqa</span><input className="input" value={f.short} onChange={(e) => setF({ ...f, short: e.target.value.toUpperCase().slice(0, 3) })} placeholder="YL" /></label>
      </div>
      <label className="field"><span>Tuman</span><select className="select" value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })}>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></label>
      <div className="field"><span>Daraja</span><div className="row" style={{ gap: 8 }}>{(['beginner', 'intermediate', 'advanced'] as const).map((k) => <button key={k} className={`chip ${f.level === k ? 'on' : ''}`} onClick={() => setF({ ...f, level: k })}>{SKILL_LABEL[k]}</button>)}</div></div>
      <div className="field"><span>Kim kerak</span><div className="row wrap" style={{ gap: 8 }}>{['GK', 'DEF', 'MID', 'FWD'].map((k) => <button key={k} className={`chip ${f.lookingFor.includes(k) ? 'on' : ''}`} onClick={() => setF({ ...f, lookingFor: f.lookingFor.includes(k) ? f.lookingFor.filter((x) => x !== k) : [...f.lookingFor, k] })}>{k}</button>)}</div></div>
      <label className="field"><span>Qachon o‘ynaydi</span><input className="input" value={f.plays} onChange={(e) => setF({ ...f, plays: e.target.value })} placeholder="Payshanba kechqurun" /></label>
      <Btn className="btn btn-primary btn-block" loading={busy} disabled={f.name.trim().length < 2 || f.short.length < 2} onClick={go}>{team ? 'Saqlash' : 'Jamoa tuzish'}</Btn>
    </Modal>
  );
}

/** Jamoa tarkibi: kapitan – tahrirlash, a’zoni chiqarish, kapitanlikni o‘tkazish, o‘chirish; a’zo – chiqish */
export function TeamSheet({ id, onClose, onChange }: { id: string; onClose: () => void; onChange: () => void }) {
  const q = useApi<TeamDetail>(`/teams/${id}`);
  const [edit, setEdit] = useState(false);
  const [ask, setAsk] = useState<null | { text: string; label: string; danger?: boolean; run: () => Promise<unknown>; done: string; close?: boolean }>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const run = async () => {
    if (!ask) return;
    setBusy(true);
    try { await ask.run(); toast(ask.done, { kind: ask.danger ? 'warn' : 'ok' }); onChange(); if (ask.close) onClose(); else q.reload(); setAsk(null); }
    catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={q.data?.name ?? 'Jamoa'}>
      <Async q={q}>
        {(t) => (
          <div className="col" style={{ gap: 16 }}>
            <div className="row between wrap" style={{ gap: 8 }}>
              <span className="c2" style={{ fontSize: 14 }}>{SKILL_LABEL[t.level]} · {t.district ?? 'Toshkent'}{t.plays ? ` · ${t.plays}` : ''}</span>
              {t.isCaptain && <button className="btn btn-outline btn-sm" onClick={() => setEdit(true)}><Icon n="edit" size={18} />Tahrirlash</button>}
            </div>
            <div className="col" style={{ gap: 4 }}>
              <span className="label-sm c3">Tarkib · {t.members.length}</span>
              {t.members.map((m) => (
                <div key={m.id} className="row" style={{ gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', minHeight: 52 }}>
                  <Avatar name={m.name} url={m.avatarUrl} size={36} />
                  <Link href={m.username ? `/u/${m.username}` : '#'} className="col grow" style={{ minWidth: 0, color: 'var(--text-1)' }}>
                    <b className="ellipsis" style={{ fontSize: 14 }}>{m.name}</b>
                    <span className="c2 t-cap">{m.position ?? '—'}</span>
                  </Link>
                  {m.captain && <span className="pill-tag volt"><Icon n="star" fill size={14} />Kapitan</span>}
                  {t.isCaptain && !m.captain && (
                    <div className="row" style={{ gap: 4 }}>
                      <button className="icon-btn" aria-label={`${m.name} ni kapitan qilish`} title="Kapitan qilish" onClick={() => setAsk({ text: `Kapitanlikni ${m.name} ga o‘tkazasizmi? Shundan keyin jamoani u boshqaradi.`, label: 'Kapitan qilish', run: () => post(`/teams/${t.id}/captain`, { userId: m.id }), done: `${m.name} endi kapitan` })}><Icon n="military_tech" /></button>
                      <button className="icon-btn" aria-label={`${m.name} ni jamoadan chiqarish`} title="Jamoadan chiqarish" onClick={() => setAsk({ text: `${m.name} ni jamoadan chiqarasizmi? U jamoa chatidan ham chiqariladi.`, label: 'Chiqarish', danger: true, run: () => del(`/teams/${t.id}/members/${m.id}`), done: `${m.name} jamoadan chiqarildi` })}><Icon n="person_remove" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              {t.isMember && t.chatId && <Link href={`/messages/${t.chatId}`} className="btn btn-outline grow"><Icon n="chat" size={18} />Jamoa chati</Link>}
              {t.isMember && !t.isCaptain && <button className="btn btn-danger-outline" onClick={() => setAsk({ text: `«${t.name}» jamoasidan chiqasizmi?`, label: 'Chiqish', danger: true, run: () => post(`/teams/${t.id}/leave`), done: 'Jamoadan chiqdingiz', close: true })}>Jamoadan chiqish</button>}
              {t.isCaptain && <button className="btn btn-danger-outline" onClick={() => setAsk({ text: `«${t.name}» jamoasini butunlay o‘chirasizmi? Jamoa chati ham o‘chadi, a’zolarga xabar boradi. Bu amalni qaytarib bo‘lmaydi.`, label: 'O‘chirish', danger: true, run: () => del(`/teams/${t.id}`), done: 'Jamoa o‘chirildi', close: true })}>Jamoani o‘chirish</button>}
            </div>
            {t.isCaptain && <p className="c3 t-cap">Kapitan jamoadan chiqishi uchun avval kapitanlikni boshqa a’zoga o‘tkazadi.</p>}
            {edit && <TeamForm open onClose={() => setEdit(false)} onDone={() => { q.reload(); onChange(); }} team={t} />}
          </div>
        )}
      </Async>
      {ask && (
        <Modal open onClose={() => setAsk(null)} title="Tasdiqlang">
          <p className="c2" style={{ fontSize: 15, lineHeight: 1.5 }}>{ask.text}</p>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-outline grow" onClick={() => setAsk(null)}>Bekor qilish</button>
            <Btn className={`btn grow ${ask.danger ? 'btn-danger' : 'btn-primary'}`} loading={busy} onClick={run}>{ask.label}</Btn>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
