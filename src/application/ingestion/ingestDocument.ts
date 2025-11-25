import { v4 as uuidv4 } from 'uuid';
import { qdrantClient } from '../../infrastructure/vectorstore/QdrantClient.js'; // Notez l'extension .js obligatoire en ESM
import { embeddingsClient } from '../../infrastructure/embeddings/HfEmbeddings.js';

export interface DocumentInput {
  content: string;
  metadata?: Record<string, any>;
}

export class IngestionService {
  private collectionName = 'shopyverse_docs';

  async ensureCollectionExists() {
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some((c) => c.name === this.collectionName);

    if (!exists) {
      await qdrantClient.createCollection(this.collectionName, {
        vectors: {
          size: 384, // Taille du modèle MiniLM-L12-v2
          distance: 'Cosine',
        },
      });
      console.log(`Collection '${this.collectionName}' créée.`);
    }
  }

  async ingest(documents: DocumentInput[]) {
    await this.ensureCollectionExists();

    const texts = documents.map((d) => d.content);
    console.log(`Génération des embeddings pour ${texts.length} documents...`);
    
    const vectors = await embeddingsClient.embedDocuments(texts);

    const points = documents.map((doc, index) => ({
      id: uuidv4(),
      vector: vectors[index],
      payload: {
        content: doc.content,
        ...doc.metadata,
      },
    }));

    console.log(`Insertion dans Qdrant...`);
    await qdrantClient.upsert(this.collectionName, {
      wait: true,
      points: points,
    });

    return { success: true, count: points.length };
  }
}

export const ingestionService = new IngestionService();