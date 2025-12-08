import fetch from 'node-fetch';
import { config } from '../config/env.js';
import { logger } from '../observability/logger.js';

export type RecommendationItem = {
  id: string;
  name?: string;
  title?: string;
  slug?: string;
  description?: string;
  category?: string;
};

class RecoClient {
  private readonly baseUrl = config.RECO_SERVICE_URL;

  async getRecommendations(productId: string): Promise<RecommendationItem[]> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/recommendations?product_id=${encodeURIComponent(productId)}`;
    try {
      const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!res.ok) {
        logger.warn({ status: res.status }, 'Reco API returned non-200');
        return [];
      }
      const data = (await res.json()) as RecommendationItem[];
      return Array.isArray(data) ? data : [];
    } catch (err) {
      logger.error({ err }, 'Reco API call failed');
      return [];
    }
  }
}

export const recoClient = new RecoClient();
