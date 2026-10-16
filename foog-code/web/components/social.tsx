'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Avatar, Btn, Empty, Icon, Loading, Media, Modal } from './ui';
import { api, del, get, post, upload } from '@/lib/api';
import { ago, num } from '@/lib/format';
import { useToast } from '@/lib/toast';
import { useSession } from '@/lib/session';

export type MiniUser = { id: string; name: string; username: string | null; avatarUrl: string | null; verified?: boolean; position?: string | null; district?: string | null };
export type PostT = {
  id: string; text: string; mediaUrl: string | null; mediaType: string | null; kind: string; createdAt: string;
  stats: { result: string; played?: string; goals: number; assists: number } | null;
  author: MiniUser; stadium: { id: string; name: string; district: string } | null; likes: number; comments: number; liked: boolean; saved: boolean;
};

export const Verified = () => <Icon n="verified" fill size={16} style={{ color: 'var(--accent)' }} />;

// ---------- Izohlar oynasi (post va reel uchun) ----------
type CommentT = { id: string; text: string; createdAt: string; user: MiniUser };
export function CommentsModal({ open, onClose, target, id, onCount }: { open: boolean; onClose: () => void; target: 'posts' | 'reels'; id: string; onCount?: (n: number) => void }) {
  const [items, setItems] = useState<CommentT[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { me } = useSession();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    setItems(null); setErr(null);
    get<{ items: CommentT[] }>(`/${target}/${id}/comments`).then((r) => setItems(r.items)).catch((e) => setErr(e.message));
  }, [open, id]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [items?.length]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const c = await post<CommentT>(`/${target}/${id}/comments`, { text: text.trim() });
      setItems((s) => { const n = [...(s ?? []), c]; onCount?.(n.length); return n; });
      setText('');
    } catch (e2) { toast((e2 as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Izohlar${items ? ` · ${items.length}` : ''}`}>
      <div className="col" style={{ gap: 14, minHeight: 160, maxHeight: '50vh', overflowY: 'auto' }}>
        {err ? <p style={{ color: 'var(--error)' }}>{err}</p> : !items ? <Loading rows={3} card={false} /> : !items.length ? <Empty icon="chat_bubble" title="Hali izoh yo‘q" text="Birinchi bo‘lib fikr bildiring." /> : items.map((c) => (
          <div key={c.id} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <Link href={`/u/${c.user.username}`}><Avatar name={c.user.name} url={c.user.avatarUrl} size={36} /></Link>
            <div className="col grow" style={{ gap: 2 }}>
              <div className="row" style={{ gap: 6, fontSize: 14 }}><b>{c.user.name}</b><span className="c3 t-cap">{ago(c.createdAt)}</span></div>
              <div style={{ fontSize: 15, lineHeight: 1.45, wordBreak: 'break-word' }}>{c.text}</div>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {me ? (
        <form onSubmit={send} className="row" style={{ gap: 8 }}>
          <input className="input" style={{ borderRadius: 999 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Izoh yozing…" maxLength={500} aria-label="Izoh" />
          <Btn className="icon-btn" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }} loading={busy} disabled={!text.trim()} aria-label="Yuborish"><Icon n="send" /></Btn>
        </form>
      ) : <Link href="/login" className="btn btn-primary btn-block">Izoh yozish uchun kiring</Link>}
    </Modal>
  );
}

// ---------- Ulashish oynasi: do‘stlar ro‘yxati va ijtimoiy tarmoqlar ----------
export function ShareSheet({ open, onClose, url, title, reelId, videoUrl }: { open: boolean; onClose: () => void; url: string; title: string; reelId?: string; videoUrl?: string }) {
  const [friends, setFriends] = useState<MiniUser[] | null>(null);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (!open) return;
    setSel({});
    get<{ items: MiniUser[] }>(`/reels/share/friends${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((r) => setFriends(r.items)).catch(() => setFriends([]));
  }, [open, q]);
  const full = typeof window !== 'undefined' ? new URL(url, location.origin).toString() : url;
  const ids = Object.keys(sel).filter((k) => sel[k]);
  const send = async () => {
    if (!reelId || !ids.length) return;
    setBusy(true);
    try {
      await post(`/reels/${reelId}/share`, { userIds: ids });
      toast(`${ids.length} ta do‘stga yuborildi`);
      onClose();
    } catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(full); toast('Havola nusxalandi'); } catch { toast('Nusxalab bo‘lmadi', { kind: 'err' }); }
  };
  const enc = encodeURIComponent;
  const socials = [
    { n: 'Telegram', c: '#2AABEE', href: `https://t.me/share/url?url=${enc(full)}&text=${enc(title)}`, ic: 'send' },
    { n: 'WhatsApp', c: '#25D366', href: `https://wa.me/?text=${enc(`${title} ${full}`)}`, ic: 'chat' },
    { n: 'Facebook', c: '#1877F2', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(full)}`, ic: 'public' },
    { n: 'X', c: '#111', href: `https://x.com/intent/post?url=${enc(full)}&text=${enc(title)}`, ic: 'tag' },
    { n: 'SMS', c: '#34C759', href: `sms:?&body=${enc(`${title} ${full}`)}`, ic: 'sms' },
  ];
  return (
    <Modal open={open} onClose={onClose} title="Ulashish">
      {reelId && (
        <>
          <div className="search" style={{ height: 44 }}><Icon n="search" size={20} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Do‘stlarni qidirish" aria-label="Do‘stlarni qidirish" /></div>
          <div className="scroll-x" style={{ display: 'flex', gap: 14, padding: '4px 2px' }}>
            {friends === null ? <Loading rows={1} card={false} /> : !friends.length ? <p className="c2 t-small">Do‘stlar topilmadi. Kimnidir kuzating – ular shu yerda chiqadi.</p> : friends.map((f) => (
              <button key={f.id} onClick={() => setSel((s) => ({ ...s, [f.id]: !s[f.id] }))} className="col" style={{ alignItems: 'center', gap: 6, width: 68, background: 'none', border: 'none', color: 'var(--text-1)', flexShrink: 0, position: 'relative' }} aria-pressed={!!sel[f.id]}>
                <Avatar name={f.name} url={f.avatarUrl} size={56} ring={sel[f.id] ? 'var(--primary)' : undefined} />
                {sel[f.id] && <span style={{ position: 'absolute', top: 36, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', color: 'var(--on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px var(--surface)' }}><Icon n="check" size={16} /></span>}
                <span className="ellipsis" style={{ fontSize: 12, maxWidth: 68 }}>{f.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
          <Btn className="btn btn-primary btn-block" disabled={!ids.length} loading={busy} onClick={send}>{ids.length ? `Yuborish · ${ids.length}` : 'Do‘stlarni tanlang'}</Btn>
          <hr className="divider" />
        </>
      )}
      <div className="row wrap" style={{ gap: 16, justifyContent: 'space-between' }}>
        {socials.map((s) => (
          <a key={s.n} href={s.href} target="_blank" rel="noopener noreferrer" className="col" style={{ alignItems: 'center', gap: 6, color: 'var(--text-1)', fontSize: 12, minWidth: 60 }}>
            <span style={{ width: 52, height: 52, borderRadius: '50%', background: s.c, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n={s.ic} /></span>{s.n}
          </a>
        ))}
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        <button onClick={copy} className="btn btn-outline btn-sm"><Icon n="link" size={18} />Havolani nusxalash</button>
        {videoUrl && <a href={videoUrl} download className="btn btn-outline btn-sm"><Icon n="download" size={18} />Videoni saqlash</a>}
        {typeof navigator !== 'undefined' && 'share' in navigator && <button className="btn btn-outline btn-sm" onClick={() => navigator.share({ title, url: full }).catch(() => undefined)}><Icon n="more_horiz" size={18} />Boshqa ilovalar</button>}
      </div>
    </Modal>
  );
}

// ---------- Shikoyat oynasi ----------
const REASONS = ['Haqorat', 'Spam / reklama', 'Yolg‘on ma’lumot', 'Mualliflik huquqi', 'Zo‘ravonlik', 'Boshqa'];
export function ReportModal({ open, onClose, targetType, targetId }: { open: boolean; onClose: () => void; targetType: 'post' | 'reel' | 'comment' | 'user'; targetId: string }) {
  const [reason, setReason] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const send = async () => {
    setBusy(true);
    try { await post('/reports', { targetType, targetId, reason, text: text || undefined }); toast('Shikoyat yuborildi. Moderatorlar ko‘rib chiqadi.'); onClose(); }
    catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Shikoyat qilish">
      <p className="c2 t-small">Sababni tanlang. Shikoyat anonim – muallif kim yuborganini ko‘rmaydi.</p>
      <div className="row wrap" style={{ gap: 8 }}>{REASONS.map((r) => <button key={r} className={`chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>{r}</button>)}</div>
      <textarea className="textarea" placeholder="Qo‘shimcha izoh (ixtiyoriy)" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
      <Btn className="btn btn-danger btn-block" disabled={!reason} loading={busy} onClick={send}>Yuborish</Btn>
    </Modal>
  );
}

// ---------- Post kartasi ----------
export function PostCard({ p, onRemoved }: { p: PostT; onRemoved?: () => void }) {
  const [s, setS] = useState(p);
  const [menu, setMenu] = useState(false);
  const [comments, setComments] = useState(false);
  const [share, setShare] = useState(false);
  const [report, setReport] = useState(false);
  const { me } = useSession();
  const toast = useToast();
  const like = async () => {
    if (!me) return (location.href = '/login');
    setS((x) => ({ ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) }));
    try { const r = await post<{ liked: boolean; likes: number }>(`/posts/${p.id}/like`); setS((x) => ({ ...x, liked: r.liked, likes: r.likes })); } catch { setS((x) => ({ ...x, liked: p.liked, likes: p.likes })); }
  };
  const save = async () => {
    setS((x) => ({ ...x, saved: !x.saved }));
    try { const r = await post<{ saved: boolean }>(`/posts/${p.id}/save`); setS((x) => ({ ...x, saved: r.saved })); toast(r.saved ? 'Saqlandi' : 'Saqlanganlardan olib tashlandi'); } catch { setS((x) => ({ ...x, saved: p.saved })); }
  };
  const remove = async () => {
    try { await del(`/posts/${p.id}`); toast('Post o‘chirildi'); onRemoved?.(); } catch (e) { toast((e as Error).message, { kind: 'err' }); }
  };
  const meta = [ago(s.createdAt), s.stadium ? `${s.stadium.name}, ${s.stadium.district}` : s.kind === 'find_players' ? 'O‘yinchi qidirilmoqda' : null].filter(Boolean).join(' · ');
  return (
    <article className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="row" style={{ gap: 12, padding: '16px 18px' }}>
        <Link href={`/u/${s.author.username}`}><Avatar name={s.author.name} url={s.author.avatarUrl} size={40} /></Link>
        <div className="col grow">
          <Link href={`/u/${s.author.username}`} className="row" style={{ gap: 4, fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{s.author.name}{s.author.verified && <Verified />}</Link>
          <div className="c2 ellipsis" style={{ fontSize: 13 }}>{meta}</div>
        </div>
        <div style={{ position: 'relative' }}>
          <button className="icon-btn ghost sm" onClick={() => setMenu((v) => !v)} aria-label="Ko‘proq"><Icon n="more_horiz" size={22} style={{ color: 'var(--text-2)' }} /></button>
          {menu && (
            <div className="menu" style={{ right: 0, top: 44 }} onMouseLeave={() => setMenu(false)}>
              <Link href={`/u/${s.author.username}`}><Icon n="person" />Profilni ko‘rish</Link>
              {me?.id === s.author.id ? <button className="danger" onClick={() => { setMenu(false); remove(); }}><Icon n="delete" />O‘chirish</button>
                : <button className="danger" onClick={() => { setMenu(false); setReport(true); }}><Icon n="flag" />Shikoyat qilish</button>}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: '0 18px 14px', fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{s.text}</div>
      {s.stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', margin: '0 18px 14px', borderRadius: 12, background: 'var(--bg)', padding: '12px 14px', gap: 8 }}>
          {([['Natija', s.stats.result, ''], ['O‘ynadi', s.stats.played ?? '—', ''], ['Gol', String(s.stats.goals), 'ink'], ['Assist', String(s.stats.assists), '']] as const).map(([k, v, c]) => (
            <div key={k} className="col" style={{ gap: 2, minWidth: 0 }}><div className="label-sm">{k}</div><div className={`mono ${c}`} style={{ fontSize: 17, fontWeight: 500 }}>{v}</div></div>
          ))}
        </div>
      )}
      {s.mediaUrl && <Media url={s.mediaUrl} type={s.mediaType} ar={s.mediaType === 'video' ? '16/10' : '4/5'} />}
      <div className="row" style={{ gap: 4, padding: '8px 10px' }}>
        <button onClick={like} className="btn btn-ghost" style={{ height: 40, padding: '0 10px', color: s.liked ? 'var(--error)' : 'var(--text-1)', font: '500 14px var(--font-mono)' }} aria-pressed={s.liked} aria-label="Yoqdi"><Icon n="favorite" fill={s.liked} />{num(s.likes)}</button>
        <button onClick={() => setComments(true)} className="btn btn-ghost" style={{ height: 40, padding: '0 10px', font: '500 14px var(--font-mono)' }} aria-label="Izohlar"><Icon n="chat_bubble" />{num(s.comments)}</button>
        <button onClick={() => setShare(true)} className="icon-btn ghost sm" aria-label="Ulashish"><Icon n="send" /></button>
        <button onClick={save} className="icon-btn ghost sm" style={{ marginLeft: 'auto' }} aria-pressed={s.saved} aria-label="Saqlash"><Icon n="bookmark" fill={s.saved} /></button>
      </div>
      <CommentsModal open={comments} onClose={() => setComments(false)} target="posts" id={p.id} onCount={(n) => setS((x) => ({ ...x, comments: n }))} />
      <ShareSheet open={share} onClose={() => setShare(false)} url={`/u/${s.author.username}`} title={s.text.slice(0, 80)} />
      <ReportModal open={report} onClose={() => setReport(false)} targetType="post" targetId={p.id} />
    </article>
  );
}

// ---------- Post yaratish ----------
export function Composer({ open, onClose, onCreated, initialKind = 'post' }: { open: boolean; onClose: () => void; onCreated: (p: PostT) => void; initialKind?: 'post' | 'result' | 'find_players' }) {
  const [kind, setKind] = useState(initialKind);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [stats, setStats] = useState({ result: '', played: '', goals: '0', assists: '0' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setKind(initialKind); setErr(null); } }, [open, initialKind]);
  const preview = file ? URL.createObjectURL(file) : null;
  const submit = async () => {
    setErr(null);
    if (!text.trim()) return setErr('Matn yozing');
    if (kind === 'result' && !stats.result.trim()) return setErr('Natijani kiriting, masalan: G 4–3');
    const f = new FormData();
    f.set('text', text.trim());
    f.set('kind', kind);
    if (file) f.set('media', file);
    if (kind === 'result') f.set('stats', JSON.stringify({ result: stats.result.trim(), played: stats.played ? `${stats.played}′` : undefined, goals: Number(stats.goals) || 0, assists: Number(stats.assists) || 0 }));
    setBusy(true);
    try {
      const p = await upload<PostT>('/posts', f);
      onCreated(p);
      setText(''); setFile(null); setStats({ result: '', played: '', goals: '0', assists: '0' });
      onClose();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Post yaratish">
      <div className="seg" style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
        {([['post', 'Post'], ['result', 'O‘yin natijasi'], ['find_players', 'O‘yinchi topish']] as const).map(([k, l]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      <textarea className="textarea" autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={kind === 'find_players' ? 'Kim kerak: pozitsiya, daraja, qachon va qayerda…' : kind === 'result' ? 'O‘yin qanday o‘tdi?' : 'Gol, natija yoki fikringizni ulashing…'} aria-label="Post matni" />
      {kind === 'result' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
          <label className="field"><span>Natija</span><input className="input" value={stats.result} onChange={(e) => setStats({ ...stats, result: e.target.value })} placeholder="G 4–3" /></label>
          <label className="field"><span>Daqiqa</span><input className="input" inputMode="numeric" value={stats.played} onChange={(e) => setStats({ ...stats, played: e.target.value.replace(/\D/g, '') })} placeholder="60" /></label>
          <label className="field"><span>Gol</span><input className="input" inputMode="numeric" value={stats.goals} onChange={(e) => setStats({ ...stats, goals: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="field"><span>Assist</span><input className="input" inputMode="numeric" value={stats.assists} onChange={(e) => setStats({ ...stats, assists: e.target.value.replace(/\D/g, '') })} /></label>
        </div>
      )}
      {preview && (
        <div style={{ position: 'relative' }}>
          {file?.type.startsWith('video') ? <video src={preview} controls style={{ width: '100%', borderRadius: 14, maxHeight: 320 }} /> : <img src={preview} alt="" style={{ width: '100%', borderRadius: 14, maxHeight: 320, objectFit: 'cover' }} />}
          <button className="icon-btn sm" style={{ position: 'absolute', top: 8, right: 8 }} onClick={() => setFile(null)} aria-label="Olib tashlash"><Icon n="close" /></button>
        </div>
      )}
      <input ref={inp} type="file" accept="image/*,video/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      {err && <div role="alert" style={{ color: 'var(--error)', fontSize: 14 }}>{err}</div>}
      <div className="row between" style={{ gap: 8 }}>
        <button className="btn btn-ghost" onClick={() => inp.current?.click()}><Icon n="photo_camera" style={{ color: 'var(--accent)' }} />Rasm yoki video</button>
        <Btn className="btn btn-primary" loading={busy} onClick={submit}>Joylash</Btn>
      </div>
    </Modal>
  );
}

// ---------- Hikoyalar ----------
export type StoryGroup = { author: MiniUser; live: boolean; items: { id: string; mediaUrl: string | null; text: string | null; createdAt: string }[] };
export function StoryViewer({ group, onClose }: { group: StoryGroup | null; onClose: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [group]);
  useEffect(() => {
    if (!group) return;
    const t = setTimeout(() => (i + 1 < group.items.length ? setI(i + 1) : onClose()), 5000);
    return () => clearTimeout(t);
  }, [group, i]);
  if (!group) return null;
  const s = group.items[i];
  return (
    <div className="overlay" onClick={onClose} style={{ alignItems: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, 100vw)', aspectRatio: '9/16', maxHeight: '92vh', borderRadius: 24, overflow: 'hidden', position: 'relative', background: s.mediaUrl ? `center/cover url("${s.mediaUrl}")` : 'linear-gradient(160deg, var(--midnight), #1d3b2a)', color: '#fff' }}>
        <div className="row" style={{ position: 'absolute', top: 12, left: 12, right: 12, gap: 4 }}>{group.items.map((_, k) => <span key={k} style={{ flex: 1, height: 3, borderRadius: 2, background: k < i ? '#fff' : k === i ? 'var(--volt)' : 'rgba(255,255,255,.3)' }} />)}</div>
        <div className="row" style={{ position: 'absolute', top: 24, left: 12, right: 12, gap: 10 }}>
          <Avatar name={group.author.name} url={group.author.avatarUrl} size={36} />
          <b style={{ fontSize: 14 }}>{group.author.name}</b><span style={{ fontSize: 12, opacity: 0.7 }}>{ago(s.createdAt)}</span>
          <button className="icon-btn ghost sm" style={{ marginLeft: 'auto', color: '#fff' }} onClick={onClose} aria-label="Yopish"><Icon n="close" /></button>
        </div>
        {s.text && <div style={{ position: 'absolute', left: 20, right: 20, bottom: 48, fontSize: 24, fontWeight: 800, lineHeight: 1.2, textShadow: '0 2px 12px rgba(0,0,0,.5)' }}>{s.text}</div>}
        <button aria-label="Oldingi" onClick={() => setI(Math.max(0, i - 1))} style={{ position: 'absolute', left: 0, top: 80, bottom: 0, width: '35%', background: 'none', border: 'none' }} />
        <button aria-label="Keyingi" onClick={() => (i + 1 < group.items.length ? setI(i + 1) : onClose())} style={{ position: 'absolute', right: 0, top: 80, bottom: 0, width: '65%', background: 'none', border: 'none' }} />
      </div>
    </div>
  );
}

export function StoryCreate({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const submit = async () => {
    const f = new FormData();
    if (text.trim()) f.set('text', text.trim());
    if (file) f.set('media', file);
    setBusy(true);
    try { await upload('/stories', f); toast('Hikoya joylandi · 24 soat ko‘rinadi'); setText(''); setFile(null); onDone(); onClose(); }
    catch (e) { toast((e as Error).message, { kind: 'err' }); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Hikoya qo‘shish">
      <label className="btn btn-outline btn-block" style={{ cursor: 'pointer' }}><Icon n="add_photo_alternate" />{file ? file.name : 'Rasm tanlash'}<input type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Qisqa matn: «Bugun 21:00 – Chilonzor Cage»" maxLength={200} />
      <Btn className="btn btn-primary btn-block" loading={busy} disabled={!text.trim() && !file} onClick={submit}>Joylash</Btn>
    </Modal>
  );
}

export { api };
