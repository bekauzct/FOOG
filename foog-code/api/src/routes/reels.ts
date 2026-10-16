import { Router } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { ah, bad, forbidden, notFound, parse, qstr } from '../http';
import { requireAuth } from '../auth';
import { mediaUpload, publicUrl, diskPath, UPLOAD_ROOT } from '../uploads';
import { miniSelect } from '../serialize';
import { notify } from '../notify';
import { publish } from '../events';
import { dmChat, sendMessage } from './chat';

const run = promisify(execFile);
export const reelsRouter = Router();

const include = (uid?: string) => ({
  author: { select: { ...miniSelect, role: true } },
  stadium: { select: { id: true, name: true } },
  _count: { select: { likes: true, comments: true } },
  likes: uid ? { where: { userId: uid }, select: { id: true } } : false,
  saves: uid ? { where: { userId: uid }, select: { id: true } } : false,
} satisfies Prisma.ReelInclude);
type Row = Prisma.ReelGetPayload<{ include: ReturnType<typeof include> }>;

export const reelOut = (r: Row, following?: Set<string>) => ({
  id: r.id, videoUrl: r.videoUrl, posterUrl: r.posterUrl, caption: r.caption, type: r.type, bookCta: r.bookCta, status: r.status, views: r.views, createdAt: r.createdAt,
  author: r.author, stadium: r.stadium, likes: r._count.likes, comments: r._count.comments,
  liked: Array.isArray(r.likes) && r.likes.length > 0, saved: Array.isArray(r.saves) && r.saves.length > 0,
  following: following ? following.has(r.author.id) : false,
});

reelsRouter.get('/', ah(async (req, res) => {
  const uid = req.user?.id;
  const tab = qstr(req.query.tab) ?? 'foryou';
  const where: Prisma.ReelWhereInput = { status: 'published', hidden: false, author: { status: 'active' } };
  if (tab === 'following' && uid) where.author = { status: 'active', followers: { some: { followerId: uid } } };
  const author = qstr(req.query.author);
  if (author) where.authorId = author;
  const stadiumId = qstr(req.query.stadiumId);
  if (stadiumId) where.stadiumId = stadiumId;
  const saved = qstr(req.query.saved);
  if (saved && uid) where.saves = { some: { userId: uid } };
  const start = qstr(req.query.start);
  const rows = await prisma.reel.findMany({ where, include: include(uid), orderBy: { createdAt: 'desc' }, take: 30 });
  if (start) {
    const i = rows.findIndex((r) => r.id === start);
    if (i > 0) rows.unshift(...rows.splice(i, 1));
    else if (i < 0) {
      const one = await prisma.reel.findFirst({ where: { id: start, status: 'published', hidden: false }, include: include(uid) });
      if (one) rows.unshift(one);
    }
  }
  const following = uid ? new Set((await prisma.follow.findMany({ where: { followerId: uid } })).map((f) => f.followingId)) : new Set<string>();
  res.json({ items: rows.map((r) => reelOut(r, following)) });
}));

reelsRouter.get('/:id', ah(async (req, res) => {
  const r = await prisma.reel.findUnique({ where: { id: req.params.id }, include: include(req.user?.id) });
  if (!r || r.hidden || (r.status !== 'published' && r.authorId !== req.user?.id)) throw notFound('Reel topilmadi');
  res.json(reelOut(r));
}));

/** Videoni saytda ko‘rish formatiga o‘tkazish: H.264 MP4, 720p, 60 soniyagacha + poster */
async function processReel(reelId: string, input: string) {
  const id = path.basename(input, path.extname(input));
  const outName = `${id}-720.mp4`, posterName = `${id}.jpg`;
  const out = path.join(UPLOAD_ROOT, 'reels', outName), poster = path.join(UPLOAD_ROOT, 'reels', posterName);
  try {
    const probe = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', input]);
    const dur = parseFloat(probe.stdout);
    if (!isFinite(dur) || dur <= 0) throw new Error('Video o‘qilmadi');
    if (dur > 61) throw new Error('Video 60 soniyadan uzun');
    await run('ffmpeg', ['-y', '-i', input, '-t', '60', '-vf', "scale='min(720,iw)':-2", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out], { timeout: 5 * 60 * 1000 });
    await run('ffmpeg', ['-y', '-ss', String(Math.min(1, dur / 2)), '-i', out, '-frames:v', '1', '-q:v', '4', poster]);
    if (out !== input) fs.rm(input, () => undefined);
    const r = await prisma.reel.update({ where: { id: reelId }, data: { status: 'published', videoUrl: publicUrl('reels', outName), posterUrl: publicUrl('reels', posterName) } });
    await notify(r.authorId, { type: 'social', kind: 'reel_published', title: 'Reel joylandi', body: r.caption || 'Profil va lentada ko‘rinadi', refType: 'reel', refId: r.id });
    await publish(r.authorId, 'reel', { id: r.id, status: 'published' });
  } catch (e) {
    console.warn('[reel] qayta ishlash xatosi', (e as Error).message);
    const r = await prisma.reel.update({ where: { id: reelId }, data: { status: 'failed' } });
    await notify(r.authorId, { type: 'social', kind: 'reel_failed', title: 'Reel yuklashda xato', body: (e as Error).message.includes('60') ? 'Video 60 soniyadan uzun. Qisqaroq video tanlang.' : 'Qayta urinib ko‘ring.', refType: 'reel', refId: r.id });
    await publish(r.authorId, 'reel', { id: r.id, status: 'failed' });
  }
}

