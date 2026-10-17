import { Server as HttpServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { getRedis } from '../config/redis';
import { logger } from '../lib/logger';
import { TokenPayload } from '@campus-verse/shared';
import { registerLiveClassHandlers } from './liveClass.handlers';

export interface SocketData {
  userId: string;
  tenantId: string;
  email: string;
  roleCode: string;
  roleLevel: number;
  permissions: Record<string, string[]>;
}

let io: IOServer | null = null;

export function getIO(): IOServer {
  if (!io) throw new Error('Socket.IO not initialized. Call initSocket() first.');
  return io;
}

export async function initSocket(httpServer: HttpServer): Promise<IOServer> {
  const allowedOrigins = env.APP_URL.split(',').map((u) => u.trim());

  io = new IOServer(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (env.NODE_ENV === 'development' && origin.includes('localhost')) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error('Socket.IO CORS rejected'));
      },
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60_000,
    pingInterval: 25_000,
  });

  // Wire Redis adapter for horizontal scale (graceful if Redis unavailable)
  try {
    const pub = getRedis().duplicate();
    const sub = getRedis().duplicate();
    await Promise.all([pub.connect().catch(() => {}), sub.connect().catch(() => {})]);
    io.adapter(createAdapter(pub, sub));
    logger.info('Socket.IO Redis adapter attached');
  } catch (err) {
    logger.warn({ err }, 'Socket.IO Redis adapter unavailable, running in single-node mode');
  }

  // Auth middleware — verify JWT on handshake
  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization?.replace(/^Bearer /, '') as string | undefined);

      if (!token) return next(new Error('AUTH_TOKEN_MISSING'));

      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
      if (payload.type !== 'access') return next(new Error('AUTH_TOKEN_INVALID'));

      const data: SocketData = {
        userId: payload.userId,
        tenantId: payload.tenantId,
        email: payload.email,
        roleCode: payload.roleCode,
        roleLevel: payload.roleLevel,
        permissions: payload.permissions,
      };
      Object.assign(socket.data, data);
      next();
    } catch (err) {
      const message =
        err instanceof jwt.TokenExpiredError
          ? 'AUTH_TOKEN_EXPIRED'
          : err instanceof jwt.JsonWebTokenError
            ? 'AUTH_TOKEN_INVALID'
            : 'AUTH_FAILED';
      next(new Error(message));
    }
  });

  io.on('connection', (socket: Socket) => {
    logger.debug(
      { socketId: socket.id, userId: socket.data.userId, tenantId: socket.data.tenantId },
      'socket connected'
    );

    registerLiveClassHandlers(io!, socket);

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, reason }, 'socket disconnected');
    });
  });

  return io;
}

export async function closeSocket(): Promise<void> {
  if (io) {
    await io.close();
    io = null;
  }
}
