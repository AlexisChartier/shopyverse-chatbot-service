import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from '../infrastructure/config/env.js';
import { requestContextMiddleware } from './middlewares/request-context.js';
import { authMiddleware } from './middlewares/auth.js';
import { chatRoute } from './routes/chat.route.js';
import { ingestRoute } from './routes/ingest.route.js';
import { metricsRoute } from './routes/metrics.route.js';
import { adminRoute } from "./routes/admin.route.js";
import { db } from '../infrastructure/db/pgClient.js';

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
await server.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  credentials: true,
});
await server.register(helmet);

// Initialize PostgreSQL connection pool and create schema
try {
  await db.initDb();
  console.log("📦 Database connected and schema initialized");
} catch (err) {
  console.error("❌ Database initialization error:", err);
  process.exit(1);
}

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
  await v1.register(adminRoute, { prefix: "/admin" });
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

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await db.closeDb();
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await db.closeDb();
  await server.close();
  process.exit(0);
});

start();