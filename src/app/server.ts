import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from '../infrastructure/config/env.js';
import { requestContextMiddleware } from './middlewares/request-context.js';
import { authMiddleware } from './middlewares/auth.js';
import { chatRoute } from './routes/chat.route.js';
import { ingestRoute } from './routes/ingest.route.js';
import { metricsRoute } from './routes/metrics.route.js';

const server = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: config.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
  disableRequestLogging: true, // On gère nos propres logs si besoin, ou on laisse pino
});

// Plugins globaux
await server.register(cors, { origin: '*' }); // A restreindre en prod
await server.register(helmet);

// Middlewares globaux
server.addHook('onRequest', requestContextMiddleware);

// Routes publiques (Healthcheck, Metrics)
server.get('/health', async () => ({ status: 'ok' }));
await server.register(metricsRoute);

// API V1
server.register(async (v1) => {
  // Middleware d'auth pour l'API
  v1.addHook('onRequest', authMiddleware);

  // Routes métier
  await v1.register(chatRoute);
  await v1.register(ingestRoute);
}, { prefix: '/api/v1' });

// Démarrage
const start = async () => {
  try {
    await server.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log(`🚀 Chatbot Service running on port ${config.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();