import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { env } from './env';
import { bad } from './http';

export const UPLOAD_ROOT = path.resolve(env.uploadDir);
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const IMG = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VID = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];

function storage(sub: string) {
  const dir = path.join(UPLOAD_ROOT, sub);
  fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: dir,
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + (path.extname(file.originalname).toLowerCase().slice(0, 6) || '')),
  });
}

export const imageUpload = (sub: string) =>
  multer({
    storage: storage(sub), limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_r, f, cb) => (IMG.includes(f.mimetype) ? cb(null, true) : cb(bad('Faqat rasm (JPG, PNG, WEBP) yuklash mumkin'))),
  });

export const mediaUpload = (sub: string, maxMb = 100) =>
  multer({
    storage: storage(sub), limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (_r, f, cb) => (IMG.includes(f.mimetype) || VID.includes(f.mimetype) ? cb(null, true) : cb(bad('Faqat rasm yoki video yuklash mumkin'))),
  });

export const isVideo = (mime: string) => mime.startsWith('video/');
export const publicUrl = (sub: string, filename: string) => `/uploads/${sub}/${filename}`;
export const diskPath = (url: string) => path.join(UPLOAD_ROOT, url.replace(/^\/uploads\//, ''));
