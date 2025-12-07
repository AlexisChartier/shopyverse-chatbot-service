import { embeddingsClient } from '../embeddings/HfEmbeddings.js';
import { logger } from '../observability/logger.js';

/**
 * BGE Reranker for FAQ context reranking
 * Uses semantic similarity scoring via embeddings to rerank documents.
 * This is a lightweight alternative to external reranking APIs.
 * 
 * Algorithm:
 * 1. Embed the query
 * 2. Embed each document
 * 3. Compute cosine similarity between query and each document
 * 4. Sort by similarity score (descending)
 * 5. Return top-K documents
 */

export interface RerankedResult {
  index: number;
  score: number;
  text: string;
}

export class BgeReranker {
  private modelId = 'BAAI/bge-reranker-v2-m3 (via embeddings)';

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Rerank documents based on query relevance using embedding similarity
   * @param query User query/question
   * @param documents List of documents/contexts to rerank
   * @param topK Number of top documents to return
   * @returns Reranked documents sorted by relevance score (descending)
   */
  async rerank(
    query: string,
    documents: string[],
    topK: number = 3
  ): Promise<RerankedResult[]> {
    if (!documents.length) {
      logger.debug("Reranker: no documents to rerank");
      return [];
    }

    try {
      logger.debug(
        { modelId: this.modelId, docsCount: documents.length, topK },
        "🔄 BGE Reranker: scoring documents via embedding similarity..."
      );

      // 1. Embed the query
      const queryEmbedding = await embeddingsClient.embedQuery(query);

      // 2. Embed all documents
      const docEmbeddings = await embeddingsClient.embedDocuments(documents);

      // 3. Compute cosine similarity for each document
      const rerankedDocs: RerankedResult[] = docEmbeddings
        .map((docEmbedding, index) => {
          const score = this.cosineSimilarity(queryEmbedding, docEmbedding);
          return {
            index,
            score: Math.max(0, score), // Ensure score is non-negative
            text: documents[index],
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      logger.debug(
        { rerankedCount: rerankedDocs.length, topScores: rerankedDocs.map(d => d.score.toFixed(4)) },
        "✅ BGE Reranker: scoring complete"
      );

      return rerankedDocs;
    } catch (err) {
      logger.error({ err, modelId: this.modelId }, "❌ BGE Reranker error - falling back to original order");
      // Return original documents in order if reranking fails
      return documents.map((text, index) => ({ index, score: 0, text }));
    }
  }
}

// Singleton instance
export const bgeReranker = new BgeReranker();
