import type { FastifyInstance } from 'fastify';
import { metricsRegistry } from '../../infrastructure/observability/metrics.js';

export async function metricsRoute(fastify: FastifyInstance) {
  fastify.get('/metrics', async (request, reply) => {
    reply.header('Content-Type', metricsRegistry.contentType);
    return metricsRegistry.metrics();
  });
}
