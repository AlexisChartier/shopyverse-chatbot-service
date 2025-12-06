// src/application/products/ingestProducts.ts
import { embeddingsClient } from "../../infrastructure/embeddings/HfEmbeddings.js";
import { qdrantClient } from "../../infrastructure/vectorstore/QdrantClient.js";
import type { ProductForIndex } from "../products/product.type.js";

const PRODUCT_COLLECTION = "shopyverse_products";

export class ProductIngestionService {
  /**
   * Ingest a batch of products into the semantic index.
   * Can be called from a sync job or an API endpoint.
   */
  async ingestProducts(products: ProductForIndex[]) {
    if (!products.length) {
      return { inserted: 0 };
    }

    // 1. Ensure collection exists (adapt if you already have a helper)
    await this.ensureCollection();

    // 2. Build texts to embed (title + description + categoryName)
    const texts = products.map((p) => {
      const parts = [p.title, p.description];
      if (p.categoryName) parts.push(`Catégorie : ${p.categoryName}`);
      return parts.join(". ");
    });

    // 3. Compute embeddings
    const vectors = await embeddingsClient.embedDocuments(texts);

    // 4. Build Qdrant points
    const points = products.map((p, idx) => ({
        
      id: idx, 
      vector: vectors[idx],
      payload: {
        productId: p.productId,
        title: p.title,
        description: p.description,
        slug: p.slug,
        categoryId: p.categoryId,
        categoryName: p.categoryName ?? null,
        type: "product"
      }
    }));

    // 5. Upsert in Qdrant
    await qdrantClient.upsert(PRODUCT_COLLECTION, {
      wait: true,
      points
    });

    return { inserted: products.length };
  }

  private async ensureCollection() {
    // Si tu as déjà une logique similaire pour shopyverse_docs, tu peux la factoriser.
    try {
      await qdrantClient.getCollection(PRODUCT_COLLECTION);
      // si ça ne jette pas → la collection existe déjà
      return;
    } catch {
      // On crée la collection si elle n'existe pas
      await qdrantClient.createCollection(PRODUCT_COLLECTION, {
        vectors: {
          size: embeddingsClient.dimension, // expose cette info côté embeddingsClient
          distance: "Cosine"
        }
      });
    }
  }
}

export const productIngestionService = new ProductIngestionService();