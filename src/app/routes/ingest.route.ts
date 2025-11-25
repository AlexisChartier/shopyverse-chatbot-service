import type { FastifyInstance } from 'fastify';
import { ingestionService, type DocumentInput } from '../../application/ingestion/ingestDocument.js';

export async function ingestRoute(fastify: FastifyInstance) {
  fastify.post('/ingest', async (request, reply) => {
    const body = request.body as { documents: DocumentInput[] };

    if (!body.documents || !Array.isArray(body.documents)) {
      return reply.code(400).send({ error: 'Le format attendu est { documents: [] }' });
    }

    try {
      const result = await ingestionService.ingest(body.documents);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Erreur lors de l\'ingestion' });
    }
  });
}