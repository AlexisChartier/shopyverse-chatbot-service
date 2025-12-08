import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { httpRequestCounter, httpRequestDuration } from '../../infrastructure/observability/metrics.js';

export async function observabilityPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (req) => {
    // store high resolution start time
    (req as any).startHrTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
    const start = (req as any).startHrTime as bigint | undefined;
    const durationSeconds = start
      ? Number(process.hrtime.bigint() - start) / 1e9
      : undefined;

    const route =
      req.routeOptions?.url ?? (req as { routerPath?: string }).routerPath ?? req.url;
    const labels = {
      method: (req.method || 'UNKNOWN').toLowerCase(),
      route,
      status: String(reply.statusCode || 0),
    } as const;

    httpRequestCounter.labels(labels.method, labels.route, labels.status).inc();

    if (durationSeconds !== undefined) {
      httpRequestDuration
        .labels(labels.method, labels.route, labels.status)
        .observe(durationSeconds);
    }
  });
}
