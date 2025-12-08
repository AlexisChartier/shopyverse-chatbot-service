import type { FastifyInstance } from 'fastify';

import { ingestionService, type DocumentInput } from '../../application/ingestion/ingestDocument.js';
import { productIngestionService } from '../../application/ingestion/ingestProducts.js';
import type { ProductForIndex } from '../../application/products/product.type.js';
import { productRetrieverService } from '../../application/products/productRetriever.js';

export async function ingestRoute(fastify: FastifyInstance) {
  /**
   * ============================================================
   * 1) Ingestion FAQ 
   * ============================================================
   */
  fastify.post('/ingest', async (request, reply) => {
    const body = request.body as { documents: DocumentInput[] };

    if (!body.documents || !Array.isArray(body.documents)) {
      return reply.code(400).send({
        error: "Le format attendu est { documents: [] }"
      });
    }

    try {
      const result = await ingestionService.ingest(body.documents);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: "Erreur lors de l'ingestion des documents FAQ" });
    }
  });


  /**
   * ============================================================
   * 2) Ingestion Produits 
   * ============================================================
   */

  fastify.post('/ingest/products', async (request, reply) => {
    const body = request.body as { products: ProductForIndex[] };

    if (!body.products || !Array.isArray(body.products)) {
      return reply.code(400).send({
        error: "Le format attendu est { products: [] }"
      });
    }

    try {
      const result = await productIngestionService.ingestProducts(body.products);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: "Erreur lors de l'ingestion des produits" });
    }
  });
  fastify.post('/ingest/products/search-test', async (request, reply) => {
  const body = request.body as { query: string; limit?: number };

  if (!body.query) {
    return reply.code(400).send({ error: "Le champ 'query' est requis." });
    }

  try {
    const results = await productRetrieverService.search(body.query, body.limit ?? 5);
    return reply.send({ results });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: "Erreur lors de la recherche de produits" });
  }
});
}