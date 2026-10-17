// Load dotenv FIRST before any other imports
import 'dotenv/config';

import { createServer } from 'http';
import { app } from './app';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { initSocket } from './realtime/socket';
import { startParticipantJanitor, stopParticipantJanitor } from './realtime/participantJanitor';
import { logger } from './lib/logger';
import { env } from './config/env';

async function bootstrap() {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Connect to Redis
    await connectRedis();

    // Wrap Express in HTTP server so Socket.IO can share the port
    const httpServer = createServer(app);

    // Initialize Socket.IO (graceful even without Redis adapter)
    await initSocket(httpServer);

    // Janitor: marks participants whose heartbeats stopped as left, so a
    // crashed socket doesn't leave them counted as present forever.
    startParticipantJanitor();

    httpServer.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  stopParticipantJanitor();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  stopParticipantJanitor();
  process.exit(0);
});

bootstrap();
