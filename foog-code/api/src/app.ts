import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './env';
import { loadUser } from './auth';
import { errorHandler, HttpError } from './http';
import { UPLOAD_ROOT } from './uploads';
import { authRouter } from './routes/auth';
import { stadiumsRouter } from './routes/stadiums';
import { bookingsRouter } from './routes/bookings';
import { ownerRouter } from './routes/owner';
import { adminRouter } from './routes/admin';
import { socialRouter } from './routes/social';
import { matchesRouter } from './routes/matches';
import { adminPaymentsRouter, paymentsRouter } from './routes/payments';
import { chatRouter } from './routes/chat';
import { reelsRouter } from './routes/reels';
import { usersRouter } from './routes/users';
import { notificationsRouter } from './routes/notifications';
import { handleUpdate } from './bot';
import { prisma } from './db';
import { redis } from './redis';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.webOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (env.nodeEnv !== 'test') app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: '7d', immutable: true }));

  app.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({ ok: true });
  });

  // Telegram webhook (TELEGRAM_MODE=webhook)
  app.post('/telegram/webhook', async (req, res) => {
    if (env.webhookSecret && req.get('x-telegram-bot-api-secret-token') !== env.webhookSecret) return res.sendStatus(401);
    res.sendStatus(200);
    handleUpdate(req.body).catch((e) => console.error('[bot]', e));
  });

  const v1 = express.Router();
  v1.use(loadUser);
  v1.use('/auth', authRouter);
  v1.use('/stadiums', stadiumsRouter);
  v1.use('/bookings', bookingsRouter);
  v1.use('/owner', ownerRouter);
  v1.use('/admin/payments', adminPaymentsRouter);
  v1.use('/admin', adminRouter);
  v1.use('/chats', chatRouter);
  v1.use('/reels', reelsRouter);
  v1.use('/users', usersRouter);
  v1.use('/notifications', notificationsRouter);
  v1.use('/', paymentsRouter);
  v1.use('/', matchesRouter);
  v1.use('/', socialRouter);
  v1.use((_req, _res, next) => next(new HttpError(404, 'Bunday API yo‘q', 'not_found')));
  app.use('/api/v1', v1);
  app.use(errorHandler);
  return app;
}
