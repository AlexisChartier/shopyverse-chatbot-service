import { qdrantClient } from "../../infrastructure/vectorstore/QdrantClient.js";
import { embeddingsClient } from "../../infrastructure/embeddings/HfEmbeddings.js";

const PRODUCT_COLLECTION = "shopyverse_products";

export interface ProductSearchResult {
  productId: string;
  title: string;
  description: string;
  slug: string;
  categoryId: string;
  categoryName?: string | null;
  score: number;
}

export class ProductRetrieverService {
  async search(query: string, limit: number = 5): Promise<ProductSearchResult[]> {
    // 1. Vectorize query
    const queryVector = await embeddingsClient.embedQuery(query);

    // 2. Search in Qdrant
    const results = await qdrantClient.search(PRODUCT_COLLECTION, {
      vector: queryVector,
      limit,
      with_payload: true
    });

    // 3. Format
    return results.map((res) => ({
      productId: (res.payload?.productId as string) ?? String(res.id),
      title: (res.payload?.title as string) ?? "",
      description: (res.payload?.description as string) ?? "",
      slug: (res.payload?.slug as string) ?? "",
      categoryId: (res.payload?.categoryId as string) ?? "",
      categoryName: (res.payload?.categoryName as string | null) ?? null,
      score: res.score
    }));
  }
}

export const productRetrieverService = new ProductRetrieverService();