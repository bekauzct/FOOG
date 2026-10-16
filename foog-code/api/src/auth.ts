import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role, User } from '@prisma/client';
import { env } from './env';
import { prisma } from './db';
import { HttpError } from './http';

export const COOKIE = 'foog_token';
const TTL_DAYS = 30;

export type Claims = { sub: string; role: Role; staff?: boolean };

export function signToken(user: Pick<User, 'id' | 'role'>, staff = false) {
  return jwt.sign({ sub: user.id, role: user.role, staff } satisfies Claims, env.jwtSecret, { expiresIn: `${TTL_DAYS}d` });
}
export function signWsToken(userId: string) {
  return jwt.sign({ sub: userId, ws: true }, env.jwtSecret, { expiresIn: '2m' });
}
export function verify(token: string): (Claims & { ws?: boolean }) | null {
  try {
    return jwt.verify(token, env.jwtSecret) as Claims & { ws?: boolean };
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: TTL_DAYS * 24 * 3600 * 1000,
    path: '/',
  });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      isStaff?: boolean;
    }
  }
}

function tokenOf(req: Request) {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7);
  return req.cookies?.[COOKIE] as string | undefined;
}

/** Token bo‘lsa foydalanuvchini yuklaydi (majburiy emas) */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const t = tokenOf(req);
    const c = t ? verify(t) : null;
    if (c && !c.ws) {
      const user = await prisma.user.findUnique({ where: { id: c.sub } });
      if (user) {
        // Blok muddati tugagan bo‘lsa – avtomatik ochamiz
        if (user.status === 'blocked' && user.blockedUntil && user.blockedUntil < new Date()) {
          req.user = await prisma.user.update({ where: { id: user.id }, data: { status: 'active', blockedUntil: null, blockReason: null } });
        } else req.user = user;
      }
    }
    next();
  } catch (e) {
    next(e);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Avval Telegram orqali kiring', 'unauthorized'));
  if (req.user.status === 'blocked') return next(new HttpError(403, 'Hisobingiz bloklangan. Savollar bo‘lsa @foog_support ga yozing.', 'blocked'));
  next();
}

/** Rol tekshiruvi. owner bo‘limiga stadion xodimlari ham kiradi. */
export function requireRole(...roles: (Role | 'staff')[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, async (err?: unknown) => {
      if (err) return next(err);
      const u = req.user!;
      if (roles.includes(u.role)) return next();
      if (roles.includes('staff')) {
        const n = await prisma.stadiumStaff.count({ where: { userId: u.id } });
        if (n > 0) {
          req.isStaff = true;
          return next();
        }
      }
      next(new HttpError(403, 'Bu bo‘limga ruxsatingiz yo‘q', 'forbidden'));
    });
  };
}
