import { qdrantClient } from "../vectorstore/QdrantClient.js";
import { embeddingsClient } from "../embeddings/HfEmbeddings.js";
import { faqRepository, type FaqItem } from "../db/repositories/FaqRepository.js";
import { logger } from "../observability/logger.js";

/**
 * Service to synchronize FAQ items from PostgreSQL to Qdrant vector store
 */
export class FaqSyncService {
  private collectionName = "shopyverse_docs";

  /**
   * Ensure the collection exists, create it if needed
   */
  private async ensureCollection(): Promise<void> {
    try {
      await qdrantClient.getCollection(this.collectionName);
    } catch {
      logger.info(`Creating collection ${this.collectionName}...`);
      await qdrantClient.createCollection(this.collectionName, {
        vectors: {
          size: embeddingsClient.dimension,
          distance: "Cosine",
        },
      });
    }
  }

  /**
   * Sync a single FAQ item to Qdrant
   * Creates or updates the vector in Qdrant
   */
  async syncFaqToQdrant(faq: FaqItem): Promise<void> {
    try {
      await this.ensureCollection();

      // Generate embedding for the FAQ content
      const embedding = await embeddingsClient.embedQuery(faq.content);

      // Upsert to Qdrant (create or update)
      await qdrantClient.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: Number(faq.id!),
            vector: embedding,
            payload: {
              source: "faq",
              faq_id: faq.id,
              title: faq.title,
              content: faq.content,
              category: faq.category,
              tags: faq.tags,
              metadata: {
                topic: faq.category,
                type: "faq",
              },
            },
          },
        ],
      });

      logger.debug(
        { faqId: faq.id, title: faq.title },
        "✅ FAQ synced to Qdrant"
      );
    } catch (err) {
      logger.error(
        { err, faqId: faq.id },
        "❌ Failed to sync FAQ to Qdrant"
      );
      throw err;
    }
  }

  /**
   * Remove a FAQ from Qdrant
   */
  async removeFaqFromQdrant(faqId: number): Promise<void> {
    try {
      await qdrantClient.delete(this.collectionName, {
        points: [faqId],
      });
      logger.debug({ faqId }, "✅ FAQ removed from Qdrant");
    } catch (err) {
      logger.error(
        { err, faqId },
        "❌ Failed to remove FAQ from Qdrant"
      );
      throw err;
    }
  }

  /**
   * Sync all active FAQs to Qdrant (full sync)
   */
  async syncAllFaqsToQdrant(): Promise<void> {
    try {
      await this.ensureCollection();

      const faqs = await faqRepository.getAll();
      logger.info(`🔄 Starting full FAQ sync (${faqs.length} items)...`);

      for (const faq of faqs) {
        await this.syncFaqToQdrant(faq);
      }

      logger.info(`✅ Full FAQ sync completed (${faqs.length} items)`);
    } catch (err) {
      logger.error({ err }, "❌ Failed to sync all FAQs to Qdrant");
      throw err;
    }
  }
}

/**
 * Singleton instance
 */
export const faqSyncService = new FaqSyncService();
