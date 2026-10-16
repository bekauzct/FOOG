import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}
export const bad = (m: string, code?: string) => new HttpError(400, m, code);
export const notFound = (m = 'Topilmadi') => new HttpError(404, m, 'not_found');
export const forbidden = (m = 'Ruxsat yo‘q') => new HttpError(403, m, 'forbidden');
export const conflict = (m: string, code?: string) => new HttpError(409, m, code);

type H = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;
/** async handler – xatolarni markaziy ishlovchiga uzatadi */
export const ah = (fn: H) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({ error: `Ma’lumot noto‘g‘ri: ${first?.path.join('.') || ''} ${first?.message ?? ''}`.trim(), code: 'validation', issues: err.issues });
  }
  const e = err as { code?: string; message?: string };
  if (e?.code === 'P2002') return res.status(409).json({ error: 'Bunday yozuv allaqachon bor', code: 'duplicate' });
  if (e?.code === 'P2025') return res.status(404).json({ error: 'Topilmadi', code: 'not_found' });
  console.error(err);
  res.status(500).json({ error: 'Serverda xatolik. Birozdan keyin qayta urinib ko‘ring.', code: 'server' });
}

export const qstr = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
export const qnum = (v: unknown) => (typeof v === 'string' && v !== '' && !isNaN(+v) ? +v : undefined);
