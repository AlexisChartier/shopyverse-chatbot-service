import { qdrantClient } from '../../infrastructure/vectorstore/QdrantClient.js';
import { embeddingsClient } from '../../infrastructure/embeddings/HfEmbeddings.js';

export interface SearchResult {
  id: string | number;
  score: number;
  content: string;
  metadata: Record<string, any>;
}

export class RetrieverService {
  private collectionName = 'shopyverse_docs';

  async search(query: string, limit: number = 3): Promise<SearchResult[]> {
    // 1. Vectorisation de la question utilisateur
    const queryVector = await embeddingsClient.embedQuery(query);

    // 2. Recherche vectorielle dans Qdrant
    const results = await qdrantClient.search(this.collectionName, {
      vector: queryVector,
      limit: limit,
      with_payload: true,
    });

    // 3. Formatage des résultats
    return results.map((res) => ({
      id: res.id,
      score: res.score,
      content: res.payload?.content as string || '',
      metadata: res.payload as Record<string, any>,
    }));
  }
}

export const retrieverService = new RetrieverService();