reelsRouter.post('/', requireAuth, mediaUpload('reels', 200).single('video'), ah(async (req, res) => {
  const body = parse(z.object({ caption: z.string().trim().max(300).default(''), type: z.string().max(40).default('O‘yin lavhasi'), stadiumId: z.string().uuid().optional().or(z.literal('')), bookCta: z.enum(['true', 'false']).optional() }), req.body);
  if (!req.file) throw bad('Video tanlang');
  if (!req.file.mimetype.startsWith('video/')) throw bad('Faqat video yuklash mumkin');
  let stadiumId = body.stadiumId || undefined;
  if (req.user!.role === 'owner' && !stadiumId) stadiumId = (await prisma.stadium.findFirst({ where: { ownerId: req.user!.id }, orderBy: { createdAt: 'asc' } }))?.id;
  const r = await prisma.reel.create({ data: { authorId: req.user!.id, caption: body.caption, type: body.type, stadiumId, bookCta: body.bookCta === 'true' && !!stadiumId, videoUrl: publicUrl('reels', req.file.filename), status: 'processing' } });
  void processReel(r.id, req.file.path);
  res.status(201).json({ id: r.id, status: r.status });
}));

reelsRouter.post('/:id/retry', requireAuth, ah(async (req, res) => {
  const r = await prisma.reel.findUnique({ where: { id: req.params.id } });
  if (!r || r.authorId !== req.user!.id) throw notFound();
  if (r.status !== 'failed') throw bad('Reel xato holatida emas');
  const file = diskPath(r.videoUrl);
  if (!fs.existsSync(file)) throw bad('Asl video topilmadi – qaytadan yuklang');
  await prisma.reel.update({ where: { id: r.id }, data: { status: 'processing' } });
  void processReel(r.id, file);
  res.json({ status: 'processing' });
}));

reelsRouter.delete('/:id', requireAuth, ah(async (req, res) => {
  const r = await prisma.reel.findUnique({ where: { id: req.params.id } });
  if (!r) throw notFound();
  if (r.authorId !== req.user!.id && req.user!.role !== 'admin') throw forbidden();
  await prisma.reel.delete({ where: { id: r.id } });
  res.json({ ok: true });
}));

reelsRouter.post('/:id/view', ah(async (req, res) => {
  await prisma.reel.updateMany({ where: { id: req.params.id }, data: { views: { increment: 1 } } });
  res.json({ ok: true });
}));

reelsRouter.post('/:id/like', requireAuth, ah(async (req, res) => {
  const r = await prisma.reel.findUnique({ where: { id: req.params.id } });
  if (!r) throw notFound();
  const where = { userId_reelId: { userId: req.user!.id, reelId: r.id } };
  const ex = await prisma.like.findUnique({ where });
  if (ex) await prisma.like.delete({ where });
  else {
    await prisma.like.create({ data: { userId: req.user!.id, reelId: r.id } });
    await notify(r.authorId, { type: 'social', kind: 'like', title: `${req.user!.name} reelingizni yoqtirdi`, body: r.caption ? `“${r.caption.slice(0, 60)}”` : undefined, actorId: req.user!.id, refType: 'reel', refId: r.id });
  }
  res.json({ liked: !ex, likes: await prisma.like.count({ where: { reelId: r.id } }) });
}));

reelsRouter.post('/:id/save', requireAuth, ah(async (req, res) => {
  const where = { userId_reelId: { userId: req.user!.id, reelId: req.params.id } };
  const ex = await prisma.save.findUnique({ where });
  if (ex) await prisma.save.delete({ where });
  else await prisma.save.create({ data: { userId: req.user!.id, reelId: req.params.id } });
  res.json({ saved: !ex });
}));

/** Ulashish oynasi: do‘stlar ro‘yxatiga reel kartasini DM orqali yuborish */
reelsRouter.post('/:id/share', requireAuth, ah(async (req, res) => {
  const { userIds, text } = parse(z.object({ userIds: z.array(z.string().uuid()).min(1).max(20), text: z.string().max(300).optional() }), req.body);
  const r = await prisma.reel.findUnique({ where: { id: req.params.id } });
  if (!r) throw notFound();
  for (const to of userIds) {
    const c = await dmChat(req.user!.id, to);
    await sendMessage(c.id, req.user!.id, { type: 'reel', refId: r.id, body: text });
  }
  res.json({ sent: userIds.length });
}));

/** Ulashish uchun do‘stlar: kuzatganlar va kuzatuvchilar, so‘nggi suhbatlar birinchi */
reelsRouter.get('/share/friends', requireAuth, ah(async (req, res) => {
  const uid = req.user!.id;
  const q = qstr(req.query.q);
  const f = await prisma.follow.findMany({ where: { OR: [{ followerId: uid }, { followingId: uid }] } });
  const ids = [...new Set(f.map((x) => (x.followerId === uid ? x.followingId : x.followerId)))];
  const users = await prisma.user.findMany({ where: { id: { in: ids }, status: 'active', ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) }, select: miniSelect, take: 50 });
  res.json({ items: users });
}));